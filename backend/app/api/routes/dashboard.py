from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import DashboardSummaryOut, LossMetricsOut, LossPoint
from app.services.task_service import dashboard_summary, loss_series

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)):
    return dashboard_summary(db)


@router.get("/metrics/loss", response_model=LossMetricsOut)
def get_loss_metrics(taskCode: str = "", db: Session = Depends(get_db)):
    return LossMetricsOut(series=[LossPoint(step=item["step"], values=item["values"]) for item in loss_series(db, taskCode or None)])
