"""Restricted authentication connection for PostgreSQL staging (opt-in only).

Authentication must not use the household application's data-access login.
This dependency preserves SQLite behavior, but PostgreSQL requires a distinct
server-only secret and a role explicitly named domi_auth_lookup.

This connection grants no client-side access and MUST never be exposed to a
browser, web Preview or mobile app. It is disabled by default.
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit

from fastapi import HTTPException

from .config import settings
from .db import connect


class PgBootstrapAuthConnection:
    """Marks a validated authentication-only connection for the login route."""

    def __init__(self, connection):
        self.conn = connection

    def close(self):
        return self.conn.close()


def _target(dsn: str) -> tuple[str, str, int]:
    parsed = urlsplit(dsn)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname or not parsed.path.strip("/"):
        raise ValueError("Database target incomplete")
    # Direct and PgBouncer pooler endpoints of the same Neon host are equivalent.
    host = parsed.hostname.replace("-pooler.", ".")
    return host, parsed.path, parsed.port or 5432


def get_login_db():
    runtime_dsn = settings.DATABASE_URL or os.getenv("DATABASE_URL", "")
    if not runtime_dsn.startswith(("postgres://", "postgresql://")):
        db = connect()
        try:
            yield db
        finally:
            db.close()
        return

    if os.getenv("DOMI_ENABLE_PG_AUTH_LOGIN", "") != "1":
        raise HTTPException(status_code=503, detail="PostgreSQL login not yet enabled")
    auth_dsn = os.getenv("DOMI_AUTH_DATABASE_URL", "")
    try:
        if _target(runtime_dsn) != _target(auth_dsn):
            raise ValueError("Separate Neon target")
    except ValueError:
        raise HTTPException(status_code=503, detail="Authentication database not configured")

    try:
        import psycopg2
        raw = psycopg2.connect(auth_dsn, sslmode="require", connect_timeout=5)
        try:
            with raw.cursor() as cur:
                cur.execute(
                    "SELECT session_user,current_user,"
                    "(SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole "
                    "AND NOT rolcreatedb AND NOT rolinherit FROM pg_roles WHERE rolname=current_user)"
                )
                session_user, current_user, safe = cur.fetchone()
                if session_user != "domi_auth_lookup" or current_user != session_user or not safe:
                    raise ValueError("Unsafe PostgreSQL authentication role")
            raw.rollback()
        except Exception:
            raw.close()
            raise
    except Exception:
        # Never include the DSN, credentials or server exception in API errors.
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    try:
        yield PgBootstrapAuthConnection(raw)
    finally:
        raw.rollback()
        raw.close()
