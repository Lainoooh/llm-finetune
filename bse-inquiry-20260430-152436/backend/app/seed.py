"""
Seed data script - initializes the database with default data from init.sql.
Run with: python -m app.seed
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import init_db, get_db


def seed_from_init_sql():
    """Load all initial data from init.sql."""
    print("Loading initial data from init.sql...")

    possible_paths = [
        os.path.join(os.path.dirname(__file__), "init", "init.sql"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "init", "init.sql"),
    ]
    
    init_sql_path = None
    for path in possible_paths:
        if os.path.exists(path):
            init_sql_path = path
            break
    
    if not init_sql_path:
        print("  WARNING: init.sql not found, skipping")
        return

    with open(init_sql_path, 'r', encoding='utf-8') as f:
        sql_script = f.read()

    with get_db() as conn:
        conn.executescript(sql_script)

    # Verify data
    with get_db() as conn:
        users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        models = conn.execute("SELECT COUNT(*) FROM models").fetchone()[0]
        categories = conn.execute("SELECT COUNT(*) FROM rdu_categories").fetchone()[0]
        metrics = conn.execute("SELECT COUNT(*) FROM rdu_metrics_standard").fetchone()[0]
        risks = conn.execute("SELECT COUNT(*) FROM rdu_risk_signals").fetchone()[0]
        values = conn.execute("SELECT COUNT(*) FROM rdu_metric_values").fetchone()[0]
        
        print(f"  Users: {users}")
        print(f"  Models: {models}")
        print(f"  RDU Categories: {categories}")
        print(f"  RDU Metrics: {metrics}")
        print(f"  RDU Risk Signals: {risks}")
        print(f"  RDU Metric Values: {values}")


if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("\nSeeding data...")
    seed_from_init_sql()
    print("\nSeeding complete!")
