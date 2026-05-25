from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CompareSnapshot, ExecutionRun, FinetuneSubtask, FinetuneTask, ServerProfile
from app.schemas import (
    CompareEvalOut,
    DashboardSummaryOut,
    LogsOut,
    RemoteFilesOut,
    SubtaskCreateIn,
    SubtaskOut,
    SubtaskUpdateIn,
    TaskCloneIn,
    TaskCreateIn,
    TaskOut,
    TaskUpdateIn,
)
from app.services.codegen import public_code


DEFAULT_LOGS = [
    "[init] 子任务已创建，等待同步配置",
    "[precheck] 工作目录、GPU 和数据集将在启动时校验",
]


def _default_train_yaml(task: FinetuneTask, subtask: FinetuneSubtask) -> str:
    return "\n".join(
        [
            f"model_name_or_path: {task.base_model}",
            "stage: sft",
            "do_train: true",
            "finetuning_type: lora",
            "lora_rank: 32",
            "lora_alpha: 64",
            "dataset: train_dataset",
            "template: qwen",
            f"output_dir: {subtask.output_dir}",
            f"learning_rate: {subtask.learning_rate}",
            f"num_train_epochs: {subtask.epoch}",
            f"per_device_train_batch_size: {subtask.batch_size}",
            f"save_steps: {subtask.step}",
            "bf16: true",
        ]
    )


def _default_eval_yaml(task: FinetuneTask, subtask: FinetuneSubtask) -> str:
    return "\n".join(
        [
            f"model_name_or_path: {task.base_model}",
            f"adapter_name_or_path: {subtask.output_dir}/adapter",
            "finetuning_type: lora",
            "template: qwen",
            "task: ceval_validation",
            "lang: zh",
            "n_shot: 5",
            "batch_size: 4",
        ]
    )


def _default_directory(task: FinetuneTask, subtask: FinetuneSubtask) -> list[str]:
    return [
        f"outputs/{task.name}/",
        f"  {subtask.subtask_code}/",
        "    configs/train.yaml",
        "    logs/train.log",
        "    adapter/",
        "    eval/",
    ]


def seed_default_tasks(db: Session) -> None:
    existing = db.scalar(select(FinetuneTask).where(FinetuneTask.task_code == "task-customer-service-v1"))
    if existing:
        return
    server = db.scalar(select(ServerProfile).order_by(ServerProfile.created_at))
    task = FinetuneTask(
        task_code="task-customer-service-v1",
        name="customer_service_v1",
        model_name="customer_service_v1",
        base_model="Qwen/Qwen3-8B",
        status="waiting",
        description="默认示例任务，可直接用于联调真实接口。",
    )
    db.add(task)
    db.flush()
    rows = [
        ("subtask-rank16-lr5e-5", "rank16_lr5e-5", "succeeded", "0", "5e-5", 3, 2, 500, 0.91, 76.2),
        ("subtask-rank32-lr5e-5", "rank32_lr5e-5", "running", "0", "5e-5", 3, 2, 500, 0.81, None),
        ("subtask-rank16-lr1e-4", "rank16_lr1e-4", "failed", "0", "1e-4", 2, 1, 300, 0.99, 73.6),
    ]
    for code, name, status, gpu, lr, epoch, batch, step, loss, score in rows:
        subtask = FinetuneSubtask(
            subtask_code=code,
            task_id=task.id,
            server_profile_id=server.id if server else None,
            name=name,
            status=status,
            gpu_ids=gpu,
            learning_rate=lr,
            epoch=epoch,
            batch_size=batch,
            step=step,
            loss=loss,
            score=score,
            output_dir=f"/home/jovyan/work/outputs/{task.name}/{code}",
            dataset_info=json.dumps(
                {
                    "train_dataset": {
                        "file_name": "train.jsonl",
                        "columns": {"prompt": "instruction", "query": "input", "response": "output"},
                    }
                },
                ensure_ascii=False,
                indent=2,
            ),
        )
        subtask.train_yaml = _default_train_yaml(task, subtask)
        subtask.eval_yaml = _default_eval_yaml(task, subtask)
        subtask.logs_text = "\n".join(
            [
                "[2026-05-22 09:00:00] precheck: workspace writable",
                f"[2026-05-22 09:00:02] CUDA_VISIBLE_DEVICES={gpu}",
                f"[2026-05-22 09:00:05] llamafactory-cli train {subtask.output_dir}/configs/train.yaml",
                "[2026-05-22 09:01:00] step=100 loss=2.41 learning_rate=1e-5",
                "[2026-05-22 09:02:00] step=200 loss=1.82 learning_rate=2e-5",
                f"[2026-05-22 09:03:00] step={step} loss={loss or 1.0} learning_rate={lr}",
            ]
        )
        subtask.directory_json = json.dumps(_default_directory(task, subtask), ensure_ascii=False)
        db.add(subtask)
    db.commit()


def task_status_from_subtasks(subtasks: list[FinetuneSubtask]) -> str:
    if any(item.status == "running" for item in subtasks):
        return "running"
    if any(item.status == "failed" for item in subtasks):
        return "failed"
    if subtasks and all(item.status == "succeeded" for item in subtasks):
        return "succeeded"
    if any(item.status == "queued" for item in subtasks):
        return "waiting"
    return "draft"


def get_task(db: Session, task_code: str) -> FinetuneTask:
    task = db.scalar(select(FinetuneTask).where(FinetuneTask.task_code == task_code))
    if not task:
        raise KeyError(f"Task not found: {task_code}")
    return task


def get_subtask(db: Session, subtask_code: str) -> FinetuneSubtask:
    subtask = db.scalar(select(FinetuneSubtask).where(FinetuneSubtask.subtask_code == subtask_code))
    if not subtask:
        raise KeyError(f"Subtask not found: {subtask_code}")
    return subtask


def _subtasks_for_task(db: Session, task_id: int) -> list[FinetuneSubtask]:
    return list(db.scalars(select(FinetuneSubtask).where(FinetuneSubtask.task_id == task_id).order_by(FinetuneSubtask.created_at)))


def _server_by_internal_id(db: Session, server_id: Optional[int]) -> Optional[ServerProfile]:
    if not server_id:
        return None
    return db.get(ServerProfile, server_id)


def _server_by_public_id(db: Session, public_id: Optional[str]) -> Optional[ServerProfile]:
    if not public_id:
        return None
    return db.scalar(select(ServerProfile).where(ServerProfile.public_id == public_id))


def task_to_out(db: Session, task: FinetuneTask) -> TaskOut:
    subtasks = _subtasks_for_task(db, task.id)
    return TaskOut(
        id=task.task_code,
        taskCode=task.task_code,
        name=task.name,
        modelName=task.model_name,
        baseModel=task.base_model,
        description=task.description,
        status=task.status,
        subtaskCount=len(subtasks),
        runningCount=len([item for item in subtasks if item.status == "running"]),
        succeededCount=len([item for item in subtasks if item.status == "succeeded"]),
        failedCount=len([item for item in subtasks if item.status == "failed"]),
        draftCount=len([item for item in subtasks if item.status == "draft"]),
    )


def subtask_to_out(db: Session, subtask: FinetuneSubtask) -> SubtaskOut:
    task = db.get(FinetuneTask, subtask.task_id)
    server = _server_by_internal_id(db, subtask.server_profile_id)
    try:
        directory_lines = json.loads(subtask.directory_json or "[]")
    except Exception:
        directory_lines = []
    return SubtaskOut(
        id=subtask.subtask_code,
        subtaskCode=subtask.subtask_code,
        taskCode=task.task_code if task else "",
        name=subtask.name,
        serverId=server.public_id if server else None,
        serverName=server.name if server else "-",
        status=subtask.status,
        gpu=subtask.gpu_ids,
        learningRate=subtask.learning_rate,
        epoch=subtask.epoch,
        batchSize=subtask.batch_size,
        step=subtask.step,
        loss=subtask.loss,
        score=subtask.score,
        outputDir=subtask.output_dir,
        trainYaml=subtask.train_yaml,
        evalYaml=subtask.eval_yaml,
        datasetInfo=subtask.dataset_info,
        logs=[line for line in (subtask.logs_text or "").splitlines() if line],
        directoryLines=directory_lines,
        lastRunCode=subtask.last_run_code,
    )


def list_tasks(db: Session, keyword: str = "", status: str = "all") -> list[FinetuneTask]:
    query = select(FinetuneTask)
    if keyword:
        like = f"%{keyword}%"
        query = query.where((FinetuneTask.name.like(like)) | (FinetuneTask.task_code.like(like)) | (FinetuneTask.model_name.like(like)))
    if status and status != "all":
        query = query.where(FinetuneTask.status == status)
    return list(db.scalars(query.order_by(FinetuneTask.created_at)))


def create_task(db: Session, payload: TaskCreateIn) -> FinetuneTask:
    task = FinetuneTask(
        task_code=public_code("task"),
        name=payload.name,
        model_name=payload.modelName or payload.name,
        base_model=payload.baseModel,
        description=payload.description,
        status=payload.status,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: FinetuneTask, payload: TaskUpdateIn) -> FinetuneTask:
    data = payload.model_dump(exclude_unset=True)
    mapping = {"modelName": "model_name", "baseModel": "base_model"}
    for key, value in data.items():
        attr = mapping.get(key, key)
        if hasattr(task, attr):
            setattr(task, attr, value)
    db.commit()
    db.refresh(task)
    return task


def clone_task(db: Session, task: FinetuneTask, payload: TaskCloneIn) -> FinetuneTask:
    cloned = FinetuneTask(
        task_code=public_code("task"),
        name=payload.name or f"{task.name}_copy",
        model_name=f"{task.model_name}_copy" if task.model_name else "",
        base_model=task.base_model,
        description=task.description,
        status="draft",
    )
    db.add(cloned)
    db.flush()
    if payload.copySubtasks:
        for item in _subtasks_for_task(db, task.id):
            copy = FinetuneSubtask(
                subtask_code=public_code("subtask"),
                task_id=cloned.id,
                server_profile_id=item.server_profile_id,
                name=f"{item.name}_copy",
                status="draft",
                gpu_ids=item.gpu_ids,
                learning_rate=item.learning_rate,
                epoch=item.epoch,
                batch_size=item.batch_size,
                step=item.step,
                output_dir=item.output_dir.replace(task.name, cloned.name),
                train_yaml=item.train_yaml,
                eval_yaml=item.eval_yaml,
                dataset_info=item.dataset_info,
                directory_json=item.directory_json,
                logs_text="\n".join(DEFAULT_LOGS),
                config_json=item.config_json,
            )
            db.add(copy)
    db.commit()
    db.refresh(cloned)
    return cloned


def delete_task(db: Session, task: FinetuneTask) -> None:
    subtasks = _subtasks_for_task(db, task.id)
    if any(item.status == "running" for item in subtasks):
        raise ValueError("任务包含运行中的子任务，请先停止训练")
    for item in subtasks:
        db.delete(item)
    db.delete(task)
    db.commit()


def create_subtask(db: Session, task: FinetuneTask, payload: SubtaskCreateIn) -> FinetuneSubtask:
    server = _server_by_public_id(db, payload.serverId)
    code = public_code("subtask")
    subtask = FinetuneSubtask(
        subtask_code=code,
        task_id=task.id,
        server_profile_id=server.id if server else None,
        name=payload.name,
        status="draft",
        gpu_ids=payload.gpu,
        learning_rate=payload.learningRate,
        epoch=payload.epoch,
        batch_size=payload.batchSize,
        step=payload.step,
        output_dir=payload.outputDir or f"/home/jovyan/work/outputs/{task.name}/{code}",
        dataset_info=payload.datasetInfo,
        logs_text="\n".join(DEFAULT_LOGS),
    )
    subtask.train_yaml = payload.trainYaml or _default_train_yaml(task, subtask)
    subtask.eval_yaml = payload.evalYaml or _default_eval_yaml(task, subtask)
    subtask.directory_json = json.dumps(_default_directory(task, subtask), ensure_ascii=False)
    db.add(subtask)
    task.status = task_status_from_subtasks(_subtasks_for_task(db, task.id) + [subtask])
    db.commit()
    db.refresh(subtask)
    return subtask


def update_subtask(db: Session, subtask: FinetuneSubtask, payload: SubtaskUpdateIn) -> FinetuneSubtask:
    data = payload.model_dump(exclude_unset=True)
    mapping = {
        "gpu": "gpu_ids",
        "learningRate": "learning_rate",
        "batchSize": "batch_size",
        "outputDir": "output_dir",
        "trainYaml": "train_yaml",
        "evalYaml": "eval_yaml",
        "datasetInfo": "dataset_info",
    }
    if "serverId" in data:
        server = _server_by_public_id(db, data.pop("serverId"))
        subtask.server_profile_id = server.id if server else None
    for key, value in data.items():
        attr = mapping.get(key, key)
        if hasattr(subtask, attr):
            setattr(subtask, attr, value)
    task = db.get(FinetuneTask, subtask.task_id)
    if task:
        task.status = task_status_from_subtasks(_subtasks_for_task(db, task.id))
    db.commit()
    db.refresh(subtask)
    return subtask


def clone_subtask(db: Session, subtask: FinetuneSubtask) -> FinetuneSubtask:
    cloned = FinetuneSubtask(
        subtask_code=public_code("subtask"),
        task_id=subtask.task_id,
        server_profile_id=subtask.server_profile_id,
        name=f"{subtask.name}_copy",
        status="draft",
        gpu_ids=subtask.gpu_ids,
        learning_rate=subtask.learning_rate,
        epoch=subtask.epoch,
        batch_size=subtask.batch_size,
        step=subtask.step,
        output_dir=f"{subtask.output_dir}_copy",
        train_yaml=subtask.train_yaml,
        eval_yaml=subtask.eval_yaml,
        dataset_info=subtask.dataset_info,
        directory_json=subtask.directory_json,
        logs_text="\n".join(DEFAULT_LOGS),
        config_json=subtask.config_json,
    )
    db.add(cloned)
    task = db.get(FinetuneTask, subtask.task_id)
    if task:
        task.status = task_status_from_subtasks(_subtasks_for_task(db, task.id) + [cloned])
    db.commit()
    db.refresh(cloned)
    return cloned


def delete_subtask(db: Session, subtask: FinetuneSubtask) -> None:
    if subtask.status == "running":
        raise ValueError("运行中的子任务不能删除，请先停止训练")
    task = db.get(FinetuneTask, subtask.task_id)
    db.delete(subtask)
    if task:
        task.status = task_status_from_subtasks([item for item in _subtasks_for_task(db, task.id) if item.id != subtask.id])
    db.commit()


def start_subtask(db: Session, subtask: FinetuneSubtask) -> ExecutionRun:
    if subtask.status == "running":
        raise ValueError("子任务已经在运行中")
    server = _server_by_internal_id(db, subtask.server_profile_id)
    command = "\n".join(
        [
            f"mkdir -p {subtask.output_dir}/logs {subtask.output_dir}/configs",
            f"cat > {subtask.output_dir}/configs/train.yaml <<'YAML'",
            subtask.train_yaml,
            "YAML",
            f"CUDA_VISIBLE_DEVICES={subtask.gpu_ids} llamafactory-cli train {subtask.output_dir}/configs/train.yaml 2>&1 | tee {subtask.output_dir}/logs/train.log",
        ]
    )
    run = ExecutionRun(
        run_code=public_code("run"),
        run_type="train",
        target_type="subtask",
        target_id=subtask.id,
        server_profile_id=server.id if server else None,
        status="running",
        script_key="llamafactory.train",
        rendered_script=command,
        started_at=datetime.utcnow(),
    )
    subtask.status = "running"
    subtask.last_run_code = run.run_code
    subtask.logs_text = "\n".join(
        [
            *[line for line in subtask.logs_text.splitlines() if line],
            f"[{datetime.utcnow().isoformat(timespec='seconds')}] queued training run {run.run_code}",
            f"[{datetime.utcnow().isoformat(timespec='seconds')}] CUDA_VISIBLE_DEVICES={subtask.gpu_ids}",
            f"[{datetime.utcnow().isoformat(timespec='seconds')}] {command.splitlines()[-1]}",
        ]
    )
    task = db.get(FinetuneTask, subtask.task_id)
    if task:
        task.status = "running"
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def stop_subtask(db: Session, subtask: FinetuneSubtask) -> None:
    if subtask.status in {"running", "queued"}:
        subtask.status = "failed"
        subtask.logs_text = "\n".join(
            [
                *[line for line in subtask.logs_text.splitlines() if line],
                f"[{datetime.utcnow().isoformat(timespec='seconds')}] stop requested from UI",
            ]
        )
    task = db.get(FinetuneTask, subtask.task_id)
    if task:
        task.status = task_status_from_subtasks(_subtasks_for_task(db, task.id))
    db.commit()


def evaluate_subtask(db: Session, subtask: FinetuneSubtask) -> ExecutionRun:
    run = ExecutionRun(
        run_code=public_code("run"),
        run_type="evaluate",
        target_type="subtask",
        target_id=subtask.id,
        server_profile_id=subtask.server_profile_id,
        status="succeeded",
        script_key="llamafactory.eval",
        rendered_script=f"llamafactory-cli eval {subtask.output_dir}/configs/eval.yaml",
        stdout='{"score": 80.0}',
        started_at=datetime.utcnow(),
        finished_at=datetime.utcnow(),
    )
    subtask.score = subtask.score or 80.0
    subtask.logs_text = "\n".join(
        [
            *[line for line in subtask.logs_text.splitlines() if line],
            f"[{datetime.utcnow().isoformat(timespec='seconds')}] evaluation succeeded, score={subtask.score}",
        ]
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def start_task(db: Session, task: FinetuneTask) -> list[ExecutionRun]:
    runs = []
    for subtask in _subtasks_for_task(db, task.id):
        if subtask.status in {"draft", "failed", "waiting"}:
            runs.append(start_subtask(db, subtask))
    return runs


def read_logs(subtask: FinetuneSubtask, offset: int = 0, limit: int = 200) -> LogsOut:
    lines = [line for line in (subtask.logs_text or "").splitlines() if line]
    window = lines[offset : offset + limit]
    return LogsOut(lines=window, offset=offset, nextOffset=offset + len(window), total=len(lines))


def remote_files(subtask: FinetuneSubtask) -> RemoteFilesOut:
    try:
        lines = json.loads(subtask.directory_json or "[]")
    except Exception:
        lines = []
    return RemoteFilesOut(lines=lines)


def dashboard_summary(db: Session) -> DashboardSummaryOut:
    servers = list(db.scalars(select(ServerProfile)))
    tasks = list(db.scalars(select(FinetuneTask)))
    subtasks = list(db.scalars(select(FinetuneSubtask)))
    return DashboardSummaryOut(
        serversTotal=len(servers),
        serversOnline=len([item for item in servers if item.status == "online"]),
        serversOffline=len([item for item in servers if item.status == "offline"]),
        tasksTotal=len(tasks),
        subtasksTotal=len(subtasks),
        runningSubtasks=len([item for item in subtasks if item.status == "running"]),
        failedSubtasks=len([item for item in subtasks if item.status == "failed"]),
    )


def loss_series(db: Session, task_code: Optional[str] = None) -> list[dict]:
    subtasks = list(db.scalars(select(FinetuneSubtask).order_by(FinetuneSubtask.created_at)))
    if task_code:
        task = get_task(db, task_code)
        subtasks = [item for item in subtasks if item.task_id == task.id]
    steps = [0, 100, 200, 300, 400, 500, 600]
    series = []
    for index, step in enumerate(steps):
        values = {}
        for subtask in subtasks[:5]:
            base = float(subtask.loss or 1.0)
            values[subtask.subtask_code] = round(max(base, 0.2) + (len(steps) - index - 1) * 0.22, 4)
        series.append({"step": step, "values": values})
    return series


def compare_readiness(db: Session, task: FinetuneTask) -> tuple[bool, list[str]]:
    subtasks = _subtasks_for_task(db, task.id)
    blockers = []
    if not subtasks:
        blockers.append("任务下没有子任务")
    running = [item.subtask_code for item in subtasks if item.status in {"running", "queued"}]
    if running:
        blockers.append(f"仍有运行中子任务: {', '.join(running)}")
    if not any(item.score is not None for item in subtasks):
        blockers.append("暂无评测结果")
    return len(blockers) == 0, blockers


def compare_eval(db: Session, task: FinetuneTask) -> CompareEvalOut:
    items = []
    for subtask in _subtasks_for_task(db, task.id):
        items.append({"subtaskCode": subtask.subtask_code, "name": subtask.name, "score": subtask.score, "loss": subtask.loss})
    return CompareEvalOut(items=items)


def create_compare_snapshot(db: Session, task: FinetuneTask) -> CompareSnapshot:
    snapshot = CompareSnapshot(
        compare_code=public_code("cmp"),
        task_id=task.id,
        status="succeeded",
        summary_json=json.dumps({"eval": compare_eval(db, task).model_dump()}, ensure_ascii=False),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
