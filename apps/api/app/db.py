import logging
import os
import re
import sqlite3
from pathlib import Path
from .config import settings

logger = logging.getLogger(__name__)

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
    
    # Asegurar que el directorio padre exista (ej. en deploys con DB_PATH
    # apuntando a un volumen que aún no fue montado). Sin esto, sqlite3.connect
    # tira "unable to open database file" y la app crashea al arrancar.
    db_dir = os.path.dirname(settings.DB_PATH)
    if db_dir and not os.path.isdir(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
        except OSError as exc:
            print(f"WARN: could not create DB dir {db_dir!r}: {exc}; falling back to /tmp")
            settings.DB_PATH = "/tmp/vantdomus.db"
    con = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

# Errors we consider "benign" during migration replay. These happen when a
# migration was already applied previously and the DDL is idempotent in spirit
# but not phrased with IF NOT EXISTS. They are logged at DEBUG level and the
# migration continues.
_BENIGN_MIGRATION_ERROR_FRAGMENTS = (
    "already exists",
    "duplicate column name",
    "duplicate column",
)


def _is_benign_migration_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(fragment in text for fragment in _BENIGN_MIGRATION_ERROR_FRAGMENTS)


class MigrationError(RuntimeError):
    """Raised when a schema migration fails for a non-benign reason."""


def ensure_schema():
    """
    Apply the embedded migrations in order. Fails LOUD on any non-benign error
    so a partially-applied schema can't go unnoticed in production. Benign
    errors (e.g. "table already exists" on idempotent DDL) are logged and
    skipped.
    """
    con = connect()
    try:
        cur = con.cursor()
        mig_dir = Path(__file__).resolve().parents[1] / "sqlite_migrations"
        migrations = [
            "000_init.sql", "010_health.sql", "020_tasks_finance_features.sql",
            "040_planning_assistant.sql", "050_notifications.sql", "060_notification_targets.sql",
            "070_logbook.sql", "075_logbook_v2.sql", "080_coupling.sql", "090_security_audit.sql",
            "100_organizations.sql", "110_tenant_columns.sql", "120_private_files_coupling_tenant.sql",
            "130_webhook_security.sql", "140_gateway_token_rotation.sql", "150_auth_hardening.sql",
            "160_signed_file_tokens.sql", "170_user_mfa.sql", "180_mfa_recovery_codes.sql",
            "190_security_events.sql", "200_household_invitations.sql", "210_security_event_hash_chain.sql",
            "220_auth_sessions_email_reset.sql", "230_family_presence.sql", "240_agent_hub_events.sql",
            "250_agent_traceability.sql", "260_vantguide_core.sql",
            "270_vantguide_runtime_v1.sql", "271_vantguide_micro_pre_ui.sql",
            "272_persons_user_link.sql", "273_document_route_candidates.sql",
            "274_family_board.sql", "275_household_shopping.sql",
            "276_daily_activities.sql", "277_persons_avatar_status.sql",
            "278_family_post_comments.sql", "279_assistant_proposals.sql"
        ]

        is_pg = isinstance(con, PostgresConnectionWrapper)

        for name in migrations:
            logger.info("Applying migration: %s", name)
            p = mig_dir / name
            if not p.exists():
                raise MigrationError(f"Migration file missing: {p}")
            sql = p.read_text(encoding="utf-8")

            if is_pg:
                # Statement-by-statement application so a single benign error
                # doesn't poison the whole file.
                for statement in sql.split(";"):
                    s = statement.strip()
                    if not s:
                        continue
                    s = s.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
                    s = s.replace("ON CONFLICT DO UPDATE SET", "ON CONFLICT ON CONSTRAINT ...")
                    try:
                        cur.execute(s)
                    except Exception as exc:
                        if _is_benign_migration_error(exc):
                            logger.debug(
                                "Skipping idempotent statement in %s: %s",
                                name, exc,
                            )
                            con.conn.rollback()
                            continue
                        con.conn.rollback()
                        raise MigrationError(
                            f"Migration {name} failed on statement: {s[:200]} -- {exc}"
                        ) from exc
            else:
                try:
                    con.executescript(sql)
                except Exception as exc:
                    if _is_benign_migration_error(exc):
                        logger.debug("Skipping idempotent SQLite migration %s: %s", name, exc)
                        continue
                    raise MigrationError(f"Migration {name} failed: {exc}") from exc

        con.commit()
        logger.info("Schema migrations completed.")
    except MigrationError:
        # Re-raise unchanged so the caller (or process supervisor) can react.
        raise
    except Exception as exc:
        # Unexpected catastrophe: log full context and bubble up.
        logger.exception("Unhandled error during schema migration: %s", exc)
        raise
    finally:
        con.close()
