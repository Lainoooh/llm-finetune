from __future__ import annotations

from datetime import datetime

from app.db.session import SessionLocal
from app.executors.factory import remote_executor
from app.models import ExecutionRun, FinetuneSubtask, FinetuneTask, ServerProfile
from app.services.task_service import task_status_from_subtasks


async def run_execution_background(run_code: str) -> None:
    with SessionLocal() as db:
        run = db.query(ExecutionRun).filter(ExecutionRun.run_code == run_code).first()
        if not run:
            return
        server = db.get(ServerProfile, run.server_profile_id) if run.server_profile_id else None
        if not server:
            run.status = "failed"
            run.error_message = "执行记录未绑定服务器"
            run.finished_at = datetime.utcnow()
            db.commit()
            return
        run.status = "running"
        run.started_at = run.started_at or datetime.utcnow()
        db.commit()

    try:
        result = await remote_executor.run_for_server(server, run.rendered_script, timeout_ms=120_000)
        status = "succeeded" if result.exit_code == 0 else "failed"
        stdout = result.stdout
        stderr = result.stderr
        exit_code = result.exit_code
        error_message = ""
    except Exception as exc:
        status = "failed"
        stdout = ""
        stderr = ""
        exit_code = None
        error_message = str(exc)

    with SessionLocal() as db:
        run = db.query(ExecutionRun).filter(ExecutionRun.run_code == run_code).first()
        if not run:
            return
        run.status = status
        run.stdout = stdout
        run.stderr = stderr
        run.exit_code = exit_code
        run.error_message = error_message
        run.finished_at = datetime.utcnow()
        if run.target_type == "subtask" and run.target_id:
            subtask = db.get(FinetuneSubtask, run.target_id)
            if subtask:
                subtask.logs_text = "\n".join(
                    [
                        *[line for line in (subtask.logs_text or "").splitlines() if line],
                        *[line for line in stdout.splitlines() if line],
                        *[line for line in stderr.splitlines() if line],
                        *([f"[error] {error_message}"] if error_message else []),
                    ]
                )
                if run.run_type == "train":
                    subtask.status = "succeeded" if status == "succeeded" else "failed"
                task = db.get(FinetuneTask, subtask.task_id)
                if task:
                    subtasks = db.query(FinetuneSubtask).filter(FinetuneSubtask.task_id == task.id).all()
                    task.status = task_status_from_subtasks(subtasks)
        db.commit()
