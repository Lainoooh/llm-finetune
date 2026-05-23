from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings
from app.executors.base import RemoteExecutionResult
from app.executors.jupyter_terminal.transport import JupyterEndpoint, JupyterTransport
from app.executors.queued_session import QueuedRemoteSession
from app.executors.ssh.transport import SshEndpoint, SshTransport
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


class RemoteExecutorFactory:
    def __init__(self):
        self._sessions: dict[str, QueuedRemoteSession] = {}

    async def run_for_server(self, server: ServerProfile, script: str, timeout_ms: int | None = None) -> RemoteExecutionResult:
        session = self._session_for_server(server)
        return await session.run_script(script, timeout_ms=timeout_ms)

    async def run_for_draft(self, config: DraftEndpointConfig, script: str, timeout_ms: int | None = None) -> RemoteExecutionResult:
        session = self._session_for_config(config)
        return await session.run_script(script, timeout_ms=timeout_ms)

    def _session_for_server(self, server: ServerProfile) -> QueuedRemoteSession:
        settings = get_settings()
        config = DraftEndpointConfig(
            access_type=server.access_type or "jupyter",
            host=server.host,
            user=server.user,
            password=server.password,
            ssh_port=server.ssh_port or 22,
            ssh_key=server.ssh_key or "",
            jupyter_base_url=server.jupyter_base_url or settings.jupyter_default_base_url,
            jupyter_token=server.jupyter_token or settings.jupyter_default_token,
        )
        return self._session_for_config(config)

    def _session_for_config(self, config: DraftEndpointConfig) -> QueuedRemoteSession:
        transport = self._transport_for_config(config)
        if transport.key not in self._sessions:
            self._sessions[transport.key] = QueuedRemoteSession(transport)
        return self._sessions[transport.key]

    def _transport_for_config(self, config: DraftEndpointConfig):
        access_type = (config.access_type or "jupyter").lower()
        if access_type == "jupyter":
            if not config.jupyter_token:
                raise ValueError("Jupyter token is not configured")
            return JupyterTransport(JupyterEndpoint(base_url=config.jupyter_base_url.rstrip("/"), token=config.jupyter_token))
        if access_type == "ssh":
            if not config.host:
                raise ValueError("SSH host is required")
            if not config.user:
                raise ValueError("SSH username is required")
            return SshTransport(
                SshEndpoint(
                    host=config.host,
                    port=config.ssh_port or 22,
                    username=config.user,
                    password=config.password or "",
                    private_key=config.ssh_key or "",
                )
            )
        raise ValueError(f"Unsupported access type: {config.access_type}")


remote_executor = RemoteExecutorFactory()
