from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import (
    CompareEvalOut,
    CompareReadinessOut,
    CompareRunOut,
    ExecutionOut,
    LogsOut,
    LossMetricsOut,
    LossPoint,
    RemoteFilesOut,
    SubtaskCreateIn,
    SubtaskOut,
    SubtasksListOut,
    SubtaskUpdateIn,
    TaskCloneIn,
    TaskCreateIn,
    TaskOut,
    TasksListOut,
    TaskUpdateIn,
)
from app.services.task_service import (
    clone_subtask,
    clone_task,
    compare_eval,
    compare_readiness,
    create_compare_snapshot,
    create_subtask,
    create_task,
    delete_subtask,
    delete_task,
    evaluate_subtask,
    get_subtask,
    get_task,
    list_tasks,
    read_logs,
    remote_files,
    loss_series,
    start_subtask,
    start_task,
    stop_subtask,
    subtask_to_out,
    task_to_out,
    update_subtask,
    update_task,
)
from app.models import ExecutionRun
from app.services.codegen import public_code
from app.services.execution_service import run_execution_background
from datetime import datetime

router = APIRouter(tags=["tasks"])


def execution_to_out(run) -> ExecutionOut:
    return ExecutionOut(
        runCode=run.run_code,
        status=run.status,
        runType=run.run_type,
        targetType=run.target_type,
        scriptKey=run.script_key,
        stdout=run.stdout,
        stderr=run.stderr,
        errorMessage=run.error_message,
        createdAt=run.created_at.isoformat() if run.created_at else None,
        startedAt=run.started_at.isoformat() if run.started_at else None,
        finishedAt=run.finished_at.isoformat() if run.finished_at else None,
    )


@router.get("/tasks", response_model=TasksListOut)
def get_tasks(keyword: str = "", status: str = "all", db: Session = Depends(get_db)):
    items = [task_to_out(db, task) for task in list_tasks(db, keyword=keyword, status=status)]
    return TasksListOut(items=items, total=len(items))


@router.post("/tasks", response_model=TaskOut)
def post_task(payload: TaskCreateIn, db: Session = Depends(get_db)):
    return task_to_out(db, create_task(db, payload))


@router.get("/tasks/{task_code}", response_model=TaskOut)
def get_task_detail(task_code: str, db: Session = Depends(get_db)):
    try:
        return task_to_out(db, get_task(db, task_code))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/tasks/{task_code}", response_model=TaskOut)
def patch_task(task_code: str, payload: TaskUpdateIn, db: Session = Depends(get_db)):
    try:
        return task_to_out(db, update_task(db, get_task(db, task_code), payload))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tasks/{task_code}/clone", response_model=TaskOut)
def post_task_clone(task_code: str, payload: TaskCloneIn = TaskCloneIn(), db: Session = Depends(get_db)):
    try:
        return task_to_out(db, clone_task(db, get_task(db, task_code), payload))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/tasks/{task_code}")
def remove_task(task_code: str, db: Session = Depends(get_db)):
    try:
        delete_task(db, get_task(db, task_code))
        return {"ok": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/tasks/{task_code}/start", response_model=list[ExecutionOut])
def post_task_start(task_code: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        runs = start_task(db, get_task(db, task_code))
        for run in runs:
            background_tasks.add_task(run_execution_background, run.run_code)
        return [execution_to_out(run) for run in runs]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/tasks/{task_code}/summary", response_model=TaskOut)
def get_task_summary(task_code: str, db: Session = Depends(get_db)):
    return get_task_detail(task_code, db)


@router.get("/tasks/{task_code}/subtasks", response_model=SubtasksListOut)
def get_subtasks(task_code: str, db: Session = Depends(get_db)):
    try:
        task = get_task(db, task_code)
        subtasks = [subtask_to_out(db, item) for item in db.query(get_subtask_model()).filter(get_subtask_model().task_id == task.id).all()]
        return SubtasksListOut(items=subtasks, total=len(subtasks))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def get_subtask_model():
    from app.models import FinetuneSubtask

    return FinetuneSubtask


@router.post("/tasks/{task_code}/subtasks", response_model=SubtaskOut)
def post_subtask(task_code: str, payload: SubtaskCreateIn, db: Session = Depends(get_db)):
    try:
        return subtask_to_out(db, create_subtask(db, get_task(db, task_code), payload))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/subtasks/{subtask_code}", response_model=SubtaskOut)
def get_subtask_detail(subtask_code: str, db: Session = Depends(get_db)):
    try:
        return subtask_to_out(db, get_subtask(db, subtask_code))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/subtasks/{subtask_code}", response_model=SubtaskOut)
def patch_subtask(subtask_code: str, payload: SubtaskUpdateIn, db: Session = Depends(get_db)):
    try:
        return subtask_to_out(db, update_subtask(db, get_subtask(db, subtask_code), payload))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/subtasks/{subtask_code}/config", response_model=SubtaskOut)
def patch_subtask_config(subtask_code: str, payload: SubtaskUpdateIn, db: Session = Depends(get_db)):
    return patch_subtask(subtask_code, payload, db)


@router.patch("/subtasks/{subtask_code}/train-params", response_model=SubtaskOut)
def patch_subtask_train_params(subtask_code: str, payload: SubtaskUpdateIn, db: Session = Depends(get_db)):
    return patch_subtask(subtask_code, payload, db)


@router.get("/subtasks/{subtask_code}/yaml", response_model=SubtaskOut)
def get_subtask_yaml(subtask_code: str, db: Session = Depends(get_db)):
    return get_subtask_detail(subtask_code, db)


@router.patch("/subtasks/{subtask_code}/yaml", response_model=SubtaskOut)
def patch_subtask_yaml(subtask_code: str, payload: SubtaskUpdateIn, db: Session = Depends(get_db)):
    return patch_subtask(subtask_code, payload, db)


@router.get("/subtasks/{subtask_code}/datasets", response_model=SubtaskOut)
def get_subtask_datasets(subtask_code: str, db: Session = Depends(get_db)):
    return get_subtask_detail(subtask_code, db)


@router.post("/subtasks/{subtask_code}/datasets", response_model=SubtaskOut)
def post_subtask_datasets(subtask_code: str, payload: SubtaskUpdateIn, db: Session = Depends(get_db)):
    return patch_subtask(subtask_code, payload, db)


@router.post("/subtasks/{subtask_code}/files")
def post_subtask_files(subtask_code: str, db: Session = Depends(get_db)):
    try:
        subtask = get_subtask(db, subtask_code)
        subtask.logs_text = "\n".join([*subtask.logs_text.splitlines(), "[files] 文件元数据已记录，等待真实上传接入"])
        db.commit()
        return {"ok": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/subtasks/{subtask_code}/sync", response_model=ExecutionOut)
def post_subtask_sync(subtask_code: str, db: Session = Depends(get_db)):
    try:
        subtask = get_subtask(db, subtask_code)
        run = ExecutionRun(
            run_code=public_code("run"),
            run_type="sync",
            target_type="subtask",
            target_id=subtask.id,
            server_profile_id=subtask.server_profile_id,
            status="succeeded",
            script_key="subtask.sync",
            rendered_script=f"write train/eval yaml and dataset_info into {subtask.output_dir}",
            stdout="配置同步记录已保存；真实远程写入将通过脚本队列执行。",
            started_at=datetime.utcnow(),
            finished_at=datetime.utcnow(),
        )
        subtask.logs_text = "\n".join([*subtask.logs_text.splitlines(), f"[{datetime.utcnow().isoformat(timespec='seconds')}] sync config to {subtask.output_dir}"])
        db.add(run)
        db.commit()
        db.refresh(run)
        return execution_to_out(run)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/subtasks/{subtask_code}/start", response_model=ExecutionOut)
def post_subtask_start(subtask_code: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        run = start_subtask(db, get_subtask(db, subtask_code))
        background_tasks.add_task(run_execution_background, run.run_code)
        return execution_to_out(run)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/subtasks/{subtask_code}/stop")
def post_subtask_stop(subtask_code: str, db: Session = Depends(get_db)):
    try:
        stop_subtask(db, get_subtask(db, subtask_code))
        return {"ok": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/subtasks/{subtask_code}/evaluate", response_model=ExecutionOut)
def post_subtask_evaluate(subtask_code: str, db: Session = Depends(get_db)):
    try:
        return execution_to_out(evaluate_subtask(db, get_subtask(db, subtask_code)))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/subtasks/{subtask_code}/clone", response_model=SubtaskOut)
def post_subtask_clone(subtask_code: str, db: Session = Depends(get_db)):
    try:
        return subtask_to_out(db, clone_subtask(db, get_subtask(db, subtask_code)))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/subtasks/{subtask_code}")
def remove_subtask(subtask_code: str, db: Session = Depends(get_db)):
    try:
        delete_subtask(db, get_subtask(db, subtask_code))
        return {"ok": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/subtasks/{subtask_code}/logs", response_model=LogsOut)
def get_logs(subtask_code: str, offset: int = 0, limit: int = Query(200, le=1000), db: Session = Depends(get_db)):
    try:
        return read_logs(get_subtask(db, subtask_code), offset=offset, limit=limit)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/subtasks/{subtask_code}/logs/download")
def download_logs(subtask_code: str, db: Session = Depends(get_db)):
    try:
        subtask = get_subtask(db, subtask_code)
        return Response(content=subtask.logs_text or "", media_type="text/plain")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/subtasks/{subtask_code}/logs/stream")
def stream_logs(subtask_code: str, db: Session = Depends(get_db)):
    try:
        subtask = get_subtask(db, subtask_code)
        lines = [f"data: {line}\n\n" for line in (subtask.logs_text or "").splitlines()]
        return Response(content="".join(lines), media_type="text/event-stream")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/subtasks/{subtask_code}/remote-files", response_model=RemoteFilesOut)
def get_remote_files(subtask_code: str, db: Session = Depends(get_db)):
    try:
        return remote_files(get_subtask(db, subtask_code))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/subtasks/{subtask_code}/eval-config", response_model=SubtaskOut)
def get_eval_config(subtask_code: str, db: Session = Depends(get_db)):
    return get_subtask_detail(subtask_code, db)


@router.get("/tasks/{task_code}/compare-readiness", response_model=CompareReadinessOut)
def get_compare_readiness(task_code: str, db: Session = Depends(get_db)):
    try:
        ready, blockers = compare_readiness(db, get_task(db, task_code))
        return CompareReadinessOut(ready=ready, blockers=blockers)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/tasks/{task_code}/compare/eval", response_model=CompareEvalOut)
def get_compare_eval(task_code: str, db: Session = Depends(get_db)):
    try:
        return compare_eval(db, get_task(db, task_code))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/tasks/{task_code}/compare/loss", response_model=LossMetricsOut)
def get_compare_loss(task_code: str, db: Session = Depends(get_db)):
    try:
        get_task(db, task_code)
        return LossMetricsOut(series=[LossPoint(step=item["step"], values=item["values"]) for item in loss_series(db, task_code)])
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/tasks/{task_code}/compare/export")
def export_compare(task_code: str, db: Session = Depends(get_db)):
    try:
        task = get_task(db, task_code)
        rows = compare_eval(db, task).items
        lines = [f"# {task.name} 对比报告", "", "| 子任务 | Loss | 评测分 |", "| --- | --- | --- |"]
        for item in rows:
            lines.append(f"| {item['name']} | {item.get('loss') or '-'} | {item.get('score') or '-'} |")
        return Response(content="\n".join(lines), media_type="text/markdown")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tasks/{task_code}/compare/run", response_model=CompareRunOut)
def post_compare_run(task_code: str, db: Session = Depends(get_db)):
    try:
        snapshot = create_compare_snapshot(db, get_task(db, task_code))
        return CompareRunOut(compareCode=snapshot.compare_code, status=snapshot.status)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
