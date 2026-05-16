"""
Model configuration repository.
"""

from typing import Optional
import json

from app.database import get_db


class ModelRepo:
    """Repository for model configuration operations."""

    @staticmethod
    def create(
        vendor: str,
        model_type: str,
        model_name: str,
        api_name: str,
        api_key: str,
        endpoint_url: str,
        max_input_tokens: int = 32768,
        max_output_tokens: int = 8192,
        is_active: bool = True,
        is_default: bool = False,
        config: dict = None,
        purpose: str = None,
        parent_model_id: int = None,
        display_name: str = None,
        concurrency: int = 1,
    ) -> int:
        with get_db() as conn:
            # If setting as default, unset other defaults first
            if is_default:
                conn.execute("UPDATE models SET is_default = 0")
            cursor = conn.execute(
                """INSERT INTO models
                   (vendor, model_type, model_name, api_name, api_key, endpoint_url,
                    max_input_tokens, max_output_tokens, is_active, is_default, config,
                    purpose, parent_model_id, display_name, concurrency)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (vendor, model_type, model_name, api_name, api_key, endpoint_url,
                 max_input_tokens, max_output_tokens, is_active, is_default,
                 json.dumps(config) if config else None, purpose, parent_model_id, display_name,
                 concurrency),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_id(model_id: int) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM models WHERE id = ?", (model_id,)).fetchone()
            if row:
                d = dict(row)
                if d.get("config"):
                    d["config"] = json.loads(d["config"])
                return d
            return None

    @staticmethod
    def get_by_name(model_name: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM models WHERE model_name = ?", (model_name,)).fetchone()
            if row:
                d = dict(row)
                if d.get("config"):
                    d["config"] = json.loads(d["config"])
                return d
            return None

    @staticmethod
    def get_default() -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM models WHERE is_default = 1 AND is_active = 1").fetchone()
            if row:
                d = dict(row)
                if d.get("config"):
                    d["config"] = json.loads(d["config"])
                return d
            return None

    @staticmethod
    def list_active() -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, vendor, model_type, model_name, api_name, endpoint_url, "
                "max_input_tokens, max_output_tokens, is_active, is_default, concurrency, created_at "
                "FROM models WHERE is_active = 1 ORDER BY is_default DESC, id ASC"
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def list_all(skip: int = 0, limit: int = 50) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, vendor, model_type, model_name, api_name, endpoint_url, "
                "max_input_tokens, max_output_tokens, is_active, is_default, concurrency, created_at, updated_at "
                "FROM models ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, skip),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def update(model_id: int, **kwargs) -> bool:
        if not kwargs:
            return False
        # Handle config serialization (dict → JSON string; None 保持为 NULL)
        if "config" in kwargs and isinstance(kwargs["config"], dict):
            kwargs["config"] = json.dumps(kwargs["config"])
        # Handle is_default
        if kwargs.get("is_default"):
            with get_db() as conn:
                conn.execute("UPDATE models SET is_default = 0 WHERE id != ?", (model_id,))
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [model_id]
        with get_db() as conn:
            conn.execute(
                f"UPDATE models SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                values,
            )
            return True

    @staticmethod
    def delete(model_id: int) -> bool:
        with get_db() as conn:
            conn.execute("DELETE FROM models WHERE id = ?", (model_id,))
            return True

    @staticmethod
    def get_by_purpose(purpose: str) -> Optional[dict]:
        """Get an active model by its purpose identifier."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM models WHERE purpose = ? AND is_active = 1 LIMIT 1",
                (purpose,)
            ).fetchone()
            if row:
                d = dict(row)
                if d.get("config"):
                    d["config"] = json.loads(d["config"])
                return d
            return None

    @staticmethod
    def get_parent_models() -> list[dict]:
        """Get all parent models (models with purpose=NULL or parent_model_id=NULL)."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, display_name, model_name, is_active, is_default, concurrency, created_at, updated_at, "
                "(SELECT COUNT(DISTINCT model_name) FROM models c WHERE c.parent_model_id = m.id) as child_name_count, "
                "(SELECT COUNT(*) FROM models c WHERE c.parent_model_id = m.id) as child_count "
                "FROM models m WHERE purpose IS NULL AND parent_model_id IS NULL "
                "ORDER BY is_default DESC, id ASC"
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_children(parent_id: int) -> list[dict]:
        """Get all child models for a parent model."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, vendor, model_type, model_name, api_name, endpoint_url, "
                "max_input_tokens, max_output_tokens, is_active, purpose, config, concurrency, created_at, updated_at "
                "FROM models WHERE parent_model_id = ? ORDER BY purpose ASC",
                (parent_id,)
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                if d.get("config"):
                    d["config"] = json.loads(d["config"])
                result.append(d)
            return result
