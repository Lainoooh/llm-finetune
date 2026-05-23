from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from app.executors.transport import RemoteFrame


@dataclass
class SshEndpoint:
    host: str
    port: int
    username: str
    password: str = ""
    private_key: str = ""

    @property
    def key(self) -> str:
        return f"ssh:{self.username}@{self.host}:{self.port}"


class SshTransport:
    def __init__(self, endpoint: SshEndpoint):
        self.endpoint = endpoint
        self.connection: Any = None
        self.process: Any = None
        self.queue: asyncio.Queue[RemoteFrame] = asyncio.Queue()
        self.reader_tasks: list[asyncio.Task] = []

    @property
    def key(self) -> str:
        return self.endpoint.key

    @property
    def is_connected(self) -> bool:
        return bool(self.connection and self.process)

    async def connect(self) -> None:
        try:
            import asyncssh
        except ImportError as exc:
            raise RuntimeError("SSH connection requires asyncssh. Please install backend requirements.") from exc

        kwargs: dict[str, Any] = {
            "host": self.endpoint.host,
            "port": self.endpoint.port,
            "username": self.endpoint.username,
            "known_hosts": None,
        }
        if self.endpoint.private_key:
            if "-----BEGIN" in self.endpoint.private_key:
                kwargs["client_keys"] = [asyncssh.import_private_key(self.endpoint.private_key)]
            else:
                kwargs["client_keys"] = [self.endpoint.private_key]
        elif self.endpoint.password:
            kwargs["password"] = self.endpoint.password
        self.connection = await asyncssh.connect(**kwargs)
        self.process = await self.connection.create_process(term_type="xterm")
        self.reader_tasks = [
            asyncio.create_task(self._pump(self.process.stdout, "stdout")),
            asyncio.create_task(self._pump(self.process.stderr, "stderr")),
        ]

    async def send(self, payload: str) -> None:
        self.process.stdin.write(payload)
        drain = getattr(self.process.stdin, "drain", None)
        if drain:
            await drain()

    async def recv(self) -> RemoteFrame:
        return await self.queue.get()

    async def close(self) -> None:
        for task in self.reader_tasks:
            task.cancel()
        self.reader_tasks = []
        process = self.process
        connection = self.connection
        self.process = None
        self.connection = None
        if process:
            try:
                process.terminate()
            except Exception:
                pass
        if connection:
            try:
                connection.close()
                await connection.wait_closed()
            except Exception:
                pass

    async def _pump(self, reader: Any, kind: str) -> None:
        try:
            while True:
                chunk = await reader.read(4096)
                if not chunk:
                    break
                await self.queue.put(RemoteFrame(kind=kind, content=str(chunk)))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self.queue.put(RemoteFrame(kind="stderr", content=str(exc)))
