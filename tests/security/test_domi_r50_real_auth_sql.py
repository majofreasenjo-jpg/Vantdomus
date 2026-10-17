"""R51 exercise R50 real-schema auth migration only in disposable PostgreSQL.

Run this LAST, after the existing R31 CI suite has created public 57-table
RLS schema. No remote DSN, credentials, live user data, or production access.
"""
from __future__ import annotations
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit
import pytest

psycopg2 = pytest.importorskip("psycopg2")
from psycopg2.extras import RealDictCursor

DSN = os.getenv("DOMI_RLS_TEST_DSN", "")
REQUIRED = os.getenv("DOMI_RLS_REQUIRE_LIVE", "") == "1"
if REQUIRED and not DSN:
    raise RuntimeError("R51 disposable SQL DSN is mandatory")
pytestmark = pytest.mark.skipif(not DSN, reason="disposable PostgreSQL CI only")
ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "apps/api/postgres_staging_migrations/security"
sys.path.insert(0, str(ROOT / "apps/api"))
from app.pg_auth_readiness import check_signed_auth_login_readiness


def only_disposable():
    u = urlsplit(DSN)
    if (u.scheme not in ("postgres", "postgresql") or
        u.hostname not in ("127.0.0.1", "localhost") or
        u.path != "/domi_rls_ci"):
        pytest.fail("R51 forbids a remote/non-disposable database")


class Catalog:
    def __init__(self, conn):
        self.conn = conn
    def execute(self, sql):
        with self.conn.cursor(cursor_factory=RealDictCursor) as c:
            c.execute(sql)
            self.row = c.fetchone()
        return self
    def fetchone(self):
        return self.row


@pytest.fixture(scope="module")
def provisioned():
    only_disposable()
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    try:
        with conn.cursor() as c:
            c.execute("SELECT current_user,current_database()")
            assert c.fetchone() == ("postgres", "domi_rls_ci")
            c.execute("SELECT count(*) FROM pg_catalog.pg_class c JOIN "
                      "pg_catalog.pg_namespace n ON n.oid=c.relnamespace "
                      "WHERE n.nspname='public' AND c.relkind='r' "
                      "AND c.relrowsecurity AND c.relforcerowsecurity")
            assert c.fetchone()[0] == 57, "run R31 suite before R51"
            c.execute((SCRIPTS/"303_domi_r50_real_auth_up.sql").read_text())
            c.execute("SELECT count(*) FROM pg_catalog.pg_proc p "
                      "JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace "
                      "WHERE n.nspname='domi_auth'")
            assert c.fetchone()[0] == 9
            c.execute("SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname "
                      "IN ('domi_auth_lookup','domi_auth_session_issuer') "
                      "AND rolcanlogin")
            assert c.fetchone()[0] == 0
        yield conn
        # Fail-closed disable tested before rollback: no DDL/dataset persists.
        with conn.cursor() as c:
            c.execute((SCRIPTS/"304_domi_r51_auth_fail_closed_disable.sql").read_text())
            c.execute("SELECT count(*) FROM pg_catalog.pg_class c "
                      "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace "
                      "WHERE n.nspname='public' AND c.relkind='r' "
                      "AND c.relrowsecurity AND c.relforcerowsecurity")
            assert c.fetchone()[0] == 57
    finally:
        conn.rollback()
        conn.close()


def one(conn, query, params=None):
    with conn.cursor() as c:
        c.execute(query, params or ())
        return c.fetchone()[0]


def test_r51_isolation_roles_cannot_login_without_provisioning(provisioned):
    assert one(provisioned, "SELECT count(*) FROM pg_roles WHERE rolname IN "
               "('domi_auth_lookup','domi_auth_session_issuer') AND NOT rolcanlogin") == 2


def test_r51_grants_are_exactly_split(provisioned):
    assert one(provisioned,
               "SELECT has_function_privilege('domi_auth_lookup',"
               "'domi_auth.lookup_password_credential(text)','EXECUTE')") is True
    assert one(provisioned,
               "SELECT has_function_privilege('domi_auth_session_issuer',"
               "'domi_auth.lookup_password_credential(text)','EXECUTE')") is False
    assert one(provisioned,
               "SELECT has_function_privilege('domi_auth_session_issuer',"
               "'domi_auth.issue_session_bound(text,text,text,integer,text)','EXECUTE')") is True


def test_r51_no_hmac_secret_fails_closed(provisioned):
    # There is no operational secret in source or fixture.
    assert one(provisioned, "SELECT count(*) FROM domi_auth.attestation_secrets") == 0
    assert one(provisioned, "SELECT domi_auth.prepare_session_proof("
               "'u-a','11111111-1111-1111-1111-111111111111',"
               "'22222222-2222-2222-2222-222222222222',3600,"
               "extract(epoch from clock_timestamp())::bigint,"
               "'0123456789abcdef0123456789abcdef',repeat('0',64))") is None


def test_r51_proof_cannot_be_issued_without_preparation(provisioned):
    assert one(provisioned, "SELECT domi_auth.issue_session_bound("
               "'u-a','11111111-1111-1111-1111-111111111111',"
               "'22222222-2222-2222-2222-222222222222',3600,"
               "'33333333-3333-3333-3333-333333333333')") is False


def test_r51_runtime_never_executes_auth_lookup(provisioned):
    assert one(provisioned,
               "SELECT has_function_privilege('domi_app_runtime',"
               "'domi_auth.lookup_password_credential(text)','EXECUTE')") is False


def test_r51_procedure_catalog_matches_required_signatures(provisioned):
    # Auth roles remain NOLOGIN until a separately authorized staging operation.
    # Test the full function metadata via a *transaction-local* test role
    # property change, then revert before returning to the fixture.
    with provisioned.cursor() as cur:
        cur.execute("SAVEPOINT r51_login_probe")
        cur.execute("ALTER ROLE domi_auth_lookup LOGIN")
        cur.execute("ALTER ROLE domi_auth_session_issuer LOGIN")
    try:
        check_signed_auth_login_readiness(Catalog(provisioned))
    finally:
        with provisioned.cursor() as cur:
            cur.execute("ROLLBACK TO SAVEPOINT r51_login_probe")
            cur.execute("RELEASE SAVEPOINT r51_login_probe")
