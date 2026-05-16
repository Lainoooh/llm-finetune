"""
Task, workflow step, user decision, and inquiry letter models.
"""

import uuid
from datetime import datetime
from typing import Optional
import json

from app.database import get_db


class TaskRepo:
    """Repository for task operations."""

    @staticmethod
    def create(
        conversation_id: str,
        user_id: int,
        company_name: str,
        report_year: int,
        model_id: int = None,
        metrics_json: list = None,
    ) -> str:
        task_id = str(uuid.uuid4())
        metrics_json_str = json.dumps(metrics_json, ensure_ascii=False) if metrics_json else None
        with get_db() as conn:
            conn.execute(
                """INSERT INTO tasks (id, conversation_id, user_id, company_name, report_year, model_id, metrics_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (task_id, conversation_id, user_id, company_name, report_year, model_id, metrics_json_str),
            )
        return task_id

    @staticmethod
    def get_by_id(task_id: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                """SELECT t.*, m.model_name, m.model_type, arf.file_path, arf.parse_status
                   FROM tasks t
                   LEFT JOIN models m ON t.model_id = m.id
                   LEFT JOIN annual_report_files arf ON t.report_file_id = arf.id
                   WHERE t.id = ?""",
                (task_id,),
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def list_by_conversation(conv_id: str) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                """SELECT t.*, m.model_name
                   FROM tasks t
                   LEFT JOIN models m ON t.model_id = m.id
                   WHERE t.conversation_id = ?
                   ORDER BY t.created_at DESC""",
                (conv_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def list_by_user(user_id: int, skip: int = 0, limit: int = 50) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                """SELECT t.*, c.title as conversation_title, m.model_name
                   FROM tasks t
                   JOIN conversations c ON t.conversation_id = c.id
                   LEFT JOIN models m ON t.model_id = m.id
                   WHERE t.user_id = ?
                   ORDER BY t.updated_at DESC
                   LIMIT ? OFFSET ?""",
                (user_id, limit, skip),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def update(task_id: str, **kwargs) -> bool:
        if not kwargs:
            return False
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [task_id]
        with get_db() as conn:
            conn.execute(f"UPDATE tasks SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            return True

    @staticmethod
    def delete(task_id: str) -> bool:
        with get_db() as conn:
            # Cascade delete related records
            conn.execute("DELETE FROM workflow_steps WHERE task_id = ?", (task_id,))
            conn.execute("DELETE FROM user_decisions WHERE task_id = ?", (task_id,))
            conn.execute("DELETE FROM risk_signals WHERE task_id = ?", (task_id,))
            conn.execute("DELETE FROM inquiry_letters WHERE task_id = ?", (task_id,))
            conn.execute("DELETE FROM annual_report_files WHERE task_id = ?", (task_id,))
            conn.execute("DELETE FROM indicator_values WHERE task_id = ?", (task_id,))
            conn.execute("DELETE FROM rdu_metric_values WHERE task_id = ?", (task_id,))
            conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            return True

    @staticmethod
    def recover_zombie_tasks() -> int:
        """启动时恢复僵尸任务：将 status='running' 的任务标记为 interrupted。
        
        Returns:
            受影响的任务数量
        """
        with get_db() as conn:
            # 找出所有 running 状态的任务
            rows = conn.execute(
                "SELECT id FROM tasks WHERE status = 'running'"
            ).fetchall()
            if not rows:
                return 0
            task_ids = [r["id"] for r in rows]
            for tid in task_ids:
                # 将 running 的 workflow_steps 标记为 interrupted
                conn.execute(
                    "UPDATE workflow_steps SET status = 'interrupted', "
                    "error_message = '服务重启，任务被中断' "
                    "WHERE task_id = ? AND status = 'running'",
                    (tid,),
                )
                # 将任务整体标记为 interrupted
                conn.execute(
                    "UPDATE tasks SET status = 'interrupted', updated_at = CURRENT_TIMESTAMP "
                    "WHERE id = ?",
                    (tid,),
                )
            return len(task_ids)


class WorkflowStepRepo:
    """Repository for workflow step operations."""

    @staticmethod
    def create(
        task_id: str,
        step_index: int,
        step_name: str,
        step_type: str,
        status: str = "pending",
    ) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO workflow_steps (task_id, step_index, step_name, step_type, status)
                   VALUES (?, ?, ?, ?, ?)""",
                (task_id, step_index, step_name, step_type, status),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_task(task_id: str) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM workflow_steps WHERE task_id = ? ORDER BY step_index ASC",
                (task_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_by_step(task_id: str, step_index: int) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM workflow_steps WHERE task_id = ? AND step_index = ?",
                (task_id, step_index),
            ).fetchone()
            if row:
                d = dict(row)
                for field in ["input_data", "output_data", "llm_calls"]:
                    if d.get(field):
                        d[field] = json.loads(d[field])
                return d
            return None

    @staticmethod
    def update(step_id: int, **kwargs) -> bool:
        if not kwargs:
            return False
        # Serialize JSON fields
        for field in ["input_data", "output_data", "llm_calls"]:
            if field in kwargs and isinstance(kwargs[field], (dict, list)):
                kwargs[field] = json.dumps(kwargs[field], ensure_ascii=False)
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [step_id]
        with get_db() as conn:
            conn.execute(f"UPDATE workflow_steps SET {fields} WHERE id = ?", values)
            return True

    @staticmethod
    def update_status(task_id: str, step_index: int, status: str, **extra) -> bool:
        updates = {"status": status}
        if status == "running":
            # Only set started_at if not already set (avoid overwriting on log updates)
            with get_db() as conn:
                row = conn.execute(
                    "SELECT started_at FROM workflow_steps WHERE task_id = ? AND step_index = ?",
                    (task_id, step_index),
                ).fetchone()
                if not row or not row["started_at"]:
                    updates["started_at"] = datetime.now().isoformat()
        elif status in ("completed", "failed"):
            updates["completed_at"] = datetime.now().isoformat()
        updates.update(extra)
        with get_db() as conn:
            for k, v in updates.items():
                if isinstance(v, (dict, list)):
                    v = json.dumps(v, ensure_ascii=False)
                conn.execute(
                    f"UPDATE workflow_steps SET {k} = ? WHERE task_id = ? AND step_index = ?",
                    (v, task_id, step_index),
                )
            return True


class UserDecisionRepo:
    """Repository for user decision operations."""

    @staticmethod
    def create(
        task_id: str,
        step_index: int,
        decision_type: str,
        confirmed_ids: list[str],
        rejected_ids: list[str] = None,
        modified_data: dict = None,
    ) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO user_decisions (task_id, step_index, decision_type, confirmed_ids, rejected_ids, modified_data)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (task_id, step_index, decision_type,
                 json.dumps(confirmed_ids),
                 json.dumps(rejected_ids) if rejected_ids else None,
                 json.dumps(modified_data, ensure_ascii=False) if modified_data else None),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_task(task_id: str) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM user_decisions WHERE task_id = ? ORDER BY step_index ASC",
                (task_id,),
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["confirmed_ids"] = json.loads(d["confirmed_ids"]) if d.get("confirmed_ids") else []
                if d.get("rejected_ids"):
                    d["rejected_ids"] = json.loads(d["rejected_ids"])
                if d.get("modified_data"):
                    d["modified_data"] = json.loads(d["modified_data"])
                result.append(d)
            return result


class InquiryLetterRepo:
    """Repository for inquiry letter operations."""

    @staticmethod
    def create(task_id: str, content: str, version: int = 1) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                "INSERT INTO inquiry_letters (task_id, content, version) VALUES (?, ?, ?)",
                (task_id, content, version),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_task(task_id: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM inquiry_letters WHERE task_id = ? ORDER BY version DESC LIMIT 1",
                (task_id,),
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def list_versions(task_id: str) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, version, created_at FROM inquiry_letters WHERE task_id = ? ORDER BY version DESC",
                (task_id,),
            ).fetchall()
            return [dict(r) for r in rows]
