from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "execution_runs" not in inspector.get_table_names():
        return
    server_columns = {column["name"] for column in inspector.get_columns("server_profiles")} if "server_profiles" in inspector.get_table_names() else set()
    execution_columns = {column["name"] for column in inspector.get_columns("execution_runs")}
    subtask_columns = {column["name"] for column in inspector.get_columns("finetune_subtasks")} if "finetune_subtasks" in inspector.get_table_names() else set()
    with engine.begin() as connection:
        if "ssh_port" not in server_columns:
            connection.execute(text("ALTER TABLE server_profiles ADD COLUMN ssh_port INTEGER DEFAULT 22"))
        if "ssh_key" not in server_columns:
            connection.execute(text("ALTER TABLE server_profiles ADD COLUMN ssh_key TEXT DEFAULT ''"))
        if "finetune_tool_container_name" not in server_columns:
            connection.execute(text("ALTER TABLE server_profiles ADD COLUMN finetune_tool_container_name VARCHAR(200) DEFAULT ''"))
        if "gpu_json" not in server_columns:
            connection.execute(text("ALTER TABLE server_profiles ADD COLUMN gpu_json TEXT DEFAULT '{}'"))
        if "hardware_json" not in server_columns:
            connection.execute(text("ALTER TABLE server_profiles ADD COLUMN hardware_json TEXT DEFAULT '{}'"))
        if "finetune_env_json" not in server_columns:
            connection.execute(text("ALTER TABLE server_profiles ADD COLUMN finetune_env_json TEXT DEFAULT '{}'"))
        if "run_code" not in execution_columns:
            connection.execute(text("ALTER TABLE execution_runs ADD COLUMN run_code VARCHAR(80) DEFAULT ''"))
        if "base_model" not in subtask_columns:
            connection.execute(text("ALTER TABLE finetune_subtasks ADD COLUMN base_model VARCHAR(300) DEFAULT ''"))
