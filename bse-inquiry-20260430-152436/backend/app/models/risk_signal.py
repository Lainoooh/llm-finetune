"""
Risk signal definition and instance models.
"""

import uuid
from typing import Optional
import json

from app.database import get_db


class RDURiskDefinitionRepo:
    """Repository for RDU risk definition operations (global rule library)."""

    @staticmethod
    def create(
        signal_code: str,
        name: str,
        description: str,
        category: str = None,
        indicator_names: list[str] = None,
        rule_expression: str = None,
        severity: str = "medium",
        is_active: bool = True,
    ) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO rdu_risk_definitions
                   (signal_code, name, category, description, indicator_names, rule_expression, severity, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (signal_code, name, category, description,
                 json.dumps(indicator_names) if indicator_names else "[]",
                 rule_expression, severity, is_active),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_id(definition_id: int) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM rdu_risk_definitions WHERE id = ?", (definition_id,)
            ).fetchone()
            if row:
                d = dict(row)
                if d.get("indicator_names"):
                    d["indicator_names"] = json.loads(d["indicator_names"])
                return d
            return None

    @staticmethod
    def get_by_code(signal_code: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM rdu_risk_definitions WHERE signal_code = ?", (signal_code,)
            ).fetchone()
            if row:
                d = dict(row)
                if d.get("indicator_names"):
                    d["indicator_names"] = json.loads(d["indicator_names"])
                return d
            return None

    @staticmethod
    def list_active(category: str = None) -> list[dict]:
        with get_db() as conn:
            if category:
                rows = conn.execute(
                    "SELECT * FROM rdu_risk_definitions WHERE is_active = 1 AND category = ? ORDER BY signal_code",
                    (category,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM rdu_risk_definitions WHERE is_active = 1 ORDER BY signal_code"
                ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                if d.get("indicator_names"):
                    d["indicator_names"] = json.loads(d["indicator_names"])
                result.append(d)
            return result

    @staticmethod
    def list_all(skip: int = 0, limit: int = 100) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_risk_definitions ORDER BY signal_code LIMIT ? OFFSET ?",
                (limit, skip),
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                if d.get("indicator_names"):
                    d["indicator_names"] = json.loads(d["indicator_names"])
                result.append(d)
            return result

    @staticmethod
    def update(definition_id: int, **kwargs) -> bool:
        if not kwargs:
            return False
        if "indicator_names" in kwargs and isinstance(kwargs["indicator_names"], list):
            kwargs["indicator_names"] = json.dumps(kwargs["indicator_names"])
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [definition_id]
        with get_db() as conn:
            conn.execute(f"UPDATE rdu_risk_definitions SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            return True

    @staticmethod
    def delete(definition_id: int) -> bool:
        with get_db() as conn:
            conn.execute("DELETE FROM risk_signal_indicators WHERE risk_definition_id = ?", (definition_id,))
            conn.execute("DELETE FROM rdu_risk_definitions WHERE id = ?", (definition_id,))
            return True


class RiskSignalInstanceRepo:
    """Repository for task-level risk signal instances."""

    @staticmethod
    def create(
        task_id: str,
        signal_code: str,
        name: str,
        indicators: str,
        logic: str,
        risk: str,
        is_triggered: bool = True,
        status: str = "pending_review",
    ) -> str:
        signal_id = str(uuid.uuid4())
        with get_db() as conn:
            conn.execute(
                """INSERT INTO risk_signals
                   (id, task_id, signal_code, name, indicators, logic, risk, is_triggered, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (signal_id, task_id, signal_code, name, indicators, logic, risk, is_triggered, status),
            )
        return signal_id

    @staticmethod
    def bulk_create(task_id: str, signals: list[dict]) -> list[str]:
        """Create multiple risk signals at once."""
        ids = []
        for sig in signals:
            sid = RiskSignalInstanceRepo.create(
                task_id=task_id,
                signal_code=sig.get("signal_code", ""),
                name=sig["name"],
                indicators=sig.get("indicators", ""),
                logic=sig.get("logic", ""),
                risk=sig.get("risk", ""),
                is_triggered=sig.get("is_triggered", True),
                status=sig.get("status", "pending_review"),
            )
            ids.append(sid)
        return ids

    @staticmethod
    def get_by_task(task_id: str) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM risk_signals WHERE task_id = ? ORDER BY id ASC",
                (task_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_by_id(signal_id: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM risk_signals WHERE id = ?", (signal_id,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def update(signal_id: str, **kwargs) -> bool:
        if not kwargs:
            return False
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [signal_id]
        with get_db() as conn:
            conn.execute(f"UPDATE risk_signals SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            return True

    @staticmethod
    def batch_update_triggered(task_id: str, signal_ids: list[str], is_triggered: bool) -> bool:
        """Batch update is_triggered status for multiple signals."""
        with get_db() as conn:
            for sid in signal_ids:
                conn.execute(
                    "UPDATE risk_signals SET is_triggered = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND task_id = ?",
                    (is_triggered, sid, task_id),
                )
            return True


class RiskSignalIndicatorLinkRepo:
    """Repository for risk definition <-> indicator mapping."""

    @staticmethod
    def add_link(risk_definition_id: int, indicator_code: str, role: str = "input") -> bool:
        try:
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO risk_signal_indicators (risk_definition_id, indicator_code, role) VALUES (?, ?, ?)",
                    (risk_definition_id, indicator_code, role),
                )
                return True
        except Exception:
            return False

    @staticmethod
    def get_by_definition(risk_definition_id: int) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                """SELECT rsi.*, id.indicator_name, id.category, id.data_type, id.unit
                   FROM risk_signal_indicators rsi
                   JOIN indicator_definitions id ON rsi.indicator_code = id.indicator_code
                   WHERE rsi.risk_definition_id = ?""",
                (risk_definition_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def delete_by_definition(risk_definition_id: int) -> bool:
        with get_db() as conn:
            conn.execute("DELETE FROM risk_signal_indicators WHERE risk_definition_id = ?", (risk_definition_id,))
            return True
