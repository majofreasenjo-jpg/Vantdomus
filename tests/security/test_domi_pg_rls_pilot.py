"""R8: true PostgreSQL RLS adversarial tests on a DISPOSABLE local CI database.

Never points at Neon. The CI service supplies a synthetic, isolated database.
This proves mechanics for one representative tenant-pair table; it does not
certify application integration or coverage for all 57 Neon tables.
"""
from __future__ import annotations

import os
import importlib.util
import secrets
from pathlib import Path
from urllib.parse import urlsplit

import pytest

DSN = os.getenv("DOMI_RLS_TEST_DSN", "")
REQUIRED = os.getenv("DOMI_RLS_REQUIRE_LIVE", "") == "1"
if REQUIRED and not DSN:
    raise RuntimeError("Required RLS pilot DSN missing: fail closed")

psycopg2 = pytest.importorskip("psycopg2")
pytestmark = pytest.mark.skipif(not DSN, reason="Dedicated local PostgreSQL CI job only")
SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_rls_pilot_v1.sql"


def _check_disposable_dsn():
    parsed = urlsplit(DSN)
    if parsed.scheme not in {"postgres", "postgresql"} or parsed.hostname not in {"localhost", "127.0.0.1"} or parsed.path != "/domi_rls_ci":
        pytest.fail("RLS pilot cannot run against Neon, remote or non-disposable DB")


def _connect_app(password):
    return psycopg2.connect(DSN, user="domi_pilot_app", password=password)


@pytest.fixture(scope="module")
def app_password():
    if not DSN:
        pytest.skip("No isolated PostgreSQL DSN")
    _check_disposable_dsn()
    connection = psycopg2.connect(DSN)
    password = secrets.token_urlsafe(32)
    try:
        with connection:
            with connection.cursor() as cur:
                cur.execute("SELECT current_user, current_database()")
                assert cur.fetchone() == ("postgres", "domi_rls_ci")
                cur.execute(SQL_FILE.read_text(encoding="utf-8"))
                cur.execute("ALTER ROLE domi_pilot_app LOGIN PASSWORD %s", (password,))
                cur.execute("REVOKE CONNECT ON DATABASE domi_rls_ci FROM PUBLIC")
                cur.execute("GRANT CONNECT ON DATABASE domi_rls_ci TO domi_pilot_app")
    finally:
        connection.close()
    return password


@pytest.fixture
def app_connection(app_password):
    connection = _connect_app(app_password)
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


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
    assert one(app_connection, "SELECT session_user") == "domi_pilot_app"
    assert one(app_connection, "SELECT current_user") == "domi_pilot_app"
    assert one(app_connection,
        "SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole "
        "AND NOT rolcreatedb AND rolcanlogin FROM pg_roles "
        "WHERE rolname=current_user") is True


def test_unprivileged_runtime_cannot_set_superuser_role(app_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with app_connection.cursor() as cur:
            cur.execute("SET ROLE postgres")


def test_auth_secrets_and_membreships_cannot_be_queried(app_connection):
    for statement in (
        "SELECT password_hash FROM domi_pilot.users",
        "SELECT token_jti FROM domi_pilot.auth_sessions",
        "SELECT user_id FROM domi_pilot.household_memberships",
    ):
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            with app_connection.cursor() as cur:
                cur.execute(statement)
        app_connection.rollback()


def test_auth_definer_is_unprivileged_non_login(app_connection):
    count = one(app_connection,
        "SELECT count(*) FROM pg_proc p "
        "JOIN pg_namespace n ON p.pronamespace=n.oid JOIN pg_roles r ON p.proowner=r.oid "
        "WHERE n.nspname='domi_pilot' "
        "AND p.proname IN ('activate_session','verified_subject','has_household_access') "
        "AND p.prosecdef AND r.rolname='domi_pilot_auth_owner' "
        "AND NOT r.rolsuper AND NOT r.rolbypassrls "
        "AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolcanlogin")
    assert count == 3


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


def test_separate_connections_cannot_inherit_identity(app_connection, app_password):
    assert activate(app_connection, "u-a", "jti-a")
    other = _connect_app(app_password)
    try:
        assert visible_ids(other) == []
        assert activate(other, "u-b", "jti-b")
        assert visible_ids(other) == ["t-b"]
        assert visible_ids(app_connection) == ["t-a"]
    finally:
        other.close()


# R11: exercise the actual transaction-scoped Python runtime component
# against the restricted PostgreSQL login used by all the R10 tests.
SESSION_MODULE = Path(__file__).resolve().parents[2] / "apps/api/app/pg_session_context.py"
SESSION_SPEC = importlib.util.spec_from_file_location("domi_pg_session_context", SESSION_MODULE)
SESSION_MOD = importlib.util.module_from_spec(SESSION_SPEC)
SESSION_SPEC.loader.exec_module(SESSION_MOD)


def test_runtime_context_rebinds_after_commit(app_connection):
    ctx = SESSION_MOD.PgSessionContext(app_connection)
    assert ctx.bind_verified_claims("u-a", "jti-a") is True
    assert visible_ids(app_connection) == ["t-a"]
    app_connection.commit()
    ctx.after_transaction()
    assert visible_ids(app_connection) == []
    ctx.ensure_bound()
    assert visible_ids(app_connection) == ["t-a"]
    ctx.clear()


def test_runtime_context_denies_invalid_claims(app_connection):
    ctx = SESSION_MOD.PgSessionContext(app_connection)
    assert ctx.bind_verified_claims("u-b", "wrong-token") is False
    assert not ctx.authenticated
    assert visible_ids(app_connection) == []


def test_runtime_context_revocation_after_commit(app_connection):
    ctx = SESSION_MOD.PgSessionContext(app_connection)
    assert ctx.bind_verified_claims("u-a", "jti-a") is True
    assert visible_ids(app_connection) == ["t-a"]
    app_connection.commit()
    ctx.after_transaction()
    admin = psycopg2.connect(DSN)
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute(
                    "UPDATE domi_pilot.auth_sessions "
                    "SET revoked_at=clock_timestamp() WHERE id='s-a'"
                )
        with pytest.raises(PermissionError, match="revoked"):
            ctx.ensure_bound()
        assert visible_ids(app_connection) == []
    finally:
        admin.close()


def test_invalid_empty_rebind_rolls_back_pending_writes(app_connection):
    ctx = SESSION_MOD.PgSessionContext(app_connection)
    assert ctx.bind_verified_claims("u-a", "jti-a") is True
    with app_connection.cursor() as cur:
        cur.execute(
            "INSERT INTO domi_pilot.task_items VALUES (%s,%s,%s,%s)",
            ("transient-a", "h-a", "o-a", "rollback fixture"),
        )
    assert "transient-a" in visible_ids(app_connection)
    # A malformed second bind must never preserve prior SQL privileges or writes.
    assert ctx.bind_verified_claims("", "") is False
    assert ctx.authenticated is False
    assert visible_ids(app_connection) == []
    app_connection.commit()
    ctx.after_transaction()
    assert ctx.bind_verified_claims("u-a", "jti-a") is True
    assert "transient-a" not in visible_ids(app_connection)


def test_switching_valid_identity_rolls_back_prior_uncommitted_changes(app_connection):
    ctx = SESSION_MOD.PgSessionContext(app_connection)
    assert ctx.bind_verified_claims("u-a", "jti-a") is True
    with app_connection.cursor() as cur:
        cur.execute(
            "INSERT INTO domi_pilot.task_items VALUES (%s,%s,%s,%s)",
            ("transient-switch", "h-a", "o-a", "rollback fixture"),
        )
    assert ctx.bind_verified_claims("u-b", "jti-b") is True
    assert visible_ids(app_connection) == ["t-b"]
    app_connection.commit()
    ctx.after_transaction()
    assert ctx.bind_verified_claims("u-a", "jti-a") is True
    assert "transient-switch" not in visible_ids(app_connection)
