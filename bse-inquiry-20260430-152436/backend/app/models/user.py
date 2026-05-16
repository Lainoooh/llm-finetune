"""
User model - Repository pattern for users and sessions.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from app.database import get_db


class UserRepo:
    """Repository for user operations."""

    @staticmethod
    def create(username: str, password_hash: str, email: str = None, display_name: str = None, role: str = "user") -> int:
        with get_db() as conn:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash, email, display_name, role) VALUES (?, ?, ?, ?, ?)",
                (username, password_hash, email, display_name, role),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_id(user_id: int) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_username(username: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def update(user_id: int, **kwargs) -> bool:
        if not kwargs:
            return False
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [user_id]
        with get_db() as conn:
            conn.execute(f"UPDATE users SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            return True

    @staticmethod
    def list_users(skip: int = 0, limit: int = 50) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, username, email, display_name, role, is_active, created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, skip),
            ).fetchall()
            return [dict(r) for r in rows]


class SessionRepo:
    """Repository for user session operations."""

    @staticmethod
    def create(user_id: int, token: str, expires_hours: int = 24) -> int:
        expires_at = datetime.now() + timedelta(hours=expires_hours)
        with get_db() as conn:
            cursor = conn.execute(
                "INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
                (user_id, token, expires_at.isoformat()),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_token(token: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT s.*, u.username, u.role FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1",
                (token, datetime.now().isoformat()),
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def delete_by_token(token: str) -> bool:
        with get_db() as conn:
            conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
            return True

    @staticmethod
    def cleanup_expired() -> int:
        with get_db() as conn:
            cursor = conn.execute(
                "DELETE FROM user_sessions WHERE expires_at < ?", (datetime.now().isoformat(),)
            )
            return cursor.rowcount
