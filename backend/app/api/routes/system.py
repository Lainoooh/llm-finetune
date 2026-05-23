from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.services.script_service import seed_builtin_scripts
from app.services.server_service import seed_default_server
from app.services.task_service import seed_default_tasks

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/system/info")
def system_info():
    settings = get_settings()
    return {
        "database": "sqlite" if settings.database_url.startswith("sqlite") else "external",
        "databaseUrl": settings.database_url.replace("sqlite:///", "sqlite:///"),
        "executor": "jupyter_terminal",
        "debugRemoteRun": settings.enable_debug_remote_run,
    }


@router.post("/system/seed")
def system_seed(db: Session = Depends(get_db)):
    seed_builtin_scripts(db)
    seed_default_server(db)
    seed_default_tasks(db)
    return {"ok": True}
