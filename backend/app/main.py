from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import dashboard, datasets, debug, executions, scripts, servers, system, tasks
from app.core.config import get_settings
from app.core.snowflake import configure_snowflake
from app.db.session import SessionLocal, init_db
from app.executors.factory import remote_executor
from app.models import FinetuneSubtask, FinetuneTask, ServerProbeItem, ServerProbeTask
from app.services.script_service import seed_builtin_scripts
from app.services.server_service import seed_default_server
from app.services.task_service import seed_default_tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await remote_executor.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_snowflake(settings.snowflake_node_id)
    init_db()
    with SessionLocal() as db:
        db.query(ServerProbeItem).delete()
        db.query(ServerProbeTask).delete()
        db.query(FinetuneSubtask).delete()
        db.query(FinetuneTask).delete()
        db.commit()
    with SessionLocal() as db:
        seed_builtin_scripts(db)
        seed_default_server(db)
        seed_default_tasks(db)

    app = FastAPI(title="LLM Finetune Platform API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:30000", "http://localhost:30000", "http://127.0.0.1:3000", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(system.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(servers.router, prefix="/api")
    app.include_router(tasks.router, prefix="/api")
    app.include_router(executions.router, prefix="/api")
    app.include_router(scripts.router, prefix="/api")
    app.include_router(debug.router, prefix="/api")
    app.include_router(datasets.router, prefix="/api")
    return app


app = create_app()
