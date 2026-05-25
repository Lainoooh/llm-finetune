from __future__ import annotations

from app.executors.base import RemoteExecutionResult
from app.executors.factory import DraftEndpointConfig, remote_executor


class JupyterTerminalExecutor:
    async def run(
        self, base_url: str, token: str, script: str, timeout_ms: int | None = None
    ) -> RemoteExecutionResult:
        config = DraftEndpointConfig(
            access_type="jupyter",
            jupyter_base_url=base_url,
            jupyter_token=token,
        )
        return await remote_executor.run_for_draft(config, script, timeout_ms=timeout_ms)


executor = JupyterTerminalExecutor()
