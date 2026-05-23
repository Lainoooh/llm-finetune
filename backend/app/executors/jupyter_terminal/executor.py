from __future__ import annotations

from app.executors.base import RemoteExecutionResult
from app.executors.jupyter_terminal.transport import JupyterEndpoint, JupyterTransport
from app.executors.queued_session import QueuedRemoteSession


class JupyterTerminalExecutor:
    def __init__(self):
        self._sessions: dict[str, QueuedRemoteSession] = {}

    def _session(self, base_url: str, token: str) -> QueuedRemoteSession:
        endpoint = JupyterEndpoint(base_url=base_url.rstrip("/"), token=token)
        if endpoint.key not in self._sessions:
            self._sessions[endpoint.key] = QueuedRemoteSession(JupyterTransport(endpoint))
        return self._sessions[endpoint.key]

    async def run(self, base_url: str, token: str, script: str, timeout_ms: int | None = None) -> RemoteExecutionResult:
        return await self._session(base_url, token).run_script(script, timeout_ms=timeout_ms)


executor = JupyterTerminalExecutor()
