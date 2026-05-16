"""
Risk signal router.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.risk_signal import RiskSignalInstanceRepo
from app.models.task import TaskRepo
from app.schemas.common import RiskSignalResponse, RiskSignalUpdateRequest
from app.middleware.auth import get_current_user

router = APIRouter()


@router.get("/tasks/{task_id}/signals", response_model=list)
def get_task_signals(task_id: str, user: dict = Depends(get_current_user)):
    """Get all risk signals for a task."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    signals = RiskSignalInstanceRepo.get_by_task(task_id)
    return signals


@router.put("/tasks/{task_id}/signals/{signal_id}", response_model=dict)
def update_signal(
    task_id: str,
    signal_id: str,
    req: RiskSignalUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update a single risk signal's triggered status."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    signal = RiskSignalInstanceRepo.get_by_id(signal_id)
    if not signal or signal["task_id"] != task_id:
        raise HTTPException(status_code=404, detail="Signal not found")

    RiskSignalInstanceRepo.update(signal_id, is_triggered=req.is_triggered)
    return {"message": "Signal updated"}


@router.post("/tasks/{task_id}/signals/batch-update", response_model=dict)
def batch_update_signals(
    task_id: str,
    triggered_ids: list[str],
    user: dict = Depends(get_current_user),
):
    """Batch update risk signal triggered status."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all signals for this task
    all_signals = RiskSignalInstanceRepo.get_by_task(task_id)
    all_ids = [s["id"] for s in all_signals]

    # Set triggered for specified IDs
    if triggered_ids:
        RiskSignalInstanceRepo.batch_update_triggered(task_id, triggered_ids, True)

    # Set not triggered for remaining IDs
    not_triggered = [sid for sid in all_ids if sid not in triggered_ids]
    if not_triggered:
        RiskSignalInstanceRepo.batch_update_triggered(task_id, not_triggered, False)

    return {"message": "Signals batch updated"}
