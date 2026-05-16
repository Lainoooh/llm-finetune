"""
Structured logging configuration with trace context (task_id, conversation_id).

Console output: human-readable with context prefix.
File output: JSON structured for log aggregation.
"""

import logging
import logging.handlers
import os
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path

from pythonjsonlogger.json import JsonFormatter

# ---------------------------------------------------------------------------
# Trace context variables (automatically propagated via asyncio tasks)
# ---------------------------------------------------------------------------

_task_id_var: ContextVar[str] = ContextVar("task_id", default="-")
_conversation_id_var: ContextVar[str] = ContextVar("conversation_id", default="-")


def set_trace_context(task_id: str, conversation_id: str = "-") -> None:
    """Set trace context for the current async task."""
    _task_id_var.set(task_id or "-")
    _conversation_id_var.set(conversation_id or "-")


def get_task_id() -> str:
    return _task_id_var.get()


def get_conversation_id() -> str:
    return _conversation_id_var.get()


# ---------------------------------------------------------------------------
# Custom formatters
# ---------------------------------------------------------------------------

class ConsoleFormatter(logging.Formatter):
    """Human-readable console formatter with trace context injection."""

    def format(self, record: logging.LogRecord) -> str:
        record.task_id = _task_id_var.get()
        record.conversation_id = _conversation_id_var.get()
        return super().format(record)


class StructuredJsonFormatter(JsonFormatter):
    """JSON formatter that injects trace context fields."""

    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = datetime.now(timezone.utc).isoformat()
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["task_id"] = _task_id_var.get()
        log_record["conversation_id"] = _conversation_id_var.get()


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def setup_logging() -> None:
    """Configure root logger with console + rotating file handlers."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()

    root = logging.getLogger()
    root.setLevel(log_level)

    # Avoid duplicate handlers on repeated calls (e.g. tests)
    if root.handlers:
        return

    # --- Console handler (human-readable) ---
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(log_level)
    console_fmt = ConsoleFormatter(
        fmt="%(asctime)s | %(levelname)-5s | %(name)s | [task:%(task_id)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(console_fmt)
    root.addHandler(console_handler)

    # --- File handler (JSON structured, rotating) ---
    log_dir = Path(__file__).resolve().parent.parent / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "app.log"

    file_handler = logging.handlers.RotatingFileHandler(
        str(log_file),
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(log_level)
    json_fmt = StructuredJsonFormatter()
    file_handler.setFormatter(json_fmt)
    root.addHandler(file_handler)

    # Reduce uvicorn access log noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
