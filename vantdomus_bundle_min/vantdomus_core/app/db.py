from contextlib import contextmanager
import psycopg
from app.config import settings

@contextmanager
def get_conn():
    conn = psycopg.connect(settings.DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def fetch_one(conn, q: str, params=None):
    with conn.cursor() as cur:
        cur.execute(q, params or ())
        return cur.fetchone()

def fetch_all(conn, q: str, params=None):
    with conn.cursor() as cur:
        cur.execute(q, params or ())
        return cur.fetchall()

def execute(conn, q: str, params=None):
    with conn.cursor() as cur:
        cur.execute(q, params or ())
        return cur.rowcount
