from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from app.core.config import get_settings
from app.executors.base import RemoteExecutionResult
from app.executors.jupyter_terminal.transport import JupyterEndpoint, JupyterTransport
from app.executors.session_pool import SessionPoolManager
from app.executors.ssh.transport import SshEndpoint, SshTransport
from app.executors.transport import RemoteTransport
from app.models import ServerProfile


@dataclass
class DraftEndpointConfig:
    access_type: str
    host: str = ""
    user: str = ""
    password: str = ""
    ssh_port: int = 22
    ssh_key: str = ""
    jupyter_base_url: str = ""
    jupyter_token: str = ""


def _config_for_server(server: ServerProfile) -> DraftEndpointConfig:
    settings = get_settings()
    return DraftEndpointConfig(
        access_type=server.access_type or "jupyter",
        host=server.host,
        user=server.user,
        password=server.password,
        ssh_port=server.ssh_port or 22,
        ssh_key=server.ssh_key or "",
        jupyter_base_url=server.jupyter_base_url or settings.jupyter_default_base_url,
        jupyter_token=server.jupyter_token or settings.jupyter_default_token,
    )


def _key_for_config(config: DraftEndpointConfig) -> str:
    access_type = (config.access_type or "jupyter").lower()
    if access_type == "jupyter":
        return f"jupyter:{config.jupyter_base_url.rstrip('/')}"
    if access_type == "ssh":
        return f"ssh:{config.user}@{config.host}:{config.ssh_port or 22}"
    raise ValueError(f"Unsupported access type: {config.access_type}")


def _transport_factory_for_config(config: DraftEndpointConfig) -> Callable[[], RemoteTransport]:
    access_type = (config.access_type or "jupyter").lower()
    if access_type == "jupyter":
        if not config.jupyter_token:
            raise ValueError("Jupyter token is not configured")
        base_url = config.jupyter_base_url.rstrip("/")
        token = config.jupyter_token
        return lambda: JupyterTransport(JupyterEndpoint(base_url=base_url, token=token))
    if access_type == "ssh":
        if not config.host:
            raise ValueError("SSH host is required")
        if not config.user:
            raise ValueError("SSH username is required")
        host = config.host
        port = config.ssh_port or 22
        username = config.user
        password = config.password or ""
        private_key = config.ssh_key or ""
        return lambda: SshTransport(
            SshEndpoint(
                host=host,
                port=port,
                username=username,
                password=password,
                private_key=private_key,
            )
        )
    raise ValueError(f"Unsupported access type: {config.access_type}")


class RemoteExecutorFactory:
    def __init__(self):
        self._pool_manager = SessionPoolManager()

    async def run_for_server(
        self, server: ServerProfile, script: str, timeout_ms: int | None = None
    ) -> RemoteExecutionResult:
        return await self._pool_manager.run_for_server(server, script, timeout_ms=timeout_ms)

    async def run_for_draft(
        self, config: DraftEndpointConfig, script: str, timeout_ms: int | None = None
    ) -> RemoteExecutionResult:
        return await self._pool_manager.run_for_draft(config, script, timeout_ms=timeout_ms)

    async def shutdown(self) -> None:
        await self._pool_manager.shutdown_all()

    async def remove_pool(self, key: str) -> None:
        await self._pool_manager.remove_pool(key)

    def get_pool_stats(self) -> dict:
        return self._pool_manager.get_pool_stats()


remote_executor = RemoteExecutorFactory()
