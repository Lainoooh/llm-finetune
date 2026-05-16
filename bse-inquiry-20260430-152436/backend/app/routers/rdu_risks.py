"""
RDU risk signals router — full CRUD with metric association editing.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.rdu_metrics import RDURiskSignalsRepo
from app.middleware.auth import require_role
from app.schemas.common import (
    RiskSignalCreateRequest, RDURiskSignalUpdateRequest,
)

router = APIRouter()


@router.get("/rdu-risks", response_model=list)
def list_rdu_risks(
    category_id: int = None,
    keyword: str = None,
):
    """List / search RDU risk signal definitions."""
    if keyword or category_id:
        return RDURiskSignalsRepo.search(keyword=keyword, category_id=category_id)
    return RDURiskSignalsRepo.list_all()


@router.get("/rdu-risks/{signal_id}", response_model=dict)
def get_rdu_risk(signal_id: int):
    """Get a specific RDU risk signal definition."""
    signal = RDURiskSignalsRepo.get_by_id(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Risk signal not found")
    return signal


@router.post("/rdu-risks", response_model=dict)
def create_rdu_risk(
    req: RiskSignalCreateRequest,
    user: dict = Depends(require_role("admin")),
):
    """Create a new RDU risk signal."""
    new_id = RDURiskSignalsRepo.create(
        category_id=req.category_id,
        risk_signal=req.risk_signal,
        metric_codes=req.metric_codes,
    )
    return RDURiskSignalsRepo.get_by_id(new_id)


@router.put("/rdu-risks/{signal_id}", response_model=dict)
def update_rdu_risk(
    signal_id: int,
    req: RDURiskSignalUpdateRequest,
    user: dict = Depends(require_role("admin")),
):
    """Update an existing RDU risk signal (supports category reassignment and metric_codes editing)."""
    signal = RDURiskSignalsRepo.get_by_id(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Risk signal not found")
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    RDURiskSignalsRepo.update(signal_id, **updates)
    return RDURiskSignalsRepo.get_by_id(signal_id)


@router.delete("/rdu-risks/{signal_id}")
def delete_rdu_risk(
    signal_id: int,
    user: dict = Depends(require_role("admin")),
):
    """Delete an RDU risk signal."""
    signal = RDURiskSignalsRepo.get_by_id(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Risk signal not found")
    RDURiskSignalsRepo.delete(signal_id)
    return {"ok": True}
