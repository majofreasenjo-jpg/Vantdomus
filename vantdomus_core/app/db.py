import sqlite3
from pathlib import Path
from .config import settings

def connect():
    con = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def ensure_schema():
    con = connect()
    try:
        cur = con.cursor()
        mig_dir = Path(__file__).resolve().parents[1] / "sqlite_migrations"
        for name in ["000_init.sql","010_health.sql","020_tasks_finance_features.sql","040_planning_assistant.sql","050_notifications.sql","060_notification_targets.sql"]:
            p = mig_dir / name
            cur.executescript(p.read_text(encoding="utf-8"))
        con.commit()
    finally:
        con.close()
