from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.snowflake import next_id
from app.db.session import Base


def snowflake_pk() -> Mapped[int]:
    return mapped_column(BigInteger, primary_key=True, default=next_id)


class ServerProfile(Base):
    __tablename__ = "server_profiles"

    id: Mapped[int] = snowflake_pk()
    public_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    host: Mapped[str] = mapped_column(String(200), default="")
    user: Mapped[str] = mapped_column(String(100), default="")
    password: Mapped[str] = mapped_column(String(500), default="")
    access_type: Mapped[str] = mapped_column(String(40), default="jupyter")
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)
    ssh_key: Mapped[str] = mapped_column(Text, default="")
    jupyter_base_url: Mapped[str] = mapped_column(String(500), default="")
    jupyter_token: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(40), default="unknown")
    gpu: Mapped[str] = mapped_column(String(300), default="-")
    gpu_ids: Mapped[str] = mapped_column(String(100), default="")
    cuda: Mapped[str] = mapped_column(String(100), default="-")
    torch: Mapped[str] = mapped_column(String(100), default="-")
    finetune_tool_name: Mapped[str] = mapped_column(String(100), default="LLaMA-Factory")
    finetune_tool_container_name: Mapped[str] = mapped_column(String(200), default="")
    finetune_tools_json: Mapped[str] = mapped_column(Text, default="{}")
    work_dir: Mapped[str] = mapped_column(String(500), default="/home/jovyan/work")
    disk: Mapped[str] = mapped_column(String(100), default="-")
    disk_used: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    disk_total: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_error: Mapped[str] = mapped_column(Text, default="")
    last_probe_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ScriptTemplate(Base):
    __tablename__ = "script_templates"
    __table_args__ = (UniqueConstraint("key", "version", name="uq_script_key_version"),)

    id: Mapped[int] = snowflake_pk()
    key: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(80), default="server")
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(40), default="active")
    description: Mapped[str] = mapped_column(Text, default="")
    shell: Mapped[str] = mapped_column(String(40), default="bash")
    template: Mapped[str] = mapped_column(Text)
    param_schema_json: Mapped[str] = mapped_column(Text, default="{}")
    output_type: Mapped[str] = mapped_column(String(40), default="json")
    parser_type: Mapped[str] = mapped_column(String(40), default="json")
    timeout_ms: Mapped[int] = mapped_column(Integer, default=120_000)
    allow_parallel: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_level: Mapped[str] = mapped_column(String(40), default="low")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExecutionRun(Base):
    __tablename__ = "execution_runs"

    id: Mapped[int] = snowflake_pk()
    run_code: Mapped[str] = mapped_column(String(80), unique=True, index=True, default="")
    run_type: Mapped[str] = mapped_column(String(80))
    target_type: Mapped[str] = mapped_column(String(80), default="server")
    target_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    server_profile_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="queued")
    script_key: Mapped[str] = mapped_column(String(120), default="")
    script_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rendered_script: Mapped[str] = mapped_column(Text, default="")
    stdout: Mapped[str] = mapped_column(Text, default="")
    stderr: Mapped[str] = mapped_column(Text, default="")
    exit_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class RemoteCommand(Base):
    __tablename__ = "remote_commands"

    id: Mapped[int] = snowflake_pk()
    execution_run_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    endpoint_key: Mapped[str] = mapped_column(String(500), default="")
    session_generation: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="queued")
    marker: Mapped[str] = mapped_column(String(200), default="")
    stdin_payload: Mapped[str] = mapped_column(Text, default="")
    stdout: Mapped[str] = mapped_column(Text, default="")
    stderr: Mapped[str] = mapped_column(Text, default="")
    exit_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ServerProbeTask(Base):
    __tablename__ = "server_probe_tasks"

    id: Mapped[int] = snowflake_pk()
    probe_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    target_type: Mapped[str] = mapped_column(String(40), default="draft")
    server_profile_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="running")
    request_json: Mapped[str] = mapped_column(Text, default="{}")
    server_snapshot_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ServerProbeItem(Base):
    __tablename__ = "server_probe_items"

    id: Mapped[int] = snowflake_pk()
    probe_task_id: Mapped[int] = mapped_column(BigInteger, index=True)
    item_type: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(40), default="queued")
    data_json: Mapped[str] = mapped_column(Text, default="{}")
    raw_json: Mapped[str] = mapped_column(Text, default="{}")
    error_message: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class FinetuneTask(Base):
    __tablename__ = "finetune_tasks"

    id: Mapped[int] = snowflake_pk()
    task_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    model_name: Mapped[str] = mapped_column(String(200), default="")
    base_model: Mapped[str] = mapped_column(String(300), default="Qwen/Qwen3-8B")
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FinetuneSubtask(Base):
    __tablename__ = "finetune_subtasks"

    id: Mapped[int] = snowflake_pk()
    subtask_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    task_id: Mapped[int] = mapped_column(BigInteger, index=True)
    server_profile_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="draft")
    gpu_ids: Mapped[str] = mapped_column(String(100), default="")
    learning_rate: Mapped[str] = mapped_column(String(40), default="5e-5")
    epoch: Mapped[int] = mapped_column(Integer, default=3)
    batch_size: Mapped[int] = mapped_column(Integer, default=2)
    step: Mapped[int] = mapped_column(Integer, default=500)
    loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    output_dir: Mapped[str] = mapped_column(String(500), default="")
    train_yaml: Mapped[str] = mapped_column(Text, default="")
    eval_yaml: Mapped[str] = mapped_column(Text, default="")
    dataset_info: Mapped[str] = mapped_column(Text, default="{}")
    logs_text: Mapped[str] = mapped_column(Text, default="")
    directory_json: Mapped[str] = mapped_column(Text, default="[]")
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    last_run_code: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CompareSnapshot(Base):
    __tablename__ = "compare_snapshots"

    id: Mapped[int] = snowflake_pk()
    compare_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    task_id: Mapped[int] = mapped_column(BigInteger, index=True)
    status: Mapped[str] = mapped_column(String(40), default="succeeded")
    summary_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
