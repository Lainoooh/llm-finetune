"""
RDU Categories repository.
Handles theme → category two-level hierarchy for metrics and risk signals.
"""

from typing import Optional
from app.database import get_db


class RDUCategoryRepo:
    """Repository for rdu_categories table."""

    @staticmethod
    def list_all() -> list[dict]:
        """List all categories ordered by level and sort_order."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_categories ORDER BY level, sort_order, id"
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def list_by_level(level: int) -> list[dict]:
        """List categories by level (0=theme, 1=category)."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_categories WHERE level = ? ORDER BY sort_order, id",
                (level,)
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def list_children(parent_id: int) -> list[dict]:
        """List child categories for a given parent."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_categories WHERE parent_id = ? ORDER BY sort_order, id",
                (parent_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_by_id(category_id: int) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM rdu_categories WHERE id = ?", (category_id,)
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def create(name: str, level: int, parent_id: int = None,
               sort_order: int = 0, code: str = None, description: str = None) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO rdu_categories (name, code, level, parent_id, sort_order, description)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (name, code, level, parent_id, sort_order, description)
            )
            return cursor.lastrowid

    @staticmethod
    def update(category_id: int, **kwargs) -> bool:
        if not kwargs:
            return False
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [category_id]
        with get_db() as conn:
            conn.execute(
                f"UPDATE rdu_categories SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                values
            )
            return True

    @staticmethod
    def delete(category_id: int) -> bool:
        """Delete a category. Caller must verify no child data exists."""
        with get_db() as conn:
            conn.execute("DELETE FROM rdu_categories WHERE id = ?", (category_id,))
            return True

    @staticmethod
    def get_tree() -> list[dict]:
        """Get full category tree: themes with nested children and counts."""
        with get_db() as conn:
            themes = conn.execute(
                "SELECT * FROM rdu_categories WHERE level = 0 ORDER BY sort_order, id"
            ).fetchall()
            result = []
            for theme in themes:
                theme_dict = dict(theme)
                children = conn.execute(
                    "SELECT * FROM rdu_categories WHERE parent_id = ? ORDER BY sort_order, id",
                    (theme_dict["id"],)
                ).fetchall()
                children_list = []
                for child in children:
                    child_dict = dict(child)
                    mc = conn.execute(
                        "SELECT COUNT(*) as cnt FROM rdu_metrics_standard WHERE category_id = ?",
                        (child_dict["id"],)
                    ).fetchone()
                    sc = conn.execute(
                        "SELECT COUNT(*) as cnt FROM rdu_risk_signals WHERE category_id = ?",
                        (child_dict["id"],)
                    ).fetchone()
                    child_dict["metrics_count"] = mc["cnt"] if mc else 0
                    child_dict["signals_count"] = sc["cnt"] if sc else 0
                    children_list.append(child_dict)
                theme_dict["children"] = children_list
                result.append(theme_dict)
            return result

    @staticmethod
    def has_associated_data(category_id: int) -> dict:
        """Check if a category has associated metrics or risk signals."""
        with get_db() as conn:
            mc = conn.execute(
                "SELECT COUNT(*) as cnt FROM rdu_metrics_standard WHERE category_id = ?",
                (category_id,)
            ).fetchone()
            sc = conn.execute(
                "SELECT COUNT(*) as cnt FROM rdu_risk_signals WHERE category_id = ?",
                (category_id,)
            ).fetchone()
            children = conn.execute(
                "SELECT COUNT(*) as cnt FROM rdu_categories WHERE parent_id = ?",
                (category_id,)
            ).fetchone()
            return {
                "metrics_count": mc["cnt"] if mc else 0,
                "signals_count": sc["cnt"] if sc else 0,
                "children_count": children["cnt"] if children else 0,
            }
