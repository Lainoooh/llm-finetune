"""
Database initialization module.
Handles SQLite connection, table creation, and schema migrations.
"""

import sqlite3
import os
from contextlib import contextmanager

# Database file path — 数据库放在项目根目录 data/ 下，与 backend/frontend/plan 同级
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DB_DIR = os.path.join(PROJECT_ROOT, "data")
DB_PATH = os.path.join(DB_DIR, "bse.db")


def get_db_path() -> str:
    """Get the database file path, creating directories if needed."""
    os.makedirs(DB_DIR, exist_ok=True)
    return DB_PATH


def get_connection() -> sqlite3.Connection:
    """Create and return a database connection with WAL mode for concurrency."""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for better concurrent read/write performance
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# SQL statements for creating all tables
CREATE_TABLES_SQL = """
-- ============================================================
-- Module 1: User Authentication
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email         TEXT UNIQUE,
    display_name  TEXT,
    role          TEXT DEFAULT 'user',
    is_active     BOOLEAN DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    token      TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);


-- ============================================================
-- Module 2: Model Management
-- ============================================================

CREATE TABLE IF NOT EXISTS models (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor            TEXT NOT NULL,
    model_type        TEXT NOT NULL,
    model_name        TEXT NOT NULL,
    api_name          TEXT NOT NULL,
    api_key           TEXT NOT NULL,
    endpoint_url      TEXT NOT NULL,
    max_input_tokens  INTEGER DEFAULT 32768,
    max_output_tokens INTEGER DEFAULT 8192,
    is_active         BOOLEAN DEFAULT 1,
    is_default        BOOLEAN DEFAULT 0,
    config            TEXT,
    purpose           TEXT DEFAULT NULL,
    parent_model_id   INTEGER DEFAULT NULL REFERENCES models(id),
    display_name      TEXT DEFAULT NULL,
    concurrency       INTEGER DEFAULT 1,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- Module 3: Conversation Management
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
    id           TEXT PRIMARY KEY,
    owner_id     INTEGER NOT NULL REFERENCES users(id),
    title        TEXT NOT NULL DEFAULT '新对话',
    is_shared    BOOLEAN DEFAULT 0,
    share_token  TEXT UNIQUE,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);

CREATE TABLE IF NOT EXISTS conversation_members (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    role            TEXT DEFAULT 'viewer',
    joined_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    message_type    TEXT DEFAULT 'text',
    task_id         TEXT REFERENCES tasks(id),
    metadata        TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id);


-- ============================================================
-- Module 4: Task Management
-- ============================================================

CREATE TABLE IF NOT EXISTS annual_report_files (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      TEXT UNIQUE REFERENCES tasks(id),
    file_path    TEXT NOT NULL,
    file_name    TEXT NOT NULL,
    file_size    INTEGER,
    file_hash    TEXT,
    parse_status TEXT DEFAULT 'pending',
    parse_error  TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    company_name    TEXT NOT NULL,
    report_year     INTEGER NOT NULL,
    model_id        INTEGER REFERENCES models(id),
    status          TEXT DEFAULT 'pending',
    current_step    INTEGER DEFAULT 0,
    report_file_id  INTEGER REFERENCES annual_report_files(id),
    metrics_json    TEXT DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_conv ON tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS workflow_steps (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id        TEXT NOT NULL REFERENCES tasks(id),
    step_index     INTEGER NOT NULL,
    step_name      TEXT NOT NULL,
    step_type      TEXT NOT NULL,
    status         TEXT DEFAULT 'pending',
    input_data     TEXT,
    output_data    TEXT,
    llm_calls      TEXT,
    logs           TEXT,
    started_at     DATETIME,
    completed_at   DATETIME,
    error_message  TEXT
);
CREATE INDEX IF NOT EXISTS idx_wf_steps_task ON workflow_steps(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_steps_unique ON workflow_steps(task_id, step_index);

CREATE TABLE IF NOT EXISTS user_decisions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id       TEXT NOT NULL REFERENCES tasks(id),
    step_index    INTEGER NOT NULL,
    decision_type TEXT NOT NULL,
    confirmed_ids TEXT NOT NULL,
    rejected_ids  TEXT,
    modified_data TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_decisions_task ON user_decisions(task_id);

CREATE TABLE IF NOT EXISTS inquiry_letters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    TEXT NOT NULL REFERENCES tasks(id),
    content    TEXT NOT NULL,
    version    INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_letters_task ON inquiry_letters(task_id);


-- ============================================================
-- Module 5: RDU Categories & Risk Signal Definitions
-- ============================================================

-- 分类表（主题 + 一级分类，自引用层级）
CREATE TABLE IF NOT EXISTS rdu_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    code        TEXT UNIQUE,
    level       INTEGER NOT NULL DEFAULT 0,
    parent_id   INTEGER DEFAULT NULL REFERENCES rdu_categories(id),
    sort_order  INTEGER DEFAULT 0,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rdu_categories_parent ON rdu_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_rdu_categories_level ON rdu_categories(level);

-- 表1: RDU 标准指标项表
CREATE TABLE IF NOT EXISTS rdu_metrics_standard (
    id            BIGINT PRIMARY KEY,
    category_id   INTEGER NOT NULL DEFAULT 1,
    metric_name   TEXT NOT NULL,
    metric_code   TEXT NOT NULL UNIQUE,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metrics_category ON rdu_metrics_standard(category_id);
CREATE INDEX IF NOT EXISTS idx_metrics_code ON rdu_metrics_standard(metric_code);

-- 表2: RDU 风险信号表
CREATE TABLE IF NOT EXISTS rdu_risk_signals (
    id            BIGINT PRIMARY KEY,
    category_id   INTEGER NOT NULL DEFAULT 1,
    risk_signal   TEXT NOT NULL,
    metric_codes  TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_risk_category ON rdu_risk_signals(category_id);

-- 表3: RDU 指标值表
CREATE TABLE IF NOT EXISTS rdu_metric_values (
    id            BIGINT PRIMARY KEY,
    task_id       TEXT,
    metric_code   TEXT NOT NULL,
    metric_name   TEXT NOT NULL,
    value         TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metric_values_task ON rdu_metric_values(task_id);
CREATE INDEX IF NOT EXISTS idx_metric_values_code ON rdu_metric_values(metric_code);

CREATE TABLE IF NOT EXISTS risk_signals (
    id             TEXT PRIMARY KEY,
    task_id        TEXT NOT NULL REFERENCES tasks(id),
    signal_code    TEXT NOT NULL,
    name           TEXT NOT NULL,
    category_id    INTEGER,
    indicators     TEXT NOT NULL,
    logic          TEXT NOT NULL,
    risk           TEXT NOT NULL,
    inquiry_logic  TEXT,
    inquiry_item   TEXT,
    is_triggered      BOOLEAN DEFAULT 1,
    similarity_score  REAL DEFAULT NULL,
    status            TEXT DEFAULT 'pending_review',
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_signals_task ON risk_signals(task_id);

CREATE TABLE IF NOT EXISTS indicator_values (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id        TEXT NOT NULL REFERENCES tasks(id),
    indicator_code TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    category       TEXT NOT NULL,
    value          TEXT NOT NULL,
    period         TEXT,
    raw_value      TEXT,
    source_page    INTEGER,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_indicator_values_task ON indicator_values(task_id);
CREATE INDEX IF NOT EXISTS idx_indicator_values_code ON indicator_values(indicator_code);
"""


def init_db():
    """Initialize the database, creating all tables if they don't exist."""
    conn = get_connection()
    try:
        conn.executescript(CREATE_TABLES_SQL)
        # Run migrations for existing databases
        _run_migrations(conn)
        conn.commit()
        print(f"Database initialized at: {get_db_path()}")
    finally:
        conn.close()


def _run_migrations(conn):
    """Run database migrations for existing tables."""
    # Check if models table has the new columns
    cursor = conn.execute("PRAGMA table_info(models)")
    columns = [row["name"] for row in cursor.fetchall()]
    
    if "purpose" not in columns:
        conn.execute("ALTER TABLE models ADD COLUMN purpose TEXT DEFAULT NULL")
        print("Migration: Added 'purpose' column to models table")
    
    if "parent_model_id" not in columns:
        conn.execute("ALTER TABLE models ADD COLUMN parent_model_id INTEGER DEFAULT NULL REFERENCES models(id)")
        print("Migration: Added 'parent_model_id' column to models table")
    
    if "display_name" not in columns:
        conn.execute("ALTER TABLE models ADD COLUMN display_name TEXT DEFAULT NULL")
        print("Migration: Added 'display_name' column to models table")

    # Check if risk_signals table has similarity_score column
    cursor = conn.execute("PRAGMA table_info(risk_signals)")
    rs_columns = [row["name"] for row in cursor.fetchall()]

    if rs_columns and "similarity_score" not in rs_columns:
        conn.execute("ALTER TABLE risk_signals ADD COLUMN similarity_score REAL DEFAULT NULL")
        print("Migration: Added 'similarity_score' column to risk_signals table")

    if rs_columns and "category_id" not in rs_columns:
        conn.execute("ALTER TABLE risk_signals ADD COLUMN category_id INTEGER DEFAULT NULL")
        print("Migration: Added 'category_id' column to risk_signals table")

    # Check if tasks table has metrics_json column
    cursor = conn.execute("PRAGMA table_info(tasks)")
    tasks_columns = [row["name"] for row in cursor.fetchall()]

    if tasks_columns and "metrics_json" not in tasks_columns:
        conn.execute("ALTER TABLE tasks ADD COLUMN metrics_json TEXT DEFAULT NULL")
        print("Migration: Added 'metrics_json' column to tasks table")

    # Add concurrency column to models table
    if "concurrency" not in columns:
        conn.execute("ALTER TABLE models ADD COLUMN concurrency INTEGER DEFAULT 1")
        print("Migration: Added 'concurrency' column to models table")

    # Migrate rdu_categories: create table + seed data + migrate category_id values
    _migrate_rdu_categories(conn)


def _migrate_rdu_categories(conn):
    """Ensure rdu_categories has seed data."""
    try:
        row = conn.execute("SELECT COUNT(*) as cnt FROM rdu_categories").fetchone()
        if row and row["cnt"] > 0:
            return  # Already seeded
    except Exception:
        return  # Table might not exist yet

    # Insert category seed data
    conn.execute("""
        INSERT OR IGNORE INTO rdu_categories (id, name, level, parent_id, sort_order) VALUES
            (1, '关于经营业绩', 0, NULL, 0),
            (2, '整体业绩', 1, 1, 1),
            (3, '现金流/净利润差异', 1, 1, 2),
            (4, '分季度/期后', 1, 1, 3),
            (5, '分业务（产品）', 1, 1, 4),
            (6, '分区域/境内外', 1, 1, 5),
            (7, '分子公司', 1, 1, 6)
    """)
    print("Migration: Seeded rdu_categories table")


def reset_db():
    """Drop all tables and reinitialize (for development only)."""
    conn = get_connection()
    try:
        # Disable foreign key checks temporarily
        conn.execute("PRAGMA foreign_keys=OFF")
        # Get all table names
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        tables = [row["name"] for row in cursor.fetchall()]
        # Drop all tables
        for table in tables:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.commit()
        # Reinitialize
        conn.executescript(CREATE_TABLES_SQL)
        conn.commit()
        print("Database reset and reinitialized.")
    finally:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.close()


if __name__ == "__main__":
    init_db()
