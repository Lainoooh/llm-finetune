from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.executors.factory import remote_executor
from app.models import ExecutionRun
from app.schemas import ExecutionCreateIn, ExecutionOut, LogsOut
from app.services.codegen import public_code
from app.services.script_service import get_active_script, render_script
from app.services.server_service import get_server_by_public_id

router = APIRouter(prefix="/executions", tags=["executions"])


def execution_to_out(run: ExecutionRun) -> ExecutionOut:
    return ExecutionOut(
        runCode=run.run_code,
        status=run.status,
        runType=run.run_type,
        targetType=run.target_type,
        scriptKey=run.script_key,
        stdout=run.stdout,
        stderr=run.stderr,
        exitCode=run.exit_code,
        errorMessage=run.error_message,
        createdAt=run.created_at.isoformat() if run.created_at else None,
        startedAt=run.started_at.isoformat() if run.started_at else None,
        finishedAt=run.finished_at.isoformat() if run.finished_at else None,
    )


def get_run(db: Session, run_code: str) -> ExecutionRun:
    run = db.scalar(select(ExecutionRun).where(ExecutionRun.run_code == run_code))
    if not run:
        raise KeyError(f"Execution not found: {run_code}")
    return run


@router.post("", response_model=ExecutionOut)
async def create_execution(payload: ExecutionCreateIn, db: Session = Depends(get_db)):
    try:
        server = get_server_by_public_id(db, payload.serverId)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    script_key = payload.scriptKey or "custom.command"
    script_version = None
    if payload.command:
        rendered = payload.command
    else:
        try:
            script = get_active_script(db, payload.scriptKey or "")
            rendered = render_script(script, payload.params)
            script_key = script.key
            script_version = script.version
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    run = ExecutionRun(
        run_code=public_code("run"),
        run_type="manual",
        target_type="server",
        target_id=server.id,
        server_profile_id=server.id,
        status="running",
        script_key=script_key,
        script_version=script_version,
        rendered_script=rendered,
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()

    try:
        result = await remote_executor.run_for_server(server, rendered, timeout_ms=payload.timeoutMs)
        run.status = "succeeded" if result.exit_code == 0 else "failed"
        run.stdout = result.stdout
        run.stderr = result.stderr
        run.exit_code = result.exit_code
        run.finished_at = datetime.utcnow()
    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = datetime.utcnow()
    db.commit()
    db.refresh(run)
    return execution_to_out(run)


@router.get("/{run_code}", response_model=ExecutionOut)
def read_execution(run_code: str, db: Session = Depends(get_db)):
    try:
        return execution_to_out(get_run(db, run_code))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{run_code}/logs", response_model=LogsOut)
def read_execution_logs(run_code: str, offset: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    try:
        run = get_run(db, run_code)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    lines = [line for line in "\n".join([run.stdout or "", run.stderr or "", run.error_message or ""]).splitlines() if line]
    return LogsOut(lines=lines[offset : offset + limit], offset=offset, nextOffset=min(offset + limit, len(lines)), total=len(lines))


@router.get("/{run_code}/stream")
def stream_execution(run_code: str, db: Session = Depends(get_db)):
    try:
        run = get_run(db, run_code)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    lines = [line for line in "\n".join([run.stdout or "", run.stderr or "", run.error_message or ""]).splitlines() if line]
    return Response(content="".join(f"data: {line}\n\n" for line in lines), media_type="text/event-stream")


@router.post("/{run_code}/cancel", response_model=ExecutionOut)
def cancel_execution(run_code: str, db: Session = Depends(get_db)):
    try:
        run = get_run(db, run_code)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if run.status in {"queued", "running"}:
        run.status = "cancelled"
        run.error_message = "用户取消执行"
        run.finished_at = datetime.utcnow()
        db.commit()
        db.refresh(run)
    return execution_to_out(run)
