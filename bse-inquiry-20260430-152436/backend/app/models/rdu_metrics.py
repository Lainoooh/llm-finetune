"""
RDU (Risk Data Utility) standard metrics and risk signals repository.
Handles the simplified two-table design:
- rdu_metrics_standard: 112 standard metric definitions
- rdu_risk_signals: 71 risk signal definitions with metric code mappings
"""

import json
from typing import Optional
from app.database import get_db


class RDUMetricsRepo:
    """Repository for rdu_metrics_standard table."""

    @staticmethod
    def get_by_id(metric_id: int) -> Optional[dict]:
        """Get a metric definition by its ID."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM rdu_metrics_standard WHERE id = ?",
                (metric_id,)
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_code(metric_code: str) -> Optional[dict]:
        """Get a metric definition by its code."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM rdu_metrics_standard WHERE metric_code = ?",
                (metric_code,)
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def list_by_category(category_id: int) -> list:
        """List all metrics by category ID."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_metrics_standard WHERE category_id = ? ORDER BY id",
                (category_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def list_all() -> list:
        """List all metric definitions."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_metrics_standard ORDER BY category_id, id"
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def search(keyword: str = None, category_id: int = None) -> list:
        """Search metrics by keyword and/or category_id."""
        with get_db() as conn:
            sql = "SELECT * FROM rdu_metrics_standard WHERE 1=1"
            params = []
            if category_id is not None:
                sql += " AND category_id = ?"
                params.append(category_id)
            if keyword:
                sql += " AND (metric_name LIKE ? OR metric_code LIKE ?)"
                params.extend([f"%{keyword}%", f"%{keyword}%"])
            sql += " ORDER BY category_id, id"
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def list_by_codes(metric_codes: list) -> list:
        """Get multiple metrics by their codes."""
        if not metric_codes:
            return []
        placeholders = ",".join(["?"] * len(metric_codes))
        with get_db() as conn:
            rows = conn.execute(
                f"SELECT * FROM rdu_metrics_standard WHERE metric_code IN ({placeholders}) ORDER BY id",
                metric_codes
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def create(category_id: int, metric_name: str, metric_code: str) -> int:
        with get_db() as conn:
            cursor = conn.execute(
                "INSERT INTO rdu_metrics_standard (category_id, metric_name, metric_code) VALUES (?, ?, ?)",
                (category_id, metric_name, metric_code)
            )
            return cursor.lastrowid

    @staticmethod
    def update(metric_id: int, **kwargs) -> bool:
        if not kwargs:
            return False
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [metric_id]
        with get_db() as conn:
            conn.execute(
                f"UPDATE rdu_metrics_standard SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                values
            )
            return True

    @staticmethod
    def delete(metric_id: int) -> bool:
        with get_db() as conn:
            conn.execute("DELETE FROM rdu_metrics_standard WHERE id = ?", (metric_id,))
            return True

    @staticmethod
    def is_referenced_by_signals(metric_code: str) -> list:
        """Check if a metric_code is referenced by any risk signals. Returns referencing signal names."""
        all_signals = RDURiskSignalsRepo.list_all()
        refs = []
        for s in all_signals:
            if metric_code in s.get("metric_codes", []):
                refs.append(s["risk_signal"])
        return refs


class RDURiskSignalsRepo:
    """Repository for rdu_risk_signals table."""

    @staticmethod
    def get_by_id(signal_id: int) -> Optional[dict]:
        """Get a risk signal by ID."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM rdu_risk_signals WHERE id = ?",
                (signal_id,)
            ).fetchone()
            if row:
                data = dict(row)
                # Parse JSON metric_codes
                data['metric_codes'] = json.loads(data['metric_codes']) if data.get('metric_codes') else []
                return data
            return None

    @staticmethod
    def list_by_category(category_id: int) -> list:
        """List all risk signals by category ID."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_risk_signals WHERE category_id = ? ORDER BY id",
                (category_id,)
            ).fetchall()
            result = []
            for r in rows:
                data = dict(r)
                data['metric_codes'] = json.loads(data['metric_codes']) if data.get('metric_codes') else []
                result.append(data)
            return result

    @staticmethod
    def list_all() -> list:
        """List all risk signals."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM rdu_risk_signals ORDER BY category_id, id"
            ).fetchall()
            result = []
            for r in rows:
                data = dict(r)
                data['metric_codes'] = json.loads(data['metric_codes']) if data.get('metric_codes') else []
                result.append(data)
            return result

    @staticmethod
    def get_signals_for_metrics(metric_codes: list) -> list:
        """
        Find all risk signals that are triggered by the given metrics.
        Returns signals where any of the provided metric_codes are in the signal's metric_codes list.
        """
        all_signals = RDURiskSignalsRepo.list_all()
        matched = []
        for signal in all_signals:
            # Check if any of the provided metrics are in this signal's metric_codes
            if any(code in signal['metric_codes'] for code in metric_codes):
                matched.append(signal)
        return matched

    @staticmethod
    def search(keyword: str = None, category_id: int = None) -> list:
        """Search risk signals by keyword and/or category_id."""
        with get_db() as conn:
            sql = "SELECT * FROM rdu_risk_signals WHERE 1=1"
            params = []
            if category_id is not None:
                sql += " AND category_id = ?"
                params.append(category_id)
            if keyword:
                sql += " AND risk_signal LIKE ?"
                params.append(f"%{keyword}%")
            sql += " ORDER BY category_id, id"
            rows = conn.execute(sql, params).fetchall()
            result = []
            for r in rows:
                data = dict(r)
                data['metric_codes'] = json.loads(data['metric_codes']) if data.get('metric_codes') else []
                result.append(data)
            return result

    @staticmethod
    def create(category_id: int, risk_signal: str, metric_codes: list) -> int:
        """Create a new risk signal."""
        with get_db() as conn:
            cursor = conn.execute(
                "INSERT INTO rdu_risk_signals (category_id, risk_signal, metric_codes) VALUES (?, ?, ?)",
                (category_id, risk_signal, json.dumps(metric_codes))
            )
            return cursor.lastrowid

    @staticmethod
    def update(signal_id: int, **kwargs) -> bool:
        """Update a risk signal. Handles metric_codes JSON serialization."""
        if not kwargs:
            return False
        if 'metric_codes' in kwargs and isinstance(kwargs['metric_codes'], list):
            kwargs['metric_codes'] = json.dumps(kwargs['metric_codes'])
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [signal_id]
        with get_db() as conn:
            conn.execute(
                f"UPDATE rdu_risk_signals SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                values
            )
            return True

    @staticmethod
    def delete(signal_id: int) -> bool:
        """Delete a risk signal."""
        with get_db() as conn:
            conn.execute("DELETE FROM rdu_risk_signals WHERE id = ?", (signal_id,))
            return True
