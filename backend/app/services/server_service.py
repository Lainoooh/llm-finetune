from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.executors.factory import DraftEndpointConfig, remote_executor
from app.models import ExecutionRun, ServerProbeItem, ServerProbeTask, ServerProfile
from app.schemas import ProbeDraftIn, ProbeItemOut, ProbeTaskOut, ServerCreateIn, ServerOut, ServerUpdateIn
from app.services.codegen import public_code
from app.services.script_service import get_active_script, render_script


TERMINAL_STATUSES = {"succeeded", "failed"}


@dataclass
class ProbeTarget:
    public_id: str
    name: str
    access_type: str
    host: str
    user: str
    password: str
    ssh_port: int
    ssh_key: str
    jupyter_base_url: str
    jupyter_token: str
    work_dir: str
    gpu_ids: str
    finetune_tool_name: str
    finetune_tool_container_name: str


def seed_default_server(db: Session) -> None:
    settings = get_settings()
    existing = db.scalar(select(ServerProfile).where(ServerProfile.public_id == "srv-jupyter-default"))
    if existing:
        if settings.jupyter_default_token and not existing.jupyter_token:
            existing.jupyter_token = settings.jupyter_default_token
        if settings.jupyter_default_base_url and not existing.jupyter_base_url:
            existing.jupyter_base_url = settings.jupyter_default_base_url
        db.commit()
        return

    db.add(
        ServerProfile(
            public_id="srv-jupyter-default",
            name="Jupyter-LLaMAFactory-容器",
            host="47.94.137.97:30009",
            user="root",
            password="",
            access_type="jupyter",
            jupyter_base_url=settings.jupyter_default_base_url,
            jupyter_token=settings.jupyter_default_token,
            gpu_ids="0",
            work_dir="/home/jovyan/work",
            finetune_tool_container_name="",
            status="unknown",
        )
    )
    db.commit()


def server_to_out(server: ServerProfile) -> ServerOut:
    try:
        tools = json.loads(server.finetune_tools_json or "{}")
    except Exception:
        tools = {}
    accelerator_count = _accelerator_count(server.gpu, server.gpu_ids)
    return ServerOut(
        id=server.public_id,
        name=server.name,
        accessType=server.access_type or "jupyter",
        host=server.host,
        user=server.user,
        password=server.password,
        sshPort=server.ssh_port or 22,
        sshKey=server.ssh_key or "",
        jupyterBaseUrl=server.jupyter_base_url,
        token=server.jupyter_token,
        status=server.status,
        gpu=server.gpu,
        gpuIds=server.gpu_ids,
        cuda=server.cuda,
        torch=server.torch,
        accelerator=server.gpu,
        acceleratorVendor=_infer_accelerator_vendor(server.gpu),
        acceleratorRuntime=server.cuda,
        acceleratorIds=server.gpu_ids,
        acceleratorCount=accelerator_count,
        aiFramework=server.torch,
        finetuneToolName=server.finetune_tool_name,
        finetuneToolContainerName=server.finetune_tool_container_name,
        finetuneTools=tools,
        workDir=server.work_dir,
        disk=server.disk,
        diskUsed=server.disk_used,
        diskTotal=server.disk_total,
        lastError=server.last_error,
    )


def list_servers(db: Session, keyword: str = "", status: str = "all") -> list[ServerProfile]:
    query = select(ServerProfile)
    if keyword:
        like = f"%{keyword}%"
        query = query.where((ServerProfile.name.like(like)) | (ServerProfile.host.like(like)) | (ServerProfile.public_id.like(like)))
    if status and status != "all":
        query = query.where(ServerProfile.status == status)
    return list(db.scalars(query.order_by(ServerProfile.created_at)))


def get_server_by_public_id(db: Session, public_id: str) -> ServerProfile:
    server = db.scalar(select(ServerProfile).where(ServerProfile.public_id == public_id))
    if not server:
        raise KeyError(f"Server not found: {public_id}")
    return server


def _parse_ssh_address(host_value: str, user_value: str = "", port_value: int = 22) -> tuple[str, str, int]:
    value = (host_value or "").strip()
    user = (user_value or "").strip()
    port = int(port_value or 22)
    if "@" in value:
        maybe_user, value = value.rsplit("@", 1)
        if maybe_user.strip():
            user = maybe_user.strip()
    if value.count(":") == 1:
        maybe_host, maybe_port = value.rsplit(":", 1)
        if maybe_port.isdigit():
            value = maybe_host
            port = int(maybe_port)
    return value, user, port


def create_server(db: Session, payload: ServerCreateIn) -> ServerProfile:
    host, user, port = _parse_ssh_address(payload.host, payload.user, payload.sshPort or 22)
    server = ServerProfile(
        public_id=public_code("srv"),
        name=payload.name,
        host=host,
        user=user,
        password=payload.password,
        access_type=payload.accessType,
        ssh_port=port,
        ssh_key=payload.sshKey or "",
        jupyter_base_url=payload.jupyterBaseUrl or get_settings().jupyter_default_base_url,
        jupyter_token=payload.token or "",
        work_dir=payload.workDir,
        gpu_ids=payload.gpuIds,
        finetune_tool_name=payload.finetuneToolName,
        finetune_tool_container_name=payload.finetuneToolContainerName,
        status="unknown",
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def update_server(db: Session, server: ServerProfile, payload: ServerUpdateIn) -> ServerProfile:
    data = payload.model_dump(exclude_unset=True)
    field_map = {
        "workDir": "work_dir",
        "gpuIds": "gpu_ids",
        "finetuneToolName": "finetune_tool_name",
        "finetuneToolContainerName": "finetune_tool_container_name",
        "jupyterBaseUrl": "jupyter_base_url",
        "token": "jupyter_token",
        "accessType": "access_type",
        "sshPort": "ssh_port",
        "sshKey": "ssh_key",
    }
    for key, value in data.items():
        attr = field_map.get(key, key)
        if attr == "jupyter_token" and value in (None, ""):
            continue
        if hasattr(server, attr):
            setattr(server, attr, value)
    if "host" in data or "user" in data or "sshPort" in data:
        server.host, server.user, server.ssh_port = _parse_ssh_address(server.host, server.user, server.ssh_port or 22)
    db.commit()
    db.refresh(server)
    return server


def delete_server(db: Session, server: ServerProfile) -> None:
    db.delete(server)
    db.commit()


def _extract_json(stdout: str) -> dict[str, Any]:
    cleaned = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", stdout).replace("\r", "")
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError(f"No JSON object found in remote output: {cleaned[:500]}")
    return json.loads(cleaned[start : end + 1])


def _parse_torch_info(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        return json.loads(str(raw))
    except Exception:
        return {}


def _split_accelerator_ids(value: str) -> list[str]:
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def _infer_accelerator_vendor(summary: str) -> str:
    text = str(summary or "").lower()
    if "nvidia" in text or "cuda" in text:
        return "nvidia"
    if "ascend" in text or "huawei" in text or "npu" in text:
        return "huawei"
    if "ppu" in text or "aliyun" in text or "alibaba" in text:
        return "alibaba"
    return "unknown"


def _accelerator_count(summary: str, selected_ids: str) -> int:
    ids = _split_accelerator_ids(selected_ids)
    if ids:
        return len(ids)
    text = str(summary or "").strip()
    if not text or text == "-":
        return 0
    match = re.match(r"^(\d+)\s*[×xX]", text)
    if match:
        return int(match.group(1))
    if " / " in text:
        return len([part for part in text.split(" / ") if part.strip()])
    return 1


def _parse_gpu_summary(gpus_csv: str, selected_gpu_ids: str) -> str:
    rows = []
    selected = {item.strip() for item in selected_gpu_ids.split(",") if item.strip()}
    for line in (gpus_csv or "").splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) >= 2:
            if selected and parts[0] not in selected:
                continue
            rows.append(parts)
    if not rows:
        return "-"
    names = {row[1] for row in rows}
    if len(names) == 1:
        return f"{len(rows)} × {rows[0][1]}"
    return " / ".join(f"设备{row[0]} {row[1]}" for row in rows)


def _format_disk(disk: dict[str, Any] | None) -> tuple[str, float | None, float | None]:
    if not disk:
        return "-", None, None
    size = float(disk.get("size") or 0)
    used = float(disk.get("used") or 0)
    if size <= 0:
        return "-", None, None
    size_tb = size / 1024**4
    used_tb = used / 1024**4
    return f"{used_tb:.1f}TB / {size_tb:.1f}TB", round(used_tb, 2), round(size_tb, 2)


def _format_accelerator_runtime(raw_runtime: Any, torch_info: dict[str, Any]) -> str:
    runtime = str(raw_runtime or "").strip()
    cuda_version = str(torch_info.get("cuda") or "").strip()
    if runtime.lower() == "cuda":
        return f"CUDA {cuda_version}" if cuda_version else "CUDA"
    if runtime and runtime != "-":
        return runtime
    return cuda_version or "-"


def _normalize_probe(raw: dict[str, Any], server: ServerProfile) -> dict[str, Any]:
    torch_info = _parse_torch_info(raw.get("torch_info"))
    disk_text, disk_used, disk_total = _format_disk(raw.get("disk"))
    llama_version = str(raw.get("llamafactory") or "").strip() or "-"
    selected_ids = str(raw.get("accelerator_ids") or raw.get("selected_gpu_ids") or server.gpu_ids or "")
    accelerator_csv = str(raw.get("accelerators_csv") or raw.get("gpus_csv") or "")
    accelerator_runtime = _format_accelerator_runtime(raw.get("accelerator_runtime"), torch_info)
    ai_framework = str(raw.get("ai_framework") or torch_info.get("torch") or "-")
    return {
        "gpu": _parse_gpu_summary(accelerator_csv, selected_ids),
        "cuda": accelerator_runtime,
        "torch": ai_framework,
        "finetune_tools": {server.finetune_tool_name: llama_version} if llama_version != "-" else {},
        "disk": disk_text,
        "disk_used": disk_used,
        "disk_total": disk_total,
        "status": "online",
    }


def _target_from_server(server: ServerProfile) -> ProbeTarget:
    return ProbeTarget(
        public_id=server.public_id,
        name=server.name,
        access_type=server.access_type or "jupyter",
        host=server.host,
        user=server.user,
        password=server.password,
        ssh_port=server.ssh_port or 22,
        ssh_key=server.ssh_key or "",
        jupyter_base_url=server.jupyter_base_url,
        jupyter_token=server.jupyter_token,
        work_dir=server.work_dir,
        gpu_ids=server.gpu_ids,
        finetune_tool_name=server.finetune_tool_name,
        finetune_tool_container_name=server.finetune_tool_container_name,
    )


def _target_from_draft(draft: ProbeDraftIn) -> ProbeTarget:
    settings = get_settings()
    host, user, port = _parse_ssh_address(draft.host, draft.user, draft.sshPort or 22)
    return ProbeTarget(
        public_id="draft",
        name=draft.name,
        access_type=draft.accessType or "jupyter",
        host=host,
        user=user,
        password=draft.password,
        ssh_port=port,
        ssh_key=draft.sshKey or "",
        jupyter_base_url=draft.jupyterBaseUrl or settings.jupyter_default_base_url,
        jupyter_token=draft.token or settings.jupyter_default_token,
        work_dir=draft.workDir,
        gpu_ids=draft.gpuIds,
        finetune_tool_name=draft.finetuneToolName,
        finetune_tool_container_name=draft.finetuneToolContainerName,
    )


def _profile_from_target(target: ProbeTarget) -> ServerProfile:
    return ServerProfile(
        public_id=target.public_id,
        name=target.name,
        host=target.host,
        user=target.user,
        password=target.password,
        access_type=target.access_type,
        ssh_port=target.ssh_port,
        ssh_key=target.ssh_key,
        jupyter_base_url=target.jupyter_base_url,
        jupyter_token=target.jupyter_token,
        work_dir=target.work_dir,
        gpu_ids=target.gpu_ids,
        finetune_tool_name=target.finetune_tool_name,
        finetune_tool_container_name=target.finetune_tool_container_name,
        status="unknown",
        gpu="-",
        cuda="-",
        torch="-",
        disk="-",
        last_error="",
    )


def _endpoint_from_target(target: ProbeTarget) -> DraftEndpointConfig:
    return DraftEndpointConfig(
        access_type=target.access_type,
        host=target.host,
        user=target.user,
        password=target.password,
        ssh_port=target.ssh_port,
        ssh_key=target.ssh_key,
        jupyter_base_url=target.jupyter_base_url,
        jupyter_token=target.jupyter_token,
    )


def _normalize_hardware(raw: dict[str, Any], target: ProbeTarget) -> dict[str, Any]:
    temp = _profile_from_target(target)
    disk_text, disk_used, disk_total = _format_disk(raw.get("disk"))
    gpu = _parse_gpu_summary(str(raw.get("accelerators_csv") or raw.get("gpus_csv") or ""), target.gpu_ids)
    driver = str(raw.get("accelerator_driver") or raw.get("driver") or "-")
    return {
        "gpu": gpu,
        "gpuIds": target.gpu_ids,
        "accelerator": gpu,
        "acceleratorVendor": raw.get("accelerator_vendor") or _infer_accelerator_vendor(gpu),
        "acceleratorRuntime": driver if driver == "-" else f"Driver {driver}",
        "acceleratorIds": target.gpu_ids,
        "acceleratorCount": _accelerator_count(gpu, target.gpu_ids),
        "driverVersion": driver,
        "workDir": raw.get("work_dir") or target.work_dir,
        "workDirExists": bool(raw.get("work_dir_exists")),
        "workDirWritable": bool(raw.get("work_dir_writable")),
        "disk": disk_text,
        "diskUsed": disk_used,
        "diskTotal": disk_total,
        "status": "online",
        "timings": raw.get("timings") or {},
        "_temp": temp,
    }


def _normalize_finetune_env(raw: dict[str, Any], target: ProbeTarget) -> tuple[dict[str, Any], str]:
    if raw.get("ok") is False:
        return {
            "containerName": raw.get("container_name") or target.finetune_tool_container_name,
            "finetuneToolName": target.finetune_tool_name,
            "timings": raw.get("timings") or {},
        }, str(raw.get("error") or "微调环境探测失败")
    tool_version = str(raw.get("finetune_tool_version") or "-")
    python_version = str(raw.get("python") or "-")
    pytorch = str(raw.get("pytorch") or "-")
    transformers = str(raw.get("transformers") or "-")
    env_summary = f"Python {python_version} / PyTorch {pytorch} / Transformers {transformers}"
    return {
        "containerName": raw.get("container_name") or target.finetune_tool_container_name,
        "python": python_version,
        "pytorch": pytorch,
        "transformers": transformers,
        "torch": pytorch,
        "aiFramework": pytorch,
        "finetuneToolName": target.finetune_tool_name,
        "finetuneToolVersion": tool_version,
        "finetuneTools": {target.finetune_tool_name: tool_version} if tool_version != "-" else {},
        "finetuneEnv": env_summary,
        "timings": raw.get("timings") or {},
    }, ""


async def probe_server(db: Session, server: ServerProfile) -> tuple[ServerProfile, dict[str, Any], ExecutionRun]:
    script = get_active_script(db, "server.probe_env")
    rendered = render_script(script, {"work_dir": server.work_dir, "gpu_ids": server.gpu_ids})
    run = ExecutionRun(
        run_code=public_code("run"),
        run_type="server_probe",
        target_type="server",
        target_id=server.id,
        server_profile_id=server.id,
        status="running",
        script_key=script.key,
        script_version=script.version,
        rendered_script=rendered,
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()

    try:
        result = await remote_executor.run_for_server(server, rendered, timeout_ms=script.timeout_ms)
        raw = _extract_json(result.stdout)
        normalized = _normalize_probe(raw, server)
        server.gpu = normalized["gpu"]
        server.cuda = normalized["cuda"]
        server.torch = normalized["torch"]
        server.finetune_tools_json = json.dumps(normalized["finetune_tools"], ensure_ascii=False)
        server.disk = normalized["disk"]
        server.disk_used = normalized["disk_used"]
        server.disk_total = normalized["disk_total"]
        server.status = "online"
        server.last_error = ""
        server.last_probe_at = datetime.utcnow()
        run.status = "succeeded"
        run.stdout = result.stdout
        run.stderr = result.stderr
        run.exit_code = result.exit_code
        run.finished_at = datetime.utcnow()
        db.commit()
        return server, raw, run
    except Exception as exc:
        server.status = "offline"
        server.last_error = str(exc)
        server.last_probe_at = datetime.utcnow()
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = datetime.utcnow()
        db.commit()
        raise


async def probe_draft(db: Session, draft: ProbeDraftIn) -> tuple[ServerOut, dict[str, Any]]:
    settings = get_settings()
    temp = ServerProfile(
        public_id="draft",
        name=draft.name,
        host=draft.host,
        user=draft.user,
        password=draft.password,
        access_type=draft.accessType,
        ssh_port=draft.sshPort or 22,
        ssh_key=draft.sshKey or "",
        jupyter_base_url=draft.jupyterBaseUrl or settings.jupyter_default_base_url,
        jupyter_token=draft.token or settings.jupyter_default_token,
        work_dir=draft.workDir,
        gpu_ids=draft.gpuIds,
        finetune_tool_name=draft.finetuneToolName,
    )
    script = get_active_script(db, "server.probe_env")
    rendered = render_script(script, {"work_dir": temp.work_dir, "gpu_ids": temp.gpu_ids})
    result = await remote_executor.run_for_draft(
        DraftEndpointConfig(
            access_type=temp.access_type,
            host=temp.host,
            user=temp.user,
            password=temp.password,
            ssh_port=temp.ssh_port,
            ssh_key=temp.ssh_key,
            jupyter_base_url=temp.jupyter_base_url,
            jupyter_token=temp.jupyter_token,
        ),
        rendered,
        timeout_ms=script.timeout_ms,
    )
    raw = _extract_json(result.stdout)
    normalized = _normalize_probe(raw, temp)
    temp.gpu = normalized["gpu"]
    temp.cuda = normalized["cuda"]
    temp.torch = normalized["torch"]
    temp.finetune_tools_json = json.dumps(normalized["finetune_tools"], ensure_ascii=False)
    temp.disk = normalized["disk"]
    temp.disk_used = normalized["disk_used"]
    temp.disk_total = normalized["disk_total"]
    temp.status = "online"
    return server_to_out(temp), raw


def _item_to_out(item: ServerProbeItem | None) -> ProbeItemOut:
    if not item:
        return ProbeItemOut()
    try:
        data = json.loads(item.data_json or "{}")
    except Exception:
        data = {}
    try:
        raw = json.loads(item.raw_json or "{}")
    except Exception:
        raw = {}
    return ProbeItemOut(status=item.status, data=data, raw=raw, error=item.error_message or "")


def probe_task_to_out(db: Session, task: ServerProbeTask) -> ProbeTaskOut:
    items = list(db.scalars(select(ServerProbeItem).where(ServerProbeItem.probe_task_id == task.id)))
    try:
        snapshot = json.loads(task.server_snapshot_json or "{}")
    except Exception:
        snapshot = {}
    server = None
    if snapshot:
        server = server_to_out(_profile_from_target(ProbeTarget(**snapshot)))
        for item in items:
            if item.status != "succeeded":
                continue
            try:
                data = json.loads(item.data_json or "{}")
            except Exception:
                data = {}
            if item.item_type == "hardware":
                server.gpu = data.get("gpu", server.gpu)
                server.accelerator = data.get("accelerator", server.accelerator)
                server.acceleratorVendor = data.get("acceleratorVendor", server.acceleratorVendor)
                server.acceleratorRuntime = data.get("acceleratorRuntime", server.acceleratorRuntime)
                server.acceleratorIds = data.get("acceleratorIds", server.acceleratorIds)
                server.acceleratorCount = data.get("acceleratorCount", server.acceleratorCount)
                server.disk = data.get("disk", server.disk)
                server.diskUsed = data.get("diskUsed", server.diskUsed)
                server.diskTotal = data.get("diskTotal", server.diskTotal)
                server.status = "online"
            elif item.item_type == "finetuneEnv":
                server.torch = data.get("torch", server.torch)
                server.aiFramework = data.get("aiFramework", server.aiFramework)
                server.finetuneTools = data.get("finetuneTools", server.finetuneTools)
    by_type = {item.item_type: _item_to_out(item) for item in items}
    by_type.setdefault("hardware", ProbeItemOut())
    by_type.setdefault("finetuneEnv", ProbeItemOut())
    return ProbeTaskOut(probeCode=task.probe_code, status=task.status, server=server, items=by_type)


def get_probe_task(db: Session, probe_code: str) -> ServerProbeTask:
    task = db.scalar(select(ServerProbeTask).where(ServerProbeTask.probe_code == probe_code))
    if not task:
        raise KeyError(f"Probe task not found: {probe_code}")
    return task


def create_probe_task_for_draft(db: Session, draft: ProbeDraftIn) -> ProbeTaskOut:
    target = _target_from_draft(draft)
    return _create_probe_task(db, target, target_type="draft", server_profile_id=None)


def create_probe_task_for_server(db: Session, server: ServerProfile) -> ProbeTaskOut:
    target = _target_from_server(server)
    return _create_probe_task(db, target, target_type="server", server_profile_id=server.id)


def _create_probe_task(db: Session, target: ProbeTarget, target_type: str, server_profile_id: int | None) -> ProbeTaskOut:
    task = ServerProbeTask(
        probe_code=public_code("probe"),
        target_type=target_type,
        server_profile_id=server_profile_id,
        status="running",
        request_json=json.dumps(asdict(target), ensure_ascii=False),
        server_snapshot_json=json.dumps(asdict(target), ensure_ascii=False),
    )
    db.add(task)
    db.flush()
    db.add_all(
        [
            ServerProbeItem(probe_task_id=task.id, item_type="hardware", status="queued"),
            ServerProbeItem(probe_task_id=task.id, item_type="finetuneEnv", status="queued"),
        ]
    )
    db.commit()
    db.refresh(task)
    return probe_task_to_out(db, task)


async def run_probe_task(probe_code: str) -> None:
    with SessionLocal() as db:
        task = get_probe_task(db, probe_code)
        target = ProbeTarget(**json.loads(task.server_snapshot_json))
        hardware = db.scalar(select(ServerProbeItem).where(ServerProbeItem.probe_task_id == task.id, ServerProbeItem.item_type == "hardware"))
        env = db.scalar(select(ServerProbeItem).where(ServerProbeItem.probe_task_id == task.id, ServerProbeItem.item_type == "finetuneEnv"))

    await _run_probe_item(probe_code, "hardware", target, _run_hardware_probe)
    await _run_probe_item(probe_code, "finetuneEnv", target, _run_finetune_env_probe)

    with SessionLocal() as db:
        task = get_probe_task(db, probe_code)
        items = list(db.scalars(select(ServerProbeItem).where(ServerProbeItem.probe_task_id == task.id)))
        if all(item.status in TERMINAL_STATUSES for item in items):
            task.status = "completed"
            task.finished_at = datetime.utcnow()
            if task.server_profile_id:
                server = db.get(ServerProfile, task.server_profile_id)
                if server:
                    _apply_successful_probe_items(server, items)
            db.commit()


async def _run_probe_item(probe_code: str, item_type: str, target: ProbeTarget, runner) -> None:
    with SessionLocal() as db:
        task = get_probe_task(db, probe_code)
        item = db.scalar(select(ServerProbeItem).where(ServerProbeItem.probe_task_id == task.id, ServerProbeItem.item_type == item_type))
        if not item:
            return
        item.status = "running"
        item.started_at = datetime.utcnow()
        db.commit()
    try:
        data, raw, error = await runner(target)
        status = "failed" if error else "succeeded"
    except Exception as exc:
        data, raw, error, status = {}, {}, str(exc), "failed"
    with SessionLocal() as db:
        task = get_probe_task(db, probe_code)
        item = db.scalar(select(ServerProbeItem).where(ServerProbeItem.probe_task_id == task.id, ServerProbeItem.item_type == item_type))
        if not item:
            return
        item.status = status
        item.data_json = json.dumps(data, ensure_ascii=False)
        item.raw_json = json.dumps(raw, ensure_ascii=False)
        item.error_message = error
        item.finished_at = datetime.utcnow()
        db.commit()


async def _run_hardware_probe(target: ProbeTarget) -> tuple[dict[str, Any], dict[str, Any], str]:
    script = None
    with SessionLocal() as db:
        script = get_active_script(db, "server.probe_hardware")
        rendered = render_script(script, {"work_dir": target.work_dir, "gpu_ids": target.gpu_ids})
    result = await remote_executor.run_for_draft(_endpoint_from_target(target), rendered, timeout_ms=script.timeout_ms)
    raw = _extract_json(result.stdout)
    data = _normalize_hardware(raw, target)
    data.pop("_temp", None)
    return data, raw, ""


async def _run_finetune_env_probe(target: ProbeTarget) -> tuple[dict[str, Any], dict[str, Any], str]:
    with SessionLocal() as db:
        script = get_active_script(db, "server.probe_finetune_env")
        rendered = render_script(
            script,
            {
                "container_name": target.finetune_tool_container_name,
                "finetune_tool_name": target.finetune_tool_name,
            },
        )
    result = await remote_executor.run_for_draft(_endpoint_from_target(target), rendered, timeout_ms=script.timeout_ms)
    raw = _extract_json(result.stdout)
    data, error = _normalize_finetune_env(raw, target)
    return data, raw, error


def _apply_successful_probe_items(server: ServerProfile, items: list[ServerProbeItem]) -> None:
    for item in items:
        if item.status != "succeeded":
            continue
        try:
            data = json.loads(item.data_json or "{}")
        except Exception:
            data = {}
        if item.item_type == "hardware":
            server.gpu = data.get("gpu", server.gpu)
            server.cuda = data.get("acceleratorRuntime", server.cuda)
            server.disk = data.get("disk", server.disk)
            server.disk_used = data.get("diskUsed", server.disk_used)
            server.disk_total = data.get("diskTotal", server.disk_total)
            server.status = "online"
            server.last_error = ""
            server.last_probe_at = datetime.utcnow()
        elif item.item_type == "finetuneEnv":
            server.torch = data.get("torch", server.torch)
            tools = data.get("finetuneTools")
            if isinstance(tools, dict):
                server.finetune_tools_json = json.dumps(tools, ensure_ascii=False)
