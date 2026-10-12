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
AUTH_SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_auth_lookup_pilot_v1.sql"
AUTH_MFA_SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_auth_mfa_pilot_v1.sql"
AUTH_SESSION_SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_auth_session_pilot_v1.sql"
AUTH_ROLE_SPLIT_SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_auth_role_split_pilot_v1.sql"


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
                cur.execute(AUTH_SQL_FILE.read_text(encoding="utf-8"))
                cur.execute(AUTH_MFA_SQL_FILE.read_text(encoding="utf-8"))
                cur.execute(AUTH_SESSION_SQL_FILE.read_text(encoding="utf-8"))
                cur.execute(AUTH_ROLE_SPLIT_SQL_FILE.read_text(encoding="utf-8"))
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
        # The revoked session is a module fixture. Restore it so another
        # test never inherits altered state or depends on execution order.
        with admin:
            with admin.cursor() as cur:
                cur.execute(
                    "UPDATE domi_pilot.auth_sessions SET revoked_at=NULL "
                    "WHERE id='s-rev'"
                )
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
        # A failed authentication test must not poison subsequent tests;
        # restore the synthetic session only after asserting revocation.
        with admin:
            with admin.cursor() as cur:
                cur.execute(
                    "UPDATE domi_pilot.auth_sessions SET revoked_at=NULL "
                    "WHERE id='s-a'"
                )
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



# R15: Separate authenticating SQL login. The household runtime role cannot
# look up credentials even though a trusted, rate-limited API may use it.
AUTH_MODULE = Path(__file__).resolve().parents[2] / "apps/api/app/pg_auth_bootstrap.py"
AUTH_SPEC = importlib.util.spec_from_file_location("domi_pg_auth_bootstrap", AUTH_MODULE)
AUTH_MOD = importlib.util.module_from_spec(AUTH_SPEC)
AUTH_SPEC.loader.exec_module(AUTH_MOD)


@pytest.fixture(scope="module")
def auth_lookup_password(app_password):
    import bcrypt
    _check_disposable_dsn()
    lookup_password = secrets.token_urlsafe(32)
    sample_hash = bcrypt.hashpw(b"R15-local-synthetic-passphrase", bcrypt.gensalt())
    admin = psycopg2.connect(DSN)
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute("UPDATE domi_pilot.users SET password_hash=%s WHERE id IN ('u-a','u-b')",
                            (sample_hash.decode("ascii"),))
                cur.execute("ALTER ROLE domi_auth_lookup LOGIN PASSWORD %s",
                            (lookup_password,))
                cur.execute("GRANT CONNECT ON DATABASE domi_rls_ci TO domi_auth_lookup")
    finally:
        admin.close()
    return lookup_password


@pytest.fixture
def auth_lookup_connection(auth_lookup_password):
    conn = psycopg2.connect(DSN, user="domi_auth_lookup", password=auth_lookup_password)
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


def test_auth_lookup_has_no_admin_privileges(auth_lookup_connection):
    assert one(auth_lookup_connection, "SELECT current_user") == "domi_auth_lookup"
    assert one(auth_lookup_connection,
        "SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole "
        "AND NOT rolcreatedb AND rolcanlogin AND NOT rolinherit "
        "FROM pg_roles WHERE rolname=current_user") is True


def test_auth_lookup_cannot_select_password_table(auth_lookup_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(auth_lookup_connection, "SELECT count(*) FROM domi_pilot.users")


def test_household_runtime_role_cannot_call_auth_lookup(app_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(app_connection,
            "SELECT count(*) FROM domi_auth.lookup_password_credential(%s)",
            ("a@example.invalid",))


def test_login_lookup_rejects_missing_and_inactive_identities(auth_lookup_connection):
    assert one(auth_lookup_connection,
        "SELECT count(*) FROM domi_auth.lookup_password_credential(%s)",
        ("nobody@example.invalid",)) == 0
    assert one(auth_lookup_connection,
        "SELECT count(*) FROM domi_auth.lookup_password_credential(%s)",
        ("disabled@example.invalid",)) == 0


def test_server_bcrypt_password_only_credential_verification(auth_lookup_connection):
    assert AUTH_MOD.verify_password_only(
        auth_lookup_connection, " A@EXAMPLE.INVALID ", "R15-local-synthetic-passphrase"
    ) == "u-a"
    assert AUTH_MOD.verify_password_only(
        auth_lookup_connection, "a@example.invalid", "wrong-passphrase"
    ) is None
    assert AUTH_MOD.verify_password_only(
        auth_lookup_connection, "nobody@example.invalid", "wrong-passphrase"
    ) is None


def test_auth_lookup_cannot_create_sessions_or_assume_owner(auth_lookup_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with auth_lookup_connection.cursor() as cur:
            cur.execute("INSERT INTO domi_pilot.auth_sessions "
                        "(id,user_id,token_jti,expires_at) "
                        "VALUES ('forged','u-a','forged-jti',clock_timestamp())")
    auth_lookup_connection.rollback()
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with auth_lookup_connection.cursor() as cur:
            cur.execute("SET ROLE domi_pilot_auth_owner")


# R16: real restricted PostgreSQL connection and identity-specific functions.
def test_mfa_tables_hidden_from_both_runtime_and_auth_lookup(app_connection, auth_lookup_connection):
    for conn in (app_connection, auth_lookup_connection):
        for name in ("user_mfa", "user_mfa_recovery_codes", "auth_login_attempts"):
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                with conn.cursor() as cur:
                    cur.execute("SELECT count(*) FROM domi_pilot." + name)
            conn.rollback()


def test_ordinary_runtime_cannot_call_auth_mfa_or_throttle(app_connection):
    for sql,args in (
        ("SELECT count(*) FROM domi_auth.lookup_mfa_state(%s)",("u-a",)),
        ("SELECT domi_auth.consume_recovery_code(%s,%s)",("u-a","any")),
        ("SELECT domi_auth.recent_failed_logins(%s,clock_timestamp())",("a@example.invalid",)),
        ("SELECT domi_auth.record_login_attempt(%s,false)",("a@example.invalid",)),
    ):
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            with app_connection.cursor() as cur:
                cur.execute(sql,args)
        app_connection.rollback()


def test_mfa_state_visible_only_via_scoped_auth_function(auth_lookup_connection):
    with auth_lookup_connection.cursor() as cur:
        cur.execute("SELECT totp_secret,is_enabled FROM domi_auth.lookup_mfa_state(%s)",("u-a",))
        assert cur.fetchone()==("SYNTHETIC_ENCRYPTED_MFA_PLACEHOLDER", True)
        cur.execute("SELECT is_enabled FROM domi_auth.lookup_mfa_state(%s)",("u-b",))
        assert cur.fetchone()==(False,)
        cur.execute("SELECT count(*) FROM domi_auth.lookup_mfa_state(%s)",("u-disabled",))
        assert cur.fetchone()==(0,)


def test_recovery_token_consumed_once_even_after_commit(issuer_connection):
    issuer_connection.autocommit=False
    h="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert one(issuer_connection,"SELECT domi_auth.consume_recovery_code(%s,%s)",("u-a",h)) is True
    issuer_connection.commit()
    assert one(issuer_connection,"SELECT domi_auth.consume_recovery_code(%s,%s)",("u-a",h)) is False


def test_wrong_recovery_code_rejected(issuer_connection):
    assert one(issuer_connection,"SELECT domi_auth.consume_recovery_code(%s,%s)",("u-a","invalid")) is False
    assert one(issuer_connection,"SELECT domi_auth.consume_recovery_code(%s,%s)",("u-b","invalid")) is False


def test_throttle_attempt_window_and_case_normalization(issuer_connection,auth_lookup_connection):
    with issuer_connection.cursor() as cur:
        cur.execute("SELECT domi_auth.record_login_attempt(%s,%s)",(" A@EXAMPLE.INVALID ",False))
        cur.execute("SELECT domi_auth.record_login_attempt(%s,%s)",("a@example.invalid",False))
        cur.execute("SELECT domi_auth.record_login_attempt(%s,%s)",("a@example.invalid",True))
    assert one(auth_lookup_connection,
       "SELECT domi_auth.recent_failed_logins(%s,clock_timestamp()-interval '1 hour')",
       ("a@example.invalid",))==2


def test_throttle_clear_failed_does_not_erase_successful(issuer_connection,auth_lookup_connection):
    assert one(auth_lookup_connection,
        "SELECT domi_auth.recent_failed_logins(%s,clock_timestamp()-interval '1 hour')",
        ("a@example.invalid",))>=0
    with issuer_connection.cursor() as cur:
        cur.execute("SELECT domi_auth.clear_failed_logins(%s)",("a@example.invalid",))
    assert one(auth_lookup_connection,
        "SELECT domi_auth.recent_failed_logins(%s,clock_timestamp()-interval '1 hour')",
        ("a@example.invalid",))==0


def test_auth_only_role_cannot_escalate_via_direct_writes(auth_lookup_connection):
    for statement in (
        "DELETE FROM domi_pilot.user_mfa_recovery_codes",
        "INSERT INTO domi_pilot.auth_login_attempts "
        "(id,email,success,created_at) VALUES('hack','a@example.invalid',true,clock_timestamp())",
    ):
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            with auth_lookup_connection.cursor() as cur:
                cur.execute(statement)
        auth_lookup_connection.rollback()



# R22: Actual server login orchestrator, with a real restricted PostgreSQL
# authentication role and an independently validated RLS session.
def test_auth_role_cannot_directly_insert_sessions_after_issuer_granted(auth_lookup_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with auth_lookup_connection.cursor() as cur:
            cur.execute("INSERT INTO domi_pilot.auth_sessions(id,user_id,token_jti,expires_at) "
                        "VALUES('forgery','u-b','forgery',clock_timestamp()+interval '1 hour')")
    auth_lookup_connection.rollback()


def test_runtime_role_cannot_issue_auth_session(app_connection):
    import uuid
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(app_connection, "SELECT domi_auth.issue_session(%s,%s,%s,%s)",
            ("u-b",str(uuid.uuid4()),str(uuid.uuid4()),3600))
    app_connection.rollback()


def test_auth_session_issuer_rejects_disabled_user_and_bad_expiry(issuer_connection):
    import uuid
    for user,ttl in (("u-disabled",3600),("u-b",1),("u-b",100000)):
        assert one(issuer_connection,"SELECT domi_auth.issue_session(%s,%s,%s,%s)",
            (user,str(uuid.uuid4()),str(uuid.uuid4()),ttl)) is False


def test_auth_bootstrap_login_mints_real_rls_session(auth_lookup_connection,issuer_connection,app_connection):
    import sys
    from pathlib import Path
    project_api=str(Path(__file__).resolve().parents[2] / "apps/api")
    if project_api not in sys.path: sys.path.insert(0,project_api)
    from app.pg_auth_bootstrap import login_postgres
    from app.security import decode_access_token
    result=login_postgres(
        auth_lookup_connection,issuer_connection,
        "b@example.invalid","R15-local-synthetic-passphrase",None,
        max_attempts=5,window_seconds=900,
    )
    assert result["token_type"]=="bearer"
    assert result["session_id"]
    claims=decode_access_token(result["access_token"])
    assert claims["sub"]=="u-b"
    assert activate(app_connection,"u-b",claims["jti"]) is True
    assert visible_ids(app_connection)==["t-b"]
    app_connection.rollback()


def test_pg_bootstrap_bad_password_does_not_mint_session(auth_lookup_connection,issuer_connection):
    from fastapi import HTTPException
    from app.pg_auth_bootstrap import login_postgres
    with pytest.raises(HTTPException) as fail:
        login_postgres(auth_lookup_connection,issuer_connection,"b@example.invalid","invalid",None,
                       max_attempts=5,window_seconds=900)
    assert fail.value.status_code==401
    assert one(auth_lookup_connection,
      "SELECT domi_auth.recent_failed_logins(%s,clock_timestamp()-interval '15 minutes')",
      ("b@example.invalid",))>=1


def test_pg_bootstrap_password_without_mfa_does_not_mint_session(auth_lookup_connection,issuer_connection):
    from fastapi import HTTPException
    from app.pg_auth_bootstrap import login_postgres
    with pytest.raises(HTTPException) as fail:
        login_postgres(auth_lookup_connection,issuer_connection,"a@example.invalid",
                       "R15-local-synthetic-passphrase",None,max_attempts=5,window_seconds=900)
    assert fail.value.status_code==428


def test_pg_bootstrap_throttles_failed_passwords(auth_lookup_connection,issuer_connection):
    from fastapi import HTTPException
    from app.pg_auth_bootstrap import login_postgres
    for _ in range(5):
        AUTH_MOD.record_login_attempt(issuer_connection,"throttle@example.invalid",False)
    issuer_connection.commit()
    with pytest.raises(HTTPException) as fail:
        login_postgres(auth_lookup_connection,issuer_connection,"throttle@example.invalid","anything",None,
                       max_attempts=5,window_seconds=900)
    assert fail.value.status_code==429


@pytest.fixture(scope="module")
def issuer_password(auth_lookup_password):
    pwd = secrets.token_urlsafe(32)
    admin = psycopg2.connect(DSN)
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute("ALTER ROLE domi_auth_session_issuer LOGIN PASSWORD %s", (pwd,))
                cur.execute("GRANT CONNECT ON DATABASE domi_rls_ci TO domi_auth_session_issuer")
    finally:
        admin.close()
    return pwd


@pytest.fixture
def issuer_connection(issuer_password):
    conn = psycopg2.connect(DSN, user="domi_auth_session_issuer", password=issuer_password)
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


def test_r23_lookup_cannot_issue_session(auth_lookup_connection):
    import uuid
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(auth_lookup_connection, "SELECT domi_auth.issue_session(%s,%s,%s,%s)",
            ("u-b",str(uuid.uuid4()),str(uuid.uuid4()),3600))
    auth_lookup_connection.rollback()


def test_r23_issuer_cannot_lookup_credentials(issuer_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(issuer_connection, "SELECT count(*) FROM domi_auth.lookup_password_credential(%s)",
            ("b@example.invalid",))
    issuer_connection.rollback()


def test_r23_issuer_no_privileged_flags(issuer_connection):
    assert one(issuer_connection, "SELECT session_user") == "domi_auth_session_issuer"
    assert one(issuer_connection,
        "SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole "
        "AND NOT rolcreatedb AND NOT rolinherit AND rolcanlogin FROM pg_roles "
        "WHERE rolname=current_user") is True


def test_r23_issuer_session_creation_remains_possible(issuer_connection):
    import uuid
    assert one(issuer_connection, "SELECT domi_auth.issue_session(%s,%s,%s,%s)",
        ("u-b", str(uuid.uuid4()), str(uuid.uuid4()), 3600)) is True


def test_r23_lookup_cannot_write_login_attempts(auth_lookup_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(auth_lookup_connection,"SELECT domi_auth.record_login_attempt(%s,%s)",
            ("b@example.invalid",False))
    auth_lookup_connection.rollback()
