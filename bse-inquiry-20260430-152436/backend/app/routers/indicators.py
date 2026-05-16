"""
RDU metrics and risk signals router.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.rdu_metrics import RDUMetricsRepo, RDURiskSignalsRepo
from app.middleware.auth import require_role
from app.schemas.common import (
    MetricCreateRequest, MetricUpdateRequest,
)

router = APIRouter()


# ============================================================
# Metrics endpoints
# ============================================================

@router.get("/rdu/metrics", response_model=list)
def list_rdu_metrics(
    category_id: int = None,
    keyword: str = None,
):
    """List / search RDU standard metric definitions."""
    if keyword or category_id:
        return RDUMetricsRepo.search(keyword=keyword, category_id=category_id)
    return RDUMetricsRepo.list_all()


@router.get("/rdu/metrics/{metric_code}", response_model=dict)
def get_rdu_metric(metric_code: str):
    """Get a specific RDU metric definition by code."""
    metric = RDUMetricsRepo.get_by_code(metric_code)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    return metric


@router.post("/rdu/metrics", response_model=dict)
def create_rdu_metric(
    req: MetricCreateRequest,
    user: dict = Depends(require_role("admin")),
):
    """Create a new RDU standard metric."""
    existing = RDUMetricsRepo.get_by_code(req.metric_code)
    if existing:
        raise HTTPException(status_code=409, detail="Metric code already exists")
    new_id = RDUMetricsRepo.create(
        category_id=req.category_id,
        metric_name=req.metric_name,
        metric_code=req.metric_code,
    )
    return RDUMetricsRepo.get_by_id(new_id)


@router.put("/rdu/metrics/{metric_id}", response_model=dict)
def update_rdu_metric(
    metric_id: int,
    req: MetricUpdateRequest,
    user: dict = Depends(require_role("admin")),
):
    """Update an existing RDU standard metric."""
    metric = RDUMetricsRepo.get_by_id(metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    RDUMetricsRepo.update(metric_id, **updates)
    return RDUMetricsRepo.get_by_id(metric_id)


@router.delete("/rdu/metrics/{metric_id}")
def delete_rdu_metric(
    metric_id: int,
    user: dict = Depends(require_role("admin")),
):
    """Delete an RDU standard metric. Fails if referenced by risk signals."""
    metric = RDUMetricsRepo.get_by_id(metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    refs = RDUMetricsRepo.is_referenced_by_signals(metric["metric_code"])
    if refs:
        raise HTTPException(
            status_code=409,
            detail=f"Metric is referenced by risk signals: {', '.join(refs)}"
        )
    RDUMetricsRepo.delete(metric_id)
    return {"ok": True}


# ============================================================
# Risk signals endpoints (read-only, full CRUD in rdu_risks router)
# ============================================================

@router.get("/rdu/risk-signals", response_model=list)
def list_rdu_risk_signals(category_id: int = None):
    """List RDU risk signal definitions."""
    if category_id:
        return RDURiskSignalsRepo.list_by_category(category_id)
    return RDURiskSignalsRepo.list_all()


@router.get("/rdu/risk-signals/match", response_model=list)
def match_risk_signals_for_metrics(metric_codes: str):
    """
    Find all risk signals that are triggered by the given metrics.
    metric_codes: comma-separated list of metric codes
    """
    codes = [c.strip() for c in metric_codes.split(",") if c.strip()]
    return RDURiskSignalsRepo.get_signals_for_metrics(codes)


@router.get("/rdu/risk-signals/{signal_id}", response_model=dict)
def get_rdu_risk_signal(signal_id: int):
    """Get a specific RDU risk signal definition by ID."""
    signal = RDURiskSignalsRepo.get_by_id(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Risk signal not found")
    return signal
