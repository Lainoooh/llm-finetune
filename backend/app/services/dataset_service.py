"""Dataset management service for LLaMA-Factory training data."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.executors.factory import remote_executor
from app.models import FinetuneSubtask, ServerProfile

logger = logging.getLogger(__name__)


@dataclass
class DatasetConfig:
    """Single dataset entry configuration."""

    file_name: str
    formatting: str = "alpaca"
    columns: dict | None = None
    tags: dict | None = None

    def to_dict(self) -> dict:
        result = {"file_name": self.file_name, "formatting": self.formatting}
        if self.columns:
            result["columns"] = self.columns
        if self.tags:
            result["tags"] = self.tags
        return result


@dataclass
class DatasetInfo:
    """Complete dataset_info.json structure with sync status."""

    datasets: dict[str, dict]
    remote_path: str
    last_synced_at: str | None = None


@dataclass
class PreviewResult:
    """Preview data for a dataset."""

    dataset_name: str
    items: list[dict]
    total: int
    page: int
    size: int
    formatting: str
    columns: dict | None
    file_size: int


class DatasetService:
    """Service for managing dataset_info.json on remote servers."""

    # Default column mappings for alpaca format
    DEFAULT_ALPACA_COLUMNS = {
        "prompt": "instruction",
        "query": "input",
        "response": "output",
    }

    # Default tags for sharegpt format
    DEFAULT_SHAREGPT_TAGS = {
        "role_tag": "role",
        "content_tag": "content",
        "user_tag": "user",
        "assistant_tag": "assistant",
    }

    def get_workdir(self, subtask: FinetuneSubtask) -> str:
        """Get the remote working directory for a subtask."""
        return subtask.output_dir or f"/home/admin/workdir/{subtask.task_id}/{subtask.subtask_code}"

    async def read_remote_dataset_info(
        self, db: Session, subtask_code: str
    ) -> DatasetInfo:
        """Read dataset_info.json from remote server."""
        subtask = self._get_subtask(db, subtask_code)
        server = self._get_server(db, subtask)
        workdir = self.get_workdir(subtask)
        remote_path = f"{workdir}/dataset_info.json"

        # Try to read the file
        script = f'''
cat {remote_path} 2>/dev/null || echo '{{}}'
'''
        try:
            result = await remote_executor.run_for_server(server, script, timeout_ms=10000)
            content = result.stdout.strip()
            if not content:
                content = "{}"
            datasets = json.loads(content)
        except Exception as e:
            logger.warning(f"Failed to read dataset_info.json: {e}")
            datasets = {}

        # Get sync status from DB
        sync_status_json = subtask.dataset_sync_status or "{}"
        sync_status = json.loads(sync_status_json)

        # Merge sync status into datasets
        for name, config in datasets.items():
            if name in sync_status:
                config["syncStatus"] = sync_status[name].get("status", "unknown")
                config["syncedAt"] = sync_status[name].get("syncedAt")
            else:
                config["syncStatus"] = "unsynced"

        return DatasetInfo(
            datasets=datasets,
            remote_path=remote_path,
            last_synced_at=subtask.dataset_last_synced_at.isoformat() if subtask.dataset_last_synced_at else None,
        )

    async def update_dataset_entry(
        self,
        db: Session,
        subtask_code: str,
        dataset_name: str,
        config: DatasetConfig,
    ) -> DatasetInfo:
        """Update a single dataset entry in dataset_info.json."""
        subtask = self._get_subtask(db, subtask_code)
        server = self._get_server(db, subtask)
        workdir = self.get_workdir(subtask)
        remote_path = f"{workdir}/dataset_info.json"

        # Read current content
        current_info = await self.read_remote_dataset_info(db, subtask_code)
        datasets = current_info.datasets

        # Update or add entry
        datasets[dataset_name] = config.to_dict()

        # Write back to remote
        json_content = json.dumps(datasets, indent=2, ensure_ascii=False)
        await self._write_remote_json(server, remote_path, json_content)

        # Update DB
        subtask.dataset_info = json_content
        subtask.dataset_last_synced_at = datetime.utcnow()

        # Update sync status
        sync_status = json.loads(subtask.dataset_sync_status or "{}")
        sync_status[dataset_name] = {
            "status": "synced",
            "syncedAt": datetime.utcnow().isoformat(),
        }
        subtask.dataset_sync_status = json.dumps(sync_status)

        db.commit()

        return await self.read_remote_dataset_info(db, subtask_code)

    async def sync_all_datasets(
        self, db: Session, subtask_code: str
    ) -> DatasetInfo:
        """Sync all dataset entries to remote dataset_info.json."""
        subtask = self._get_subtask(db, subtask_code)
        server = self._get_server(db, subtask)
        workdir = self.get_workdir(subtask)
        remote_path = f"{workdir}/dataset_info.json"

        # Get datasets from DB
        datasets_json = subtask.dataset_info or "{}"
        datasets = json.loads(datasets_json)

        # Write to remote
        json_content = json.dumps(datasets, indent=2, ensure_ascii=False)
        await self._write_remote_json(server, remote_path, json_content)

        # Update DB
        subtask.dataset_last_synced_at = datetime.utcnow()
        sync_status = {}
        for name in datasets:
            sync_status[name] = {
                "status": "synced",
                "syncedAt": datetime.utcnow().isoformat(),
            }
        subtask.dataset_sync_status = json.dumps(sync_status)

        db.commit()

        return await self.read_remote_dataset_info(db, subtask_code)

    async def sync_single_dataset(
        self, db: Session, subtask_code: str, dataset_name: str
    ) -> DatasetInfo:
        """Sync a single dataset entry to remote."""
        subtask = self._get_subtask(db, subtask_code)
        server = self._get_server(db, subtask)
        workdir = self.get_workdir(subtask)
        remote_path = f"{workdir}/dataset_info.json"

        # Read current remote content
        current_info = await self.read_remote_dataset_info(db, subtask_code)
        remote_datasets = current_info.datasets

        # Get local dataset config
        local_datasets = json.loads(subtask.dataset_info or "{}")
        if dataset_name not in local_datasets:
            raise ValueError(f"Dataset '{dataset_name}' not found in local config")

        # Update remote with local config
        remote_datasets[dataset_name] = local_datasets[dataset_name]

        # Write back
        json_content = json.dumps(remote_datasets, indent=2, ensure_ascii=False)
        await self._write_remote_json(server, remote_path, json_content)

        # Update DB sync status
        sync_status = json.loads(subtask.dataset_sync_status or "{}")
        sync_status[dataset_name] = {
            "status": "synced",
            "syncedAt": datetime.utcnow().isoformat(),
        }
        subtask.dataset_sync_status = json.dumps(sync_status)
        subtask.dataset_last_synced_at = datetime.utcnow()

        db.commit()

        return await self.read_remote_dataset_info(db, subtask_code)

    async def preview_dataset(
        self,
        db: Session,
        subtask_code: str,
        dataset_name: str,
        page: int = 1,
        size: int = 10,
    ) -> PreviewResult:
        """Preview dataset content with pagination."""
        subtask = self._get_subtask(db, subtask_code)
        server = self._get_server(db, subtask)
        workdir = self.get_workdir(subtask)

        # Get dataset config
        datasets = json.loads(subtask.dataset_info or "{}")
        if dataset_name not in datasets:
            raise ValueError(f"Dataset '{dataset_name}' not found")

        config = datasets[dataset_name]
        file_name = config.get("file_name")
        if not file_name:
            raise ValueError(f"Dataset '{dataset_name}' has no file_name")

        file_path = f"{workdir}/{file_name}"
        formatting = config.get("formatting", "alpaca")
        columns = config.get("columns")

        # Get total count (with caching)
        total = await self._get_row_count(db, subtask, server, file_path, dataset_name)

        # Calculate pagination
        start = (page - 1) * size + 1
        end = page * size

        # Read data based on file type
        if file_name.endswith(".jsonl"):
            items = await self._read_jsonl_range(server, file_path, start, end)
        elif file_name.endswith(".json"):
            items = await self._read_json_range(server, file_path, start, end)
        else:
            raise ValueError(f"Unsupported file type: {file_name}")

        # Get file size
        file_size = await self._get_file_size(server, file_path)

        return PreviewResult(
            dataset_name=dataset_name,
            items=items,
            total=total,
            page=page,
            size=size,
            formatting=formatting,
            columns=columns,
            file_size=file_size,
        )

    def infer_dataset_config(self, sample_rows: list[dict]) -> DatasetConfig:
        """Infer dataset configuration from sample data."""
        if not sample_rows:
            return DatasetConfig(
                file_name="data.jsonl",
                formatting="alpaca",
                columns=self.DEFAULT_ALPACA_COLUMNS,
            )

        first_row = sample_rows[0]
        keys = set(first_row.keys())

        # Check for sharegpt format
        if "messages" in keys or "conversations" in keys:
            return DatasetConfig(
                file_name="data.jsonl",
                formatting="sharegpt",
                tags=self.DEFAULT_SHAREGPT_TAGS,
            )

        # Check for alpaca format variants
        columns = {}
        if "instruction" in keys:
            columns["prompt"] = "instruction"
        elif "prompt" in keys:
            columns["prompt"] = "prompt"
        elif "question" in keys:
            columns["prompt"] = "question"

        if "input" in keys:
            columns["query"] = "input"

        if "output" in keys:
            columns["response"] = "output"
        elif "completion" in keys:
            columns["response"] = "completion"
        elif "answer" in keys:
            columns["response"] = "answer"

        if not columns.get("prompt") or not columns.get("response"):
            # Fallback to alpaca with default columns
            columns = self.DEFAULT_ALPACA_COLUMNS

        return DatasetConfig(
            file_name="data.jsonl",
            formatting="alpaca",
            columns=columns,
        )

    async def _write_remote_json(
        self, server: ServerProfile, remote_path: str, json_content: str
    ):
        """Write JSON content to remote file atomically."""
        tmp_path = f"{remote_path}.tmp"
        # Escape single quotes in JSON content
        escaped_content = json_content.replace("'", "'\\''")
        script = f'''
cat > {tmp_path} << 'HEREDOC'
{escaped_content}
HEREDOC
mv {tmp_path} {remote_path}
'''
        await remote_executor.run_for_server(server, script, timeout_ms=10000)

    async def _get_row_count(
        self,
        db: Session,
        subtask: FinetuneSubtask,
        server: ServerProfile,
        file_path: str,
        dataset_name: str,
    ) -> int:
        """Get row count with caching."""
        # Check cache
        cache_json = subtask.dataset_row_cache or "{}"
        cache = json.loads(cache_json)

        if dataset_name in cache:
            cached = cache[dataset_name]
            cached_at = datetime.fromisoformat(cached["cachedAt"])
            if datetime.utcnow() - cached_at < timedelta(minutes=5):
                return cached["rowCount"]

        # Count rows
        if file_path.endswith(".jsonl"):
            script = f"wc -l < {file_path}"
        else:
            script = f"python3 -c \"import json; print(len(json.load(open('{file_path}'))))\""

        result = await remote_executor.run_for_server(server, script, timeout_ms=10000)
        count = int(result.stdout.strip())

        # Update cache
        cache[dataset_name] = {
            "rowCount": count,
            "cachedAt": datetime.utcnow().isoformat(),
        }
        subtask.dataset_row_cache = json.dumps(cache)
        db.commit()

        return count

    async def _read_jsonl_range(
        self, server: ServerProfile, file_path: str, start: int, end: int
    ) -> list[dict]:
        """Read JSONL file lines in range (1-indexed)."""
        script = f"sed -n '{start},{end}p' {file_path}"
        result = await remote_executor.run_for_server(server, script, timeout_ms=10000)

        items = []
        for i, line in enumerate(result.stdout.strip().split("\n"), start=start):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                data["index"] = i
                items.append(data)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse JSON line {i}")

        return items

    async def _read_json_range(
        self, server: ServerProfile, file_path: str, start: int, end: int
    ) -> list[dict]:
        """Read JSON array file in range (1-indexed)."""
        # Convert to 0-indexed
        start_idx = start - 1
        script = f'''
python3 -c "
import json
data = json.load(open('{file_path}'))
items = data[{start_idx}:{end}]
for i, item in enumerate(items, start={start}):
    item['index'] = i
print(json.dumps(items, ensure_ascii=False))
"
'''
        result = await remote_executor.run_for_server(server, script, timeout_ms=10000)
        return json.loads(result.stdout.strip())

    async def _get_file_size(self, server: ServerProfile, file_path: str) -> int:
        """Get file size in bytes."""
        script = f"stat -c %s {file_path} 2>/dev/null || stat -f %z {file_path}"
        result = await remote_executor.run_for_server(server, script, timeout_ms=5000)
        try:
            return int(result.stdout.strip())
        except ValueError:
            return 0

    def _get_subtask(self, db: Session, subtask_code: str) -> FinetuneSubtask:
        """Get subtask by code."""
        subtask = db.query(FinetuneSubtask).filter(
            FinetuneSubtask.subtask_code == subtask_code
        ).first()
        if not subtask:
            raise ValueError(f"Subtask not found: {subtask_code}")
        return subtask

    def _get_server(self, db: Session, subtask: FinetuneSubtask) -> ServerProfile:
        """Get server for subtask."""
        if not subtask.server_profile_id:
            raise ValueError("Subtask has no server assigned")
        server = db.query(ServerProfile).filter(ServerProfile.id == subtask.server_profile_id).first()
        if not server:
            raise ValueError(f"Server not found: {subtask.server_profile_id}")
        return server


dataset_service = DatasetService()
