"""
Conversation and message models.
"""

import uuid
from datetime import datetime
from typing import Optional

from app.database import get_db


class ConversationRepo:
    """Repository for conversation operations."""

    @staticmethod
    def create(owner_id: int, title: str = "新对话") -> str:
        conv_id = str(uuid.uuid4())
        with get_db() as conn:
            conn.execute(
                "INSERT INTO conversations (id, owner_id, title) VALUES (?, ?, ?)",
                (conv_id, owner_id, title),
            )
            # Add owner as member with 'owner' role
            conn.execute(
                "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'owner')",
                (conv_id, owner_id),
            )
        return conv_id

    @staticmethod
    def get_by_id(conv_id: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def list_by_user(user_id: int, skip: int = 0, limit: int = 50) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                """SELECT c.*, cm.role as user_role
                   FROM conversations c
                   JOIN conversation_members cm ON c.id = cm.conversation_id
                   WHERE cm.user_id = ?
                   ORDER BY c.updated_at DESC
                   LIMIT ? OFFSET ?""",
                (user_id, limit, skip),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def update(conv_id: str, **kwargs) -> bool:
        if not kwargs:
            return False
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [conv_id]
        with get_db() as conn:
            conn.execute(f"UPDATE conversations SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            return True

    @staticmethod
    def delete(conv_id: str) -> bool:
        with get_db() as conn:
            # Delete messages first (messages.task_id references tasks.id)
            conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
            # Cascade-delete all tasks and their related data
            task_rows = conn.execute(
                "SELECT id FROM tasks WHERE conversation_id = ?", (conv_id,)
            ).fetchall()
            for row in task_rows:
                tid = row["id"]
                conn.execute("DELETE FROM workflow_steps WHERE task_id = ?", (tid,))
                conn.execute("DELETE FROM user_decisions WHERE task_id = ?", (tid,))
                conn.execute("DELETE FROM risk_signals WHERE task_id = ?", (tid,))
                conn.execute("DELETE FROM inquiry_letters WHERE task_id = ?", (tid,))
                conn.execute("DELETE FROM indicator_values WHERE task_id = ?", (tid,))
                conn.execute("DELETE FROM rdu_metric_values WHERE task_id = ?", (tid,))
                # Break circular FK: tasks.report_file_id -> annual_report_files.id
                conn.execute("UPDATE tasks SET report_file_id = NULL WHERE id = ?", (tid,))
                conn.execute("DELETE FROM annual_report_files WHERE task_id = ?", (tid,))
            conn.execute("DELETE FROM tasks WHERE conversation_id = ?", (conv_id,))
            # Delete conversation itself
            conn.execute("DELETE FROM conversation_members WHERE conversation_id = ?", (conv_id,))
            conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
            return True

    @staticmethod
    def get_by_share_token(token: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM conversations WHERE share_token = ? AND is_shared = 1", (token,)
            ).fetchone()
            return dict(row) if row else None


class ConversationMemberRepo:
    """Repository for conversation membership operations."""

    @staticmethod
    def add_member(conv_id: str, user_id: int, role: str = "viewer") -> bool:
        try:
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, ?)",
                    (conv_id, user_id, role),
                )
                return True
        except Exception:
            return False  # Already exists or foreign key violation

    @staticmethod
    def get_members(conv_id: str) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                """SELECT cm.*, u.username, u.display_name
                   FROM conversation_members cm
                   JOIN users u ON cm.user_id = u.id
                   WHERE cm.conversation_id = ?""",
                (conv_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_user_role(conv_id: str, user_id: int) -> Optional[str]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
                (conv_id, user_id),
            ).fetchone()
            return row["role"] if row else None

    @staticmethod
    def remove_member(conv_id: str, user_id: int) -> bool:
        with get_db() as conn:
            conn.execute(
                "DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND role != 'owner'",
                (conv_id, user_id),
            )
            return True


class MessageRepo:
    """Repository for message operations."""

    @staticmethod
    def create(
        conversation_id: str,
        user_id: int,
        role: str,
        content: str,
        message_type: str = "text",
        task_id: str = None,
        metadata: dict = None,
    ) -> str:
        msg_id = str(uuid.uuid4())
        import json
        with get_db() as conn:
            conn.execute(
                """INSERT INTO messages (id, conversation_id, user_id, role, content, message_type, task_id, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (msg_id, conversation_id, user_id, role, content, message_type, task_id,
                 json.dumps(metadata) if metadata else None),
            )
            # Update conversation updated_at
            conn.execute(
                "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (conversation_id,),
            )
        return msg_id

    @staticmethod
    def list_by_conversation(conv_id: str, skip: int = 0, limit: int = 100) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                """SELECT m.*, u.display_name
                   FROM messages m
                   LEFT JOIN users u ON m.user_id = u.id
                   WHERE m.conversation_id = ?
                   ORDER BY m.created_at ASC
                   LIMIT ? OFFSET ?""",
                (conv_id, limit, skip),
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                if d.get("metadata"):
                    import json
                    d["metadata"] = json.loads(d["metadata"])
                result.append(d)
            return result

    @staticmethod
    def get_by_id(msg_id: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM messages WHERE id = ?", (msg_id,)).fetchone()
            if row:
                d = dict(row)
                if d.get("metadata"):
                    import json
                    d["metadata"] = json.loads(d["metadata"])
                return d
            return None
