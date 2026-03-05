import sqlite3
import os
from pathlib import Path
from .config import settings

# Conditional import for Postgres
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None

class PostgresCursorWrapper:
    def __init__(self, pg_cursor):
        self.cur = pg_cursor

    def execute(self, sql, params=None):
        if params:
            # Replace ? with %s for Postgres compatibility
            sql = sql.replace("?", "%s")
        return self.cur.execute(sql, params)

    def fetchone(self):
        return self.cur.fetchone()

    def fetchall(self):
        return self.cur.fetchall()

    @property
    def rowcount(self):
        return self.cur.rowcount

class PostgresConnectionWrapper:
    def __init__(self, pg_conn):
        self.conn = pg_conn

    def cursor(self):
        return PostgresCursorWrapper(self.conn.cursor(cursor_factory=RealDictCursor))

    def execute(self, sql, params=None):
        # Convenience method used in some parts of the app
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        return self.conn.commit()

    def close(self):
        return self.conn.close()

def connect():
    db_url = settings.DATABASE_URL or os.getenv("DATABASE_URL")
    if db_url and (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
        if not psycopg2:
            raise ImportError("psycopg2-binary is required for Postgres. Run: pip install psycopg2-binary")
        # Fix for Render/Neon SSL
        if "sslmode" not in db_url:
            db_url += ("&" if "?" in db_url else "?") + "sslmode=require"
        conn = psycopg2.connect(db_url)
        return PostgresConnectionWrapper(conn)
    
    # Fallback to SQLite
    con = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def ensure_schema():
    con = connect()
    try:
        cur = con.cursor()
        mig_dir = Path(__file__).resolve().parents[1] / "sqlite_migrations"
        migrations = [
            "000_init.sql",
            "010_health.sql",
            "020_tasks_finance_features.sql",
            "040_planning_assistant.sql",
            "050_notifications.sql",
            "060_notification_targets.sql"
        ]
        
        is_pg = isinstance(con, PostgresConnectionWrapper)
        
        for name in migrations:
            p = mig_dir / name
            sql = p.read_text(encoding="utf-8")
            if is_pg:
                # Basic script execution for Postgres (split by semicolon)
                # Note: This is an approximation. For a real product, use a migration tool like Alembic.
                for statement in sql.split(";"):
                    s = statement.strip()
                    if s:
                        cur.execute(s)
            else:
                cur.cur.executescript(sql) if hasattr(cur, "cur") else con.executescript(sql)
        con.commit()
    finally:
        con.close()
