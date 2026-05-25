from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "dev"
    database_url: str = "sqlite:///./data/llm_finetune.db"
    jupyter_default_base_url: str = "http://47.94.137.97:30009/jupyter"
    jupyter_default_token: str = ""
    remote_command_default_timeout_ms: int = 120_000
    jupyter_session_ready_timeout_ms: int = 20_000
    snowflake_node_id: int = 1
    enable_debug_remote_run: bool = False
    pool_min_size: int = 5
    pool_max_size: int = 20
    pool_health_check_interval_s: int = 60
    pool_idle_timeout_s: int = 1800
    pool_queue_timeout_s: int = 300

    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.database_url.startswith("sqlite:///"):
        db_path = settings.database_url.replace("sqlite:///", "", 1)
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return settings
