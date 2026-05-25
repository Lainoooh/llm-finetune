from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.dataset_service import dataset_service, DatasetConfig
from app.services.file_upload_service import file_upload_service, upload_progress_manager

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("/subtasks/{subtask_code}")
async def get_datasets(subtask_code: str, db: Session = Depends(get_db)):
    """获取子任务的 dataset 列表（含同步状态）"""
    try:
        info = await dataset_service.read_remote_dataset_info(db, subtask_code)
        return {
            "datasets": info.datasets,
            "remotePath": info.remote_path,
            "lastSyncedAt": info.last_synced_at,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/subtasks/{subtask_code}/upload")
async def upload_dataset_file(
    subtask_code: str,
    file: UploadFile = File(...),
    filename: Optional[str] = Query(None),
    overwrite: bool = Query(True),
    db: Session = Depends(get_db),
):
    """上传数据集文件到远程服务器"""
    try:
        result = await file_upload_service.upload(
            db=db,
            subtask_code=subtask_code,
            file=file,
            filename=filename,
            overwrite=overwrite,
        )
        return {
            "ok": True,
            "remotePath": result.remote_path,
            "size": result.size,
            "md5": result.md5,
            "rows": result.rows,
            "sampleRows": result.sample_rows,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await upload_progress_manager.broadcast(subtask_code, {
            "type": "error",
            "filename": file.filename,
            "message": str(e),
        })
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/subtasks/{subtask_code}/{dataset_name}")
async def update_dataset_config(
    subtask_code: str,
    dataset_name: str,
    config: dict,
    db: Session = Depends(get_db),
):
    """更新单个 dataset 配置并同步到远端"""
    try:
        dataset_config = DatasetConfig(
            file_name=config.get("file_name", ""),
            formatting=config.get("formatting", "alpaca"),
            columns=config.get("columns"),
            tags=config.get("tags"),
        )
        info = await dataset_service.update_dataset_entry(
            db=db,
            subtask_code=subtask_code,
            dataset_name=dataset_name,
            config=dataset_config,
        )
        return {"ok": True, "syncStatus": "synced", "dataset": info.datasets.get(dataset_name)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subtasks/{subtask_code}/sync")
async def sync_all_datasets(subtask_code: str, db: Session = Depends(get_db)):
    """手动同步全部 dataset 到远端"""
    try:
        info = await dataset_service.sync_all_datasets(db=db, subtask_code=subtask_code)
        return {"ok": True, "syncStatus": "synced"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subtasks/{subtask_code}/{dataset_name}/sync")
async def sync_single_dataset(
    subtask_code: str,
    dataset_name: str,
    db: Session = Depends(get_db),
):
    """同步单个 dataset 到远端"""
    try:
        info = await dataset_service.sync_single_dataset(
            db=db,
            subtask_code=subtask_code,
            dataset_name=dataset_name,
        )
        return {"ok": True, "datasetName": dataset_name, "syncStatus": "synced"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subtasks/{subtask_code}/{dataset_name}/preview")
async def preview_dataset(
    subtask_code: str,
    dataset_name: str,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """分页预览数据集内容"""
    try:
        result = await dataset_service.preview_dataset(
            db=db,
            subtask_code=subtask_code,
            dataset_name=dataset_name,
            page=page,
            size=size,
        )
        return {
            "datasetName": result.dataset_name,
            "items": result.items,
            "total": result.total,
            "page": result.page,
            "size": result.size,
            "formatting": result.formatting,
            "columns": result.columns,
            "fileSize": result.file_size,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/upload/{subtask_code}")
async def upload_progress_ws(websocket: WebSocket, subtask_code: str):
    """WebSocket 推送上传进度"""
    await websocket.accept()

    async def send_progress(event: dict):
        try:
            await websocket.send_json(event)
        except Exception:
            pass

    upload_progress_manager.subscribe(subtask_code, send_progress)
    try:
        while True:
            # 保持连接，等待客户端消息或断开
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        upload_progress_manager.unsubscribe(subtask_code, send_progress)
