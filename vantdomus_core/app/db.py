import sqlite3
import os
import re
from pathlib import Path
from .config import settings

# Conditional import for Postgres
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None

def translate_sqlite_to_pg(sql: str) -> str:
    """Translates common SQLite patterns to Postgres."""
    if not sql: return sql
    
    # 1. Replace ? with %s
    sql = sql.replace("?", "%s")
    
    # 2. Translate json_extract(col, '$.path.key') to col -> 'path' ->> 'key'
    # Simplified version for the patterns used in VantDomus
    # json_extract(payload, '$.checkin.status') => payload->'checkin'->>'status'
    def replace_json(match):
        col = match.group(1)
        path = match.group(2).strip("$.").split(".")
        if not path or path == [""]: return col
        
        # Build path access with jsonb cast because SQLite stores it as TEXT
        # [a, b, c] -> col::jsonb->'a'->'b'->>'c'
        acc = f"{col}::jsonb"
        for i, part in enumerate(path):
            op = "->>" if i == len(path)-1 else "->"
            acc += f"{op}'{part}'"
        return acc

    sql = re.sub(r"json_extract\s*\(\s*(\w+)\s*,\s*['\"]([^'\"]+)['\"]\s*\)", replace_json, sql)
    
    return sql

class PostgresRow(dict):
    """Mimics sqlite3.Row behavior by allowing both key and index access."""
    def __init__(self, data_dict):
        if data_dict is None: data_dict = {}
        super().__init__(data_dict)
        self._key_list = list(self.keys())

    def __getitem__(self, key):
        try:
            if isinstance(key, int):
                return super().__getitem__(self._key_list[key])
            return super().__getitem__(key)
        except (IndexError, KeyError) as e:
            print(f"PostgresRow Access Error: key={key}, available={self._key_list}")
            raise e

class PostgresCursorWrapper:
    def __init__(self, pg_cursor):
        self.cur = pg_cursor

    def execute(self, sql, params=None):
        translated_sql = translate_sqlite_to_pg(sql)
        try:
            return self.cur.execute(translated_sql, params)
        except Exception as e:
            print(f"PG EXECUTE ERROR: {e}")
            print(f"ORIGINAL SQL: {sql}")
            print(f"TRANSLATED SQL: {translated_sql}")
            print(f"PARAMS: {params}")
            raise e

    def fetchone(self):
        r = self.cur.fetchone()
        return PostgresRow(dict(r)) if r else None

    def fetchall(self):
        return [PostgresRow(dict(r)) for r in self.cur.fetchall()]

    @property
    def rowcount(self):
        return self.cur.rowcount

class PostgresConnectionWrapper:
    def __init__(self, pg_conn):
        self.conn = pg_conn

    def cursor(self):
        return PostgresCursorWrapper(self.conn.cursor(cursor_factory=RealDictCursor))

    def execute(self, sql, params=None):
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
            raise ImportError("psycopg2-binary is required for Postgres.")
        if "sslmode" not in db_url:
            db_url += ("&" if "?" in db_url else "?") + "sslmode=require"
        try:
            conn = psycopg2.connect(db_url)
            return PostgresConnectionWrapper(conn)
        except Exception as e:
            print(f"DATABASE CONNECTION ERROR: {e}")
            raise e
    
    con = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def ensure_schema():
    con = connect()
    try:
        cur = con.cursor()
        mig_dir = Path(__file__).resolve().parents[1] / "sqlite_migrations"
        migrations = [
            "000_init.sql", "010_health.sql", "020_tasks_finance_features.sql",
            "040_planning_assistant.sql", "050_notifications.sql", "060_notification_targets.sql"
        ]
        
        is_pg = isinstance(con, PostgresConnectionWrapper)
        
        for name in migrations:
            print(f"Applying migration: {name}")
            p = mig_dir / name
            sql = p.read_text(encoding="utf-8")
            
            # Simple PG translation for schema: INTEGER -> BIGINT, etc. if needed
            if is_pg:
                # Basic split by semicolon
                for statement in sql.split(";"):
                    s = statement.strip()
                    if not s: continue
                    # Translation specific for schema scripts
                    s = s.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
                    s = s.replace("ON CONFLICT DO UPDATE SET", "ON CONFLICT ON CONSTRAINT ...") # Placeholder logic
                    try:
                        cur.execute(s)
                    except Exception as e:
                        if "already exists" in str(e).lower(): continue
                        print(f"Migration Error in {name}: {e}")
                        con.conn.rollback()
            else:
                try:
                    con.executescript(sql)
                except Exception:
                    pass
        con.commit()
    except Exception as e:
        print(f"SCHEMA ERROR: {e}")
    finally:
        con.close()
