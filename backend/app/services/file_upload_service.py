"""File upload service for dataset files to remote servers."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.executors.factory import remote_executor
from app.models import FinetuneSubtask, ServerProfile

logger = logging.getLogger(__name__)

# Max file size for base64 chunked upload (1MB)
BASE64_MAX_SIZE = 1 * 1024 * 1024
# Base64 chunk size (64KB)
BASE64_CHUNK_SIZE = 64 * 1024


@dataclass
class UploadResult:
    """Result of a file upload."""

    remote_path: str
    size: int
    md5: str | None
    rows: int | None = None
    sample_rows: list[dict] | None = None


class UploadProgressManager:
    """Manages upload progress callbacks (for WebSocket broadcasting)."""

    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}
        self._lock = asyncio.Lock()

    def subscribe(self, subtask_code: str, callback: Callable):
        self._subscribers.setdefault(subtask_code, []).append(callback)

    def unsubscribe(self, subtask_code: str, callback: Callable):
        cbs = self._subscribers.get(subtask_code, [])
        if callback in cbs:
            cbs.remove(callback)

    async def broadcast(self, subtask_code: str, event: dict):
        for cb in self._subscribers.get(subtask_code, []):
            try:
                await cb(event)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")


upload_progress_manager = UploadProgressManager()


class FileUploadService:
    """Service for uploading dataset files to remote servers."""

    async def upload(
        self,
        db: Session,
        subtask_code: str,
        file: UploadFile,
        filename: str | None = None,
        overwrite: bool = True,
    ) -> UploadResult:
        """Upload a file to the subtask's remote working directory."""
        subtask = db.query(FinetuneSubtask).filter(
            FinetuneSubtask.subtask_code == subtask_code
        ).first()
        if not subtask:
            raise ValueError(f"Subtask not found: {subtask_code}")

        if not subtask.server_profile_id:
            raise ValueError("Subtask has no server assigned")

        server = db.query(ServerProfile).filter(
            ServerProfile.id == subtask.server_profile_id
        ).first()
        if not server:
            raise ValueError(f"Server not found: {subtask.server_profile_id}")

        workdir = subtask.output_dir or f"/home/admin/workdir/{subtask.task_id}/{subtask.subtask_code}"
        remote_filename = filename or file.filename or "data.jsonl"
        remote_path = f"{workdir}/{remote_filename}"

        # Save to local temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{remote_filename}") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            file_size = os.path.getsize(tmp_path)
            local_md5 = self._calc_md5(tmp_path)

            # Broadcast start
            await upload_progress_manager.broadcast(subtask_code, {
                "type": "progress",
                "filename": remote_filename,
                "uploaded": 0,
                "total": file_size,
                "percent": 0,
            })

            # Choose upload method based on access_type and file size
            access_type = (server.access_type or "jupyter").lower()

            if access_type == "ssh" and file_size > BASE64_MAX_SIZE:
                await self._upload_sftp(server, tmp_path, remote_path, file_size, subtask_code, remote_filename)
            elif access_type == "jupyter" and file_size > BASE64_MAX_SIZE:
                await self._upload_jupyter(server, tmp_path, remote_path, file_size, subtask_code, remote_filename)
            else:
                # Base64 chunked upload (works for both SSH and Jupyter, small files)
                await self._upload_base64(server, tmp_path, remote_path, file_size, subtask_code, remote_filename)

            # Verify remote file
            remote_md5 = await self._remote_md5(server, remote_path)

            # Broadcast complete
            await upload_progress_manager.broadcast(subtask_code, {
                "type": "complete",
                "filename": remote_filename,
                "remotePath": remote_path,
                "md5": local_md5,
                "size": file_size,
            })

            # Try to get row count and sample rows
            rows = None
            sample_rows = None
            if remote_filename.endswith((".jsonl", ".json")):
                try:
                    rows = await self._remote_row_count(server, remote_path)
                    sample_rows = await self._remote_sample_rows(server, remote_path)
                except Exception as e:
                    logger.warning(f"Failed to read sample rows: {e}")

            # Update DB uploaded_files
            uploaded = json.loads(subtask.uploaded_files or "[]")
            file_entry = {
                "filename": remote_filename,
                "remotePath": remote_path,
                "size": file_size,
                "md5": local_md5,
                "rows": rows,
                "uploadedAt": datetime.utcnow().isoformat(),
            }
            # Replace existing entry with same filename
            uploaded = [f for f in uploaded if f["filename"] != remote_filename]
            uploaded.append(file_entry)
            subtask.uploaded_files = json.dumps(uploaded)
            db.commit()

            return UploadResult(
                remote_path=remote_path,
                size=file_size,
                md5=local_md5,
                rows=rows,
                sample_rows=sample_rows,
            )

        finally:
            # Cleanup temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    async def _upload_sftp(
        self,
        server: ServerProfile,
        local_path: str,
        remote_path: str,
        file_size: int,
        subtask_code: str,
        filename: str,
    ):
        """Upload via SSH SFTP (asyncssh)."""
        import asyncssh

        kwargs = {
            "host": server.host,
            "port": server.ssh_port or 22,
            "username": server.user,
            "known_hosts": None,
        }
        if server.ssh_key:
            if "-----BEGIN" in server.ssh_key:
                kwargs["client_keys"] = [asyncssh.import_private_key(server.ssh_key)]
            else:
                kwargs["client_keys"] = [server.ssh_key]
        elif server.password:
            kwargs["password"] = server.password

        conn = await asyncssh.connect(**kwargs)
        try:
            sftp = await conn.start_sftp_client()
            # Ensure remote directory exists
            await sftp.makedirs(os.path.dirname(remote_path), exist_ok=True)

            chunk_size = 64 * 1024
            uploaded = 0

            async with sftp.open(remote_path, "wb") as remote_file:
                with open(local_path, "rb") as local_file:
                    while True:
                        chunk = local_file.read(chunk_size)
                        if not chunk:
                            break
                        await remote_file.write(chunk)
                        uploaded += len(chunk)
                        await upload_progress_manager.broadcast(subtask_code, {
                            "type": "progress",
                            "filename": filename,
                            "uploaded": uploaded,
                            "total": file_size,
                            "percent": round(uploaded / file_size * 100, 1),
                        })
        finally:
            conn.close()
            await conn.wait_closed()

    async def _upload_jupyter(
        self,
        server: ServerProfile,
        local_path: str,
        remote_path: str,
        file_size: int,
        subtask_code: str,
        filename: str,
    ):
        """Upload via Jupyter Contents API."""
        import httpx

        with open(local_path, "rb") as f:
            content = base64.b64encode(f.read()).decode("ascii")

        base_url = (server.jupyter_base_url or "").rstrip("/")
        token = server.jupyter_token or ""

        # Ensure remote directory exists
        dir_path = os.path.dirname(remote_path)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.put(
                    f"{base_url}/api/contents/{dir_path}",
                    json={"type": "directory"},
                    headers={"Authorization": f"token {token}"},
                )
        except Exception:
            pass  # Directory may already exist

        # Upload file
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.put(
                f"{base_url}/api/contents/{remote_path}",
                json={"type": "file", "format": "base64", "content": content},
                headers={"Authorization": f"token {token}"},
            )
            response.raise_for_status()

        await upload_progress_manager.broadcast(subtask_code, {
            "type": "progress",
            "filename": filename,
            "uploaded": file_size,
            "total": file_size,
            "percent": 100,
        })

    async def _upload_base64(
        self,
        server: ServerProfile,
        local_path: str,
        remote_path: str,
        file_size: int,
        subtask_code: str,
        filename: str,
    ):
        """Upload via base64 chunks through remote executor (fallback)."""
        # Ensure remote directory exists
        dir_path = os.path.dirname(remote_path)
        await remote_executor.run_for_server(server, f"mkdir -p {dir_path}", timeout_ms=5000)

        # Clear target file
        await remote_executor.run_for_server(server, f"rm -f {remote_path}", timeout_ms=5000)

        chunk_size = BASE64_CHUNK_SIZE
        uploaded = 0

        with open(local_path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                b64 = base64.b64encode(chunk).decode("ascii")
                script = f'echo "{b64}" | base64 -d >> {remote_path}'
                await remote_executor.run_for_server(server, script, timeout_ms=30000)
                uploaded += len(chunk)
                await upload_progress_manager.broadcast(subtask_code, {
                    "type": "progress",
                    "filename": filename,
                    "uploaded": uploaded,
                    "total": file_size,
                    "percent": round(uploaded / file_size * 100, 1),
                })

    async def _remote_md5(self, server: ServerProfile, remote_path: str) -> str | None:
        """Get MD5 of remote file."""
        try:
            result = await remote_executor.run_for_server(
                server, f"md5sum {remote_path} | cut -d' ' -f1", timeout_ms=10000
            )
            return result.stdout.strip() or None
        except Exception:
            return None

    async def _remote_row_count(self, server: ServerProfile, remote_path: str) -> int | None:
        """Get row count of remote JSONL/JSON file."""
        try:
            if remote_path.endswith(".jsonl"):
                script = f"wc -l < {remote_path}"
            else:
                script = f"python3 -c \"import json; print(len(json.load(open('{remote_path}'))))\""
            result = await remote_executor.run_for_server(server, script, timeout_ms=10000)
            return int(result.stdout.strip())
        except Exception:
            return None

    async def _remote_sample_rows(
        self, server: ServerProfile, remote_path: str, count: int = 5
    ) -> list[dict] | None:
        """Read first N rows from remote file for column inference."""
        try:
            if remote_path.endswith(".jsonl"):
                script = f"head -n {count} {remote_path}"
                result = await remote_executor.run_for_server(server, script, timeout_ms=10000)
                rows = []
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        rows.append(json.loads(line))
                return rows
            else:
                script = f"python3 -c \"import json; d=json.load(open('{remote_path}')); print(json.dumps(d[:{count}], ensure_ascii=False))\""
                result = await remote_executor.run_for_server(server, script, timeout_ms=10000)
                return json.loads(result.stdout.strip())
        except Exception:
            return None

    def _calc_md5(self, file_path: str) -> str:
        """Calculate MD5 of local file."""
        h = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()


file_upload_service = FileUploadService()
