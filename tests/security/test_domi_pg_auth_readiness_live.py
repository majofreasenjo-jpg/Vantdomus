"""R49: execute R48 catalog gates against disposable PostgreSQL 16.

DO NOT use with Neon. Requires the R8 synthetic auth-pilot fixture to have
run first in the same disposable GitHub Actions Postgres service.
"""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path
from urllib.parse import urlsplit

import pytest

psycopg2 = pytest.importorskip("psycopg2")
from psycopg2.extras import RealDictCursor

DSN = os.getenv("DOMI_RLS_TEST_DSN", "")
REQUIRE = os.getenv("DOMI_RLS_REQUIRE_LIVE", "") == "1"
if REQUIRE and not DSN:
    raise RuntimeError("R49 requires dedicated disposable PostgreSQL")

pytestmark = pytest.mark.skipif(not DSN, reason="Disposable PG service only")
ROOT = Path(__file__).resolve().parents[2]
APP_PATH = str(ROOT / "apps/api")
if APP_PATH not in sys.path:
    sys.path.insert(0, APP_PATH)
from app.pg_auth_readiness import check_signed_auth_login_readiness


class Catalog:
    """Minimal real psycopg2 adapter implementing the production query API."""

    def __init__(self, conn):
        self.conn = conn
        self.cursor = None

    def execute(self, query):
        self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        self.cursor.execute(query)
        return self

    def fetchone(self):
        try:
            return self.cursor.fetchone()
        finally:
            self.cursor.close()
            self.cursor = None


def disposable_only():
    parsed = urlsplit(DSN)
    if (parsed.scheme not in ("postgres", "postgresql")
            or parsed.hostname not in ("localhost", "127.0.0.1")
            or parsed.path != "/domi_rls_ci"):
        pytest.fail("R49 rejects remote or non-disposable PostgreSQL")


# Real signatures from the existing synthetic auth pilot (not Neon migrations).
_GRANTED = (
    ("lookup_password_credential(text)", "domi_auth_lookup"),
    ("lookup_mfa_state(text)", "domi_auth_lookup"),
    ("recent_failed_logins(text,timestamptz)", "domi_auth_lookup"),
    ("prepare_session_proof(text,text,text,integer,bigint,text,text)",
     "domi_auth_lookup"),
    ("record_login_attempt(text,boolean)", "domi_auth_session_issuer"),
    ("clear_failed_logins(text)", "domi_auth_session_issuer"),
    ("consume_recovery_code(text,text)", "domi_auth_session_issuer"),
    ("rotate_mfa_secret(text,text,text)", "domi_auth_session_issuer"),
    ("issue_session_bound(text,text,text,integer,text)",
     "domi_auth_session_issuer"),
)


@pytest.fixture(scope="module")
def setup_auth():
    disposable_only()
    admin = psycopg2.connect(DSN)
    app = None
    password = secrets.token_urlsafe(48)
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute("SELECT current_database(),current_user")
                assert cur.fetchone() == ("domi_rls_ci", "postgres")
                cur.execute("SELECT to_regprocedure("
                            "'domi_auth.prepare_session_proof(text,text,text,integer,bigint,text,text)')")
                assert cur.fetchone()[0] is not None, "R8 pilot did not run"
                cur.execute(
                    "CREATE ROLE domi_app_runtime NOLOGIN NOINHERIT "
                    "NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION"
                )
                cur.execute(
                    "CREATE ROLE domi_r49_gate_login LOGIN NOINHERIT "
                    "NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB "
                    "NOREPLICATION PASSWORD %s", (password,)
                )
                cur.execute(
                    "GRANT CONNECT ON DATABASE domi_rls_ci TO domi_r49_gate_login"
                )
                cur.execute("ALTER ROLE domi_auth_lookup LOGIN")
                cur.execute("ALTER ROLE domi_auth_session_issuer LOGIN")
                cur.execute(
                    "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA domi_auth FROM PUBLIC"
                )
                cur.execute(
                    "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA domi_auth "
                    "FROM domi_auth_lookup,domi_auth_session_issuer"
                )
                cur.execute(
                    "GRANT USAGE ON SCHEMA domi_auth "
                    "TO domi_auth_lookup,domi_auth_session_issuer"
                )
                for signature, principal in _GRANTED:
                    cur.execute(
                        "GRANT EXECUTE ON FUNCTION domi_auth."
                        + signature + " TO " + principal
                    )
        app = psycopg2.connect(
            DSN, user="domi_r49_gate_login", password=password
        )
        app.autocommit = True
        yield admin, app
    finally:
        if app is not None:
            app.close()
        admin.rollback()
        admin.close()


def expect_denial(admin, sql, code):
    """Apply adversarial DDL in a single transaction, then always rollback."""
    try:
        with admin.cursor() as cur:
            cur.execute(sql)
        with pytest.raises(RuntimeError, match=code):
            check_signed_auth_login_readiness(Catalog(admin))
    finally:
        admin.rollback()


def test_r49_real_pg_minimal_catalog_gate_accepts_restricted_login(setup_auth):
    _, app = setup_auth
    with app.cursor() as cur:
        cur.execute("SELECT current_user,rolbypassrls FROM pg_catalog.pg_roles "
                    "WHERE rolname=current_user")
        assert cur.fetchone() == ("domi_r49_gate_login", False)
    # Execute exact production SQL as a non-owner LOGIN, not a fake executor.
    check_signed_auth_login_readiness(Catalog(app))


def test_r49_real_pg_blocks_column_grant(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin,
        "CREATE TABLE public.r49_temporary_secret(secret text); "
        "GRANT SELECT(secret) ON public.r49_temporary_secret TO domi_auth_lookup",
        "POSTGRES_AUTH_LOGIN_GRANTS_GATE",
    )


def test_r49_real_pg_blocks_role_membership_even_with_noinherit(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin, "GRANT domi_pilot_auth_owner TO domi_auth_lookup",
        "POSTGRES_AUTH_LOGIN_ROLES_GATE",
    )


def test_r49_real_pg_blocks_public_function_execute(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin,
        "GRANT EXECUTE ON FUNCTION domi_auth.lookup_mfa_state(text) TO PUBLIC",
        "POSTGRES_AUTH_LOGIN_FUNCTION_GATE",
    )


def test_r49_real_pg_blocks_unexpected_legacy_function(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin,
        "GRANT EXECUTE ON FUNCTION "
        "domi_auth.issue_session(text,text,text,integer) "
        "TO domi_auth_session_issuer",
        "POSTGRES_AUTH_LOGIN_EXTRA_FUNCTION_GATE",
    )


def test_r49_real_pg_blocks_cross_role_execute(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin,
        "GRANT EXECUTE ON FUNCTION domi_auth.lookup_mfa_state(text) "
        "TO domi_auth_session_issuer",
        "POSTGRES_AUTH_LOGIN_FUNCTION_GATE",
    )


def test_r49_real_pg_blocks_insecure_definer_search_path(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin,
        "ALTER FUNCTION domi_auth.lookup_mfa_state(text) "
        "SET search_path TO public,pg_temp",
        "POSTGRES_AUTH_LOGIN_FUNCTION_GATE",
    )


def test_r49_real_pg_blocks_definer_to_invoker(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin,
        "ALTER FUNCTION domi_auth.lookup_mfa_state(text) SECURITY INVOKER",
        "POSTGRES_AUTH_LOGIN_FUNCTION_GATE",
    )


def test_r49_real_pg_blocks_second_signature_overload(setup_auth):
    admin, _ = setup_auth
    expect_denial(
        admin,
        "CREATE FUNCTION domi_auth.lookup_password_credential(text,text) "
        "RETURNS text LANGUAGE sql AS 'SELECT NULL::text'; "
        "GRANT EXECUTE ON FUNCTION "
        "domi_auth.lookup_password_credential(text,text) TO domi_auth_lookup",
        "POSTGRES_AUTH_LOGIN_EXTRA_FUNCTION_GATE",
    )
