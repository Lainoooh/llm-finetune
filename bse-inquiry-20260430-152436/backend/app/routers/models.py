"""
Model management router.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from app.models.model import ModelRepo
from app.utils.encrypt import encrypt_api_key, decrypt_api_key
from app.schemas.common import ModelCreateRequest, ModelUpdateRequest
from app.middleware.auth import get_current_user, require_role

router = APIRouter()


@router.get("/", response_model=list)
def list_models(skip: int = 0, limit: int = 50, user: dict = Depends(get_current_user)):
    """List all models (active ones for regular users, all for admins)."""
    if user.get("role") == "admin":
        return ModelRepo.list_all(skip, limit)
    return ModelRepo.list_active()


@router.post("/", response_model=dict)
def create_model(req: ModelCreateRequest, user: dict = Depends(require_role("admin"))):
    """Create a new model (admin only)."""
    encrypted_key = encrypt_api_key(req.api_key)
    model_id = ModelRepo.create(
        vendor=req.vendor,
        model_type=req.model_type,
        model_name=req.model_name,
        api_name=req.api_name,
        api_key=encrypted_key,
        endpoint_url=req.endpoint_url,
        max_input_tokens=req.max_input_tokens,
        max_output_tokens=req.max_output_tokens,
        is_active=req.is_active,
        is_default=req.is_default,
        config=req.config,
        purpose=req.purpose,
        parent_model_id=req.parent_model_id,
        display_name=req.display_name,
    )
    return {"id": model_id, "message": "Model created"}


@router.put("/{model_id}", response_model=dict)
def update_model(model_id: int, req: ModelUpdateRequest, user: dict = Depends(require_role("admin"))):
    """Update model configuration (admin only)."""
    existing = ModelRepo.get_by_id(model_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Model not found")

    update_data = req.model_dump(exclude_none=True)
    if "api_key" in update_data:
        update_data["api_key"] = encrypt_api_key(update_data["api_key"])

    ModelRepo.update(model_id, **update_data)
    return {"message": "Model updated"}


@router.delete("/{model_id}", response_model=dict)
def delete_model(model_id: int, user: dict = Depends(require_role("admin"))):
    """Delete a model (admin only)."""
    ModelRepo.delete(model_id)
    return {"message": "Model deleted"}


@router.get("/active", response_model=list)
def list_active_models(user: dict = Depends(get_current_user)):
    """List active models."""
    return ModelRepo.list_active()


@router.get("/parents", response_model=list)
def list_parent_models(user: dict = Depends(get_current_user)):
    """List all parent models (for dropdown selection)."""
    return ModelRepo.get_parent_models()


@router.get("/parent/{parent_id}/children", response_model=list)
def get_model_children(parent_id: int, user: dict = Depends(get_current_user)):
    """Get all child models for a parent model."""
    parent = ModelRepo.get_by_id(parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent model not found")
    return ModelRepo.get_children(parent_id)


@router.post("/batch", response_model=dict)
def batch_save_models(req: dict, user: dict = Depends(require_role("admin"))):
    """Batch save models (create or update parent and children)."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        display_name = req.get("display_name")
        is_unified = bool(req.get("is_unified", False))
        unified_config = req.get("unified_config")
        separate_configs = req.get("separate_configs")
        try:
            concurrency = int(req.get("concurrency", 1) or 1)
        except (TypeError, ValueError):
            concurrency = 1
        if concurrency < 1:
            concurrency = 1

        if not display_name or not str(display_name).strip():
            raise HTTPException(status_code=400, detail="display_name is required")
        display_name = str(display_name).strip()

        # 入参分支必须有效，避免后续 model_id 未定义导致 500
        if is_unified:
            if not unified_config:
                raise HTTPException(
                    status_code=400,
                    detail="is_unified=true 时必须提供 unified_config",
                )
        else:
            if not separate_configs or not isinstance(separate_configs, list):
                raise HTTPException(
                    status_code=400,
                    detail="独立模式下必须提供 separate_configs (非空数组)",
                )

        parent_id = req.get("parent_id")

        # If updating existing parent: 先校验存在性，再清空旧子模型
        if parent_id:
            existing = ModelRepo.get_by_id(parent_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Parent model not found")
            children = ModelRepo.get_children(parent_id)
            for child in children:
                ModelRepo.delete(child["id"])

        model_id = None  # 显式初始化，防止 UnboundLocalError

        if is_unified:
            # Unified mode: parent sets concurrency, syncs to all children
            purposes = ["risk_judgment", "risk_signal", "inquiry_logic", "inquiry_item", "common"]
            prompts = unified_config.get("prompts", {}) or {}
            uni_model_name = unified_config.get("model_name", "") or ""
            uni_endpoint = unified_config.get("endpoint_url", "") or ""

            if parent_id:
                ModelRepo.update(
                    parent_id,
                    model_name=uni_model_name,
                    endpoint_url=uni_endpoint,
                    display_name=display_name,
                    concurrency=concurrency,
                )
                model_id = parent_id
            else:
                model_id = ModelRepo.create(
                    vendor="unified",
                    model_type="llm",
                    model_name=uni_model_name,
                    api_name="dashscope",
                    api_key="encrypted:placeholder",
                    endpoint_url=uni_endpoint,
                    is_active=True,
                    display_name=display_name,
                    concurrency=concurrency,
                )

            # Create 5 children — unified mode: all children inherit parent concurrency
            for purpose in purposes:
                prompt = prompts.get(purpose, "") or ""
                config_dict = {"prompt": prompt} if prompt else None
                ModelRepo.create(
                    vendor="unified",
                    model_type="llm",
                    model_name=uni_model_name,
                    api_name="dashscope",
                    api_key="encrypted:placeholder",
                    endpoint_url=uni_endpoint,
                    is_active=True,
                    purpose=purpose,
                    parent_model_id=model_id,
                    display_name=display_name,
                    config=config_dict,
                    concurrency=concurrency,
                )
        else:
            # Separate mode: each child model has its own concurrency
            if parent_id:
                ModelRepo.update(
                    parent_id,
                    display_name=display_name,
                    concurrency=concurrency,
                )
                model_id = parent_id
            else:
                model_id = ModelRepo.create(
                    vendor="multi-purpose",
                    model_type="llm",
                    model_name=f"{display_name}-multi",
                    api_name="multi",
                    api_key="encrypted:placeholder",
                    endpoint_url="",
                    is_active=True,
                    display_name=display_name,
                    concurrency=concurrency,
                )

            for config in separate_configs:
                prompt = (config.get("prompt") or "")
                config_dict = {"prompt": prompt} if prompt else None
                try:
                    child_concurrency = int(config.get("concurrency", concurrency) or concurrency)
                except (TypeError, ValueError):
                    child_concurrency = concurrency
                if child_concurrency < 1:
                    child_concurrency = 1
                ModelRepo.create(
                    vendor="separate",
                    model_type="llm",
                    model_name=config.get("model_name", "") or "",
                    api_name="dashscope",
                    api_key="encrypted:placeholder",
                    endpoint_url=config.get("endpoint_url", "") or "",
                    is_active=True,
                    purpose=config.get("purpose", "") or "",
                    parent_model_id=model_id,
                    display_name=display_name,
                    config=config_dict,
                    concurrency=child_concurrency,
                )

        return {"id": model_id, "message": "Models saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        # 把堆栈写入日志，并把可读错误信息返回前端，避免静默 500
        logger.exception("batch_save_models failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"模型保存失败: {type(e).__name__}: {e}",
        )
