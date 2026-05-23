from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.executors.jupyter_terminal.executor import executor
from app.schemas import DebugRemoteRunIn, DebugRemoteRunOut

router = APIRouter(prefix="/debug", tags=["debug"])


@router.post("/remote-run", response_model=DebugRemoteRunOut)
async def remote_run(payload: DebugRemoteRunIn):
    settings = get_settings()
    if not settings.enable_debug_remote_run:
        raise HTTPException(status_code=404, detail="Debug remote run is disabled")
    if not settings.jupyter_default_token:
        raise HTTPException(status_code=400, detail="JUPYTER_DEFAULT_TOKEN is not configured")
    result = await executor.run(
        settings.jupyter_default_base_url,
        settings.jupyter_default_token,
        payload.cmd,
        timeout_ms=payload.timeoutMs,
    )
    return DebugRemoteRunOut(
        exitCode=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        generation=result.generation,
    )

