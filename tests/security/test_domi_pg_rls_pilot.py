"""R8: true PostgreSQL RLS adversarial tests on a DISPOSABLE local CI database.

Never points at Neon. The CI service supplies a synthetic, isolated database.
This proves mechanics for one representative tenant-pair table; it does not
certify application integration or coverage for all 57 Neon tables.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

import pytest

psycopg2 = pytest.importorskip("psycopg2")
DSN = os.getenv("DOMI_RLS_TEST_DSN", "")
pytestmark = pytest.mark.skipif(not DSN, reason="RLS pilot uses the dedicated PostgreSQL CI job")
SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_rls_pilot_v1.sql"


@pytest.fixture(scope="module", autouse=True)
def initialize_pilot():
    if not DSN:
        return
    parsed = urlsplit(DSN)
    if parsed.hostname not in {"localhost", "127.0.0.1"} or parsed.path != "/domi_rls_ci":
        pytest.fail("Refusing RLS fixture outside local disposable domi_rls_ci")
    conn = psycopg2.connect(DSN)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_user, current_database()")
                user, database = cur.fetchone()
                assert user == "postgres" and database == "domi_rls_ci"
                cur.execute(SQL_FILE.read_text(encoding="utf-8"))
    finally:
        conn.close()


@pytest.fixture
def app_connection():
    if not DSN:
        pytest.skip("No disposable PostgreSQL DSN")
    conn = psycopg2.connect(DSN)
    # SET ROLE persists; transaction-local claims MUST NOT persist.
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SET ROLE domi_pilot_app")
    conn.autocommit = False
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


def one(conn, sql, args=()):
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchone()[0]


def activate(conn, user="u-a", jti="jti-a"):
    return one(conn, "SELECT domi_pilot.activate_session(%s,%s)", (user, jti))


def visible_ids(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM domi_pilot.task_items ORDER BY id")
        return [row[0] for row in cur.fetchall()]


def test_role_has_no_admin_rights_or_bypass(app_connection):
    assert one(app_connection, "SELECT current_user") == "domi_pilot_app"
    assert one(app_connection,
        "SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole "
        "AND NOT rolcreatedb AND NOT rolcanlogin FROM pg_roles "
        "WHERE rolname=current_user") is True


def test_no_context_denies_every_row(app_connection):
    assert visible_ids(app_connection) == []
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(app_connection, "SELECT count(*) FROM domi_pilot.auth_sessions")


def test_valid_sessions_isolate_two_homes_and_organizations(app_connection):
    assert activate(app_connection, "u-a", "jti-a") is True
    assert visible_ids(app_connection) == ["t-a"]
    assert activate(app_connection, "u-b", "jti-b") is True
    assert visible_ids(app_connection) == ["t-b"]


def test_invalid_expired_disabled_or_mismatched_sessions_fail_closed(app_connection):
    for user, token in (
        ("u-a", "wrong-jti"),
        ("u-a", "jti-expired"),
        ("u-disabled", "jti-disabled"),
        ("u-b", "jti-a"),
    ):
        assert activate(app_connection, user, token) is False
        assert visible_ids(app_connection) == []


def test_insert_other_tenant_is_rejected(app_connection):
    assert activate(app_connection)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with app_connection.cursor() as cur:
            cur.execute(
                "INSERT INTO domi_pilot.task_items VALUES (%s,%s,%s,%s)",
                ("cross", "h-b", "o-b", "forbidden"),
            )


def test_mismatched_organization_is_rejected(app_connection):
    assert activate(app_connection)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with app_connection.cursor() as cur:
            cur.execute(
                "INSERT INTO domi_pilot.task_items VALUES (%s,%s,%s,%s)",
                ("mismatch", "h-a", "o-b", "forbidden"),
            )


def test_update_cannot_move_a_row_to_another_tenant(app_connection):
    assert activate(app_connection)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with app_connection.cursor() as cur:
            cur.execute(
                "UPDATE domi_pilot.task_items SET household_id='h-b', "
                "organization_id='o-b' WHERE id='t-a'"
            )


def test_delete_other_household_modifies_zero_rows(app_connection):
    assert activate(app_connection)
    with app_connection.cursor() as cur:
        cur.execute("DELETE FROM domi_pilot.task_items WHERE id='t-b'")
        assert cur.rowcount == 0


def test_forging_user_claim_without_matching_jti_fails(app_connection):
    assert activate(app_connection)
    with app_connection.cursor() as cur:
        cur.execute("SELECT pg_catalog.set_config('domi_pilot.uid','u-b',true)")
    assert visible_ids(app_connection) == []


def test_commit_clears_transaction_local_context(app_connection):
    assert activate(app_connection)
    assert visible_ids(app_connection) == ["t-a"]
    app_connection.commit()
    assert one(app_connection, "SELECT current_user") == "domi_pilot_app"
    assert visible_ids(app_connection) == []
    assert activate(app_connection)
    assert visible_ids(app_connection) == ["t-a"]


def test_revoke_session_blocks_even_previous_context(app_connection):
    assert activate(app_connection, "u-a", "jti-rev") is True
    assert visible_ids(app_connection) == ["t-a"]
    admin = psycopg2.connect(DSN)
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute(
                    "UPDATE domi_pilot.auth_sessions "
                    "SET revoked_at=clock_timestamp() WHERE id='s-rev'"
                )
        assert visible_ids(app_connection) == []
    finally:
        admin.close()


def test_separate_connections_cannot_inherit_identity(app_connection):
    assert activate(app_connection, "u-a", "jti-a")
    other = psycopg2.connect(DSN)
    try:
        other.autocommit = True
        with other.cursor() as cur:
            cur.execute("SET ROLE domi_pilot_app")
        other.autocommit = False
        assert visible_ids(other) == []
        assert activate(other, "u-b", "jti-b")
        assert visible_ids(other) == ["t-b"]
        assert visible_ids(app_connection) == ["t-a"]
    finally:
        other.close()
