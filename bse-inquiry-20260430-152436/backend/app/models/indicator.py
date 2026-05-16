"""
Indicator definition and value models, annual report file model.
"""

from typing import Optional
import json

from app.database import get_db


class IndicatorDefinitionRepo:
    """Repository for indicator definition operations (global rule mapping)."""

    @staticmethod
    def create(
        category: str,
        indicator_name: str,
        indicator_code: str,
        description: str = None,
        formula: str = None,
        data_type: str = "number",
        unit: str = None,
        is_active: bool = True,
    ) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO indicator_definitions
                   (category, indicator_name, indicator_code, description, formula, data_type, unit, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (category, indicator_name, indicator_code, description, formula, data_type, unit, is_active),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_code(indicator_code: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM indicator_definitions WHERE indicator_code = ?", (indicator_code,)
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def list_by_category(category: str = None) -> list[dict]:
        with get_db() as conn:
            if category:
                rows = conn.execute(
                    "SELECT * FROM indicator_definitions WHERE category = ? AND is_active = 1 ORDER BY indicator_code",
                    (category,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM indicator_definitions WHERE is_active = 1 ORDER BY category, indicator_code"
                ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def list_all() -> list[dict]:
        with get_db() as conn:
            rows = conn.execute("SELECT * FROM indicator_definitions ORDER BY category, indicator_code").fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def bulk_create(indicators: list[dict]) -> int:
        """Bulk create indicator definitions. Returns count created."""
        count = 0
        for ind in indicators:
            try:
                IndicatorDefinitionRepo.create(
                    category=ind["category"],
                    indicator_name=ind["indicator_name"],
                    indicator_code=ind["indicator_code"],
                    description=ind.get("description"),
                    formula=ind.get("formula"),
                    data_type=ind.get("data_type", "number"),
                    unit=ind.get("unit"),
                )
                count += 1
            except Exception:
                pass  # Skip duplicates
        return count


class IndicatorValueRepo:
    """Repository for task-level indicator extracted values."""

    @staticmethod
    def create(
        task_id: str,
        indicator_code: str,
        indicator_name: str,
        category: str,
        value: str,
        period: str = None,
        raw_value: str = None,
        source_page: int = None,
    ) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO indicator_values
                   (task_id, indicator_code, indicator_name, category, value, period, raw_value, source_page)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (task_id, indicator_code, indicator_name, category, value, period, raw_value, source_page),
            )
            return cursor.lastrowid

    @staticmethod
    def bulk_create(task_id: str, values: list[dict]) -> list[int]:
        """Bulk create indicator values for a task."""
        ids = []
        for v in values:
            rid = IndicatorValueRepo.create(
                task_id=task_id,
                indicator_code=v["indicator_code"],
                indicator_name=v.get("indicator_name", ""),
                category=v.get("category", ""),
                value=v["value"],
                period=v.get("period"),
                raw_value=v.get("raw_value"),
                source_page=v.get("source_page"),
            )
            ids.append(rid)
        return ids

    @staticmethod
    def get_by_task(task_id: str, category: str = None) -> list[dict]:
        with get_db() as conn:
            if category:
                rows = conn.execute(
                    """SELECT * FROM indicator_values
                       WHERE task_id = ? AND category = ?
                       ORDER BY indicator_code, period""",
                    (task_id, category),
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT * FROM indicator_values
                       WHERE task_id = ?
                       ORDER BY category, indicator_code, period""",
                    (task_id,),
                ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_by_task_and_code(task_id: str, indicator_code: str) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM indicator_values WHERE task_id = ? AND indicator_code = ? ORDER BY period",
                (task_id, indicator_code),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def delete_by_task(task_id: str) -> bool:
        with get_db() as conn:
            conn.execute("DELETE FROM indicator_values WHERE task_id = ?", (task_id,))
            return True


class AnnualReportFileRepo:
    """Repository for annual report file operations."""

    @staticmethod
    def create(
        task_id: str,
        file_path: str,
        file_name: str,
        file_size: int = None,
        file_hash: str = None,
    ) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO annual_report_files (task_id, file_path, file_name, file_size, file_hash)
                   VALUES (?, ?, ?, ?, ?)""",
                (task_id, file_path, file_name, file_size, file_hash),
            )
            # Update task's report_file_id
            conn.execute(
                "UPDATE tasks SET report_file_id = ? WHERE id = ?",
                (cursor.lastrowid, task_id),
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_task(task_id: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM annual_report_files WHERE task_id = ?", (task_id,)
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def update(file_id: int, **kwargs) -> bool:
        if not kwargs:
            return False
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [file_id]
        with get_db() as conn:
            conn.execute(f"UPDATE annual_report_files SET {fields} WHERE id = ?", values)
            return True
