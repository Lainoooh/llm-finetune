from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import ProbeDraftIn, ProbeOut, ProbeTaskOut, ServerCreateIn, ServerOut, ServersListOut, ServerUpdateIn
from app.services.server_service import (
    create_probe_task_for_draft,
    create_probe_task_for_server,
    create_server,
    delete_server,
    get_server_by_public_id,
    get_probe_task,
    list_servers,
    probe_draft,
    probe_server,
    probe_task_to_out,
    run_probe_task,
    server_to_out,
    update_server,
)

router = APIRouter(prefix="/servers", tags=["servers"])


@router.get("", response_model=ServersListOut)
def get_servers(
    keyword: str = Query("", alias="keyword"),
    status: str = Query("all"),
    db: Session = Depends(get_db),
):
    items = [server_to_out(server) for server in list_servers(db, keyword=keyword, status=status)]
    return ServersListOut(items=items, total=len(items))


@router.post("", response_model=ServerOut)
def create(payload: ServerCreateIn, db: Session = Depends(get_db)):
    return server_to_out(create_server(db, payload))


@router.get("/{server_id}", response_model=ServerOut)
def get_server(server_id: str, db: Session = Depends(get_db)):
    try:
        return server_to_out(get_server_by_public_id(db, server_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{server_id}", response_model=ServerOut)
def patch_server(server_id: str, payload: ServerUpdateIn, db: Session = Depends(get_db)):
    try:
        server = get_server_by_public_id(db, server_id)
        return server_to_out(update_server(db, server, payload))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{server_id}")
def remove_server(server_id: str, db: Session = Depends(get_db)):
    try:
        server = get_server_by_public_id(db, server_id)
        delete_server(db, server)
        return {"ok": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{server_id}/environment")
def server_environment(server_id: str, db: Session = Depends(get_db)):
    try:
        server = get_server_by_public_id(db, server_id)
        out = server_to_out(server)
        return {
            "server": out.model_dump(),
            "gpuIds": out.gpuIds,
            "gpu": out.gpu,
            "cuda": out.cuda,
            "torch": out.torch,
            "acceleratorIds": out.acceleratorIds,
            "accelerator": out.accelerator,
            "acceleratorVendor": out.acceleratorVendor,
            "acceleratorRuntime": out.acceleratorRuntime,
            "acceleratorCount": out.acceleratorCount,
            "aiFramework": out.aiFramework,
            "disk": out.disk,
            "workDir": out.workDir,
            "container": {"status": "unknown", "image": "llamafactory"},
        }
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{server_id}/gpu-scope", response_model=ServerOut)
def patch_gpu_scope(server_id: str, payload: ServerUpdateIn, db: Session = Depends(get_db)):
    try:
        server = get_server_by_public_id(db, server_id)
        return server_to_out(update_server(db, server, ServerUpdateIn(gpuIds=payload.gpuIds)))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/probes/{probe_code}", response_model=ProbeTaskOut)
def read_probe_task(probe_code: str, db: Session = Depends(get_db)):
    try:
        return probe_task_to_out(db, get_probe_task(db, probe_code))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/probe-batch", response_model=list[ProbeOut])
async def probe_batch(db: Session = Depends(get_db)):
    results = []
    for server in list_servers(db):
        try:
            updated, raw, run = await probe_server(db, server)
            results.append(ProbeOut(server=server_to_out(updated), raw=raw, runCode=run.run_code))
        except Exception:
            results.append(ProbeOut(server=server_to_out(server), raw={}))
    return results


@router.post("/probe-draft", response_model=ProbeTaskOut)
async def probe_draft_server(payload: ProbeDraftIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        task = create_probe_task_for_draft(db, payload)
        background_tasks.add_task(run_probe_task, task.probeCode)
        return task
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/{server_id}/probe", response_model=ProbeTaskOut)
async def probe_existing_server(server_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        server = get_server_by_public_id(db, server_id)
        task = create_probe_task_for_server(db, server)
        background_tasks.add_task(run_probe_task, task.probeCode)
        return task
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
