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
AUTH_PROOF_SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_auth_proof_pilot_v1.sql"
AUTH_ATTEST_SQL_FILE = Path(__file__).resolve().parent / "sql" / "domi_auth_hmac_pilot_v1.sql"


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
                cur.execute(AUTH_PROOF_SQL_FILE.read_text(encoding="utf-8"))
                cur.execute(AUTH_ATTEST_SQL_FILE.read_text(encoding="utf-8"))
                # Cryptographic test secret is random and never persisted in git.
                secret = secrets.token_urlsafe(48)
                cur.execute(
                    "INSERT INTO domi_pilot.auth_attestation_secrets(key_name,secret_key) "
                    "VALUES('active',convert_to(%s,'UTF8'))",(secret,)
                )
                os.environ["DOMI_AUTH_ATTESTATION_SECRET"] = secret
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
# Import the application module by its real package name. A direct
# importlib.spec_from_file_location() load loses package context, breaking
# legitimate relative imports in pg_session_context.py.
import sys
APP_PATH = str(Path(__file__).resolve().parents[2] / "apps/api")
if APP_PATH not in sys.path:
    sys.path.insert(0,APP_PATH)
import app.pg_session_context as SESSION_MOD


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




def signed_attestation_args(user_id: str, sid: str, jti: str, ttl: int = 3600,
                             *, issued_epoch=None, nonce=None):
    t,n,mac=AUTH_MOD.sign_session_attestation(user_id,sid,jti,ttl,
        issued_epoch=issued_epoch,nonce=nonce)
    return (user_id,sid,jti,ttl,t,n,mac)


def prepare_signed_proof(conn,user_id,sid,jti,ttl: int = 3600,
                         *, issued_epoch=None, nonce=None):
    args=signed_attestation_args(user_id,sid,jti,ttl,issued_epoch=issued_epoch,nonce=nonce)
    return one(conn,"SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)",args)

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
    # A different LOGIN connection must not see uncommitted login history.
    assert one(auth_lookup_connection,
       "SELECT domi_auth.recent_failed_logins(%s,clock_timestamp()-interval '1 hour')",
       ("a@example.invalid",))==0
    issuer_connection.commit()
    # The read-only lookup is deliberately separate: visibility starts at COMMIT.
    assert one(auth_lookup_connection,
       "SELECT domi_auth.recent_failed_logins(%s,clock_timestamp()-interval '1 hour')",
       ("a@example.invalid",))==2


def test_throttle_clear_failed_does_not_erase_successful(issuer_connection,auth_lookup_connection):
    # Independent fixture: a successful login must survive clearing failures.
    email = "clear-test@example.invalid"
    with issuer_connection.cursor() as cur:
        cur.execute("SELECT domi_auth.record_login_attempt(%s,%s)",(email,False))
        cur.execute("SELECT domi_auth.record_login_attempt(%s,%s)",(email,False))
        cur.execute("SELECT domi_auth.record_login_attempt(%s,%s)",(email,True))
    issuer_connection.commit()
    count_sql = "SELECT domi_auth.recent_failed_logins(%s,clock_timestamp()-interval '1 hour')"
    assert one(auth_lookup_connection,count_sql,(email,)) == 2
    with issuer_connection.cursor() as cur:
        cur.execute("SELECT domi_auth.clear_failed_logins(%s)",(email,))
    # PostgreSQL must hide deletion until the issuer commits.
    assert one(auth_lookup_connection,count_sql,(email,)) == 2
    issuer_connection.commit()
    assert one(auth_lookup_connection,count_sql,(email,)) == 0
    # An admin-only assertion in a disposable CI database verifies that
    # clearing failed attempts did not erase the successful audit record.
    admin = psycopg2.connect(DSN)
    try:
        assert one(admin,
            "SELECT COUNT(*) FROM domi_pilot.auth_login_attempts WHERE email=%s AND success",
            (email,)) == 1
    finally:
        admin.close()


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


def test_auth_session_issuer_rejects_disabled_user_and_bad_expiry(issuer_connection,auth_lookup_connection):
    import uuid
    for user,ttl in (("u-disabled",3600),("u-b",1),("u-b",100000)):
        sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
        proof=prepare_signed_proof(auth_lookup_connection,user,sid,jti)
        auth_lookup_connection.commit()
        assert one(issuer_connection,
          "SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)",
          (user,sid,jti,ttl,proof)) is False
        issuer_connection.rollback()


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


def test_r23_issuer_session_creation_remains_possible(issuer_connection,auth_lookup_connection):
    # Issuer can create a legitimate session only with lookup-issued proof.
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    proof=prepare_signed_proof(auth_lookup_connection,"u-b",sid,jti)
    assert proof
    auth_lookup_connection.commit()
    assert one(issuer_connection,
        "SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)",
        ("u-b",sid,jti,3600,proof)) is True
    issuer_connection.commit()


def test_r23_lookup_cannot_write_login_attempts(auth_lookup_connection):
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(auth_lookup_connection,"SELECT domi_auth.record_login_attempt(%s,%s)",
            ("b@example.invalid",False))
    auth_lookup_connection.rollback()


# R27 dual-role authorization: possession of issuer DSN alone is not login.
def test_r27_legacy_unbound_issuer_is_revoked(issuer_connection):
    import uuid
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(issuer_connection,"SELECT domi_auth.issue_session(%s,%s,%s,%s)",
            ("u-b",str(uuid.uuid4()),str(uuid.uuid4()),3600))
    issuer_connection.rollback()


def test_r27_issuer_cannot_mint_proof(issuer_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    args=signed_attestation_args("u-b",sid,jti)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(issuer_connection,"SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)",args)
    issuer_connection.rollback()


def test_r27_lookup_cannot_consume_proof(auth_lookup_connection):
    import uuid
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        one(auth_lookup_connection,
            "SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)",
            ("u-b",str(uuid.uuid4()),str(uuid.uuid4()),3600,str(uuid.uuid4())))
    auth_lookup_connection.rollback()


def test_r27_bound_proof_cannot_be_reused(issuer_connection,auth_lookup_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    proof=prepare_signed_proof(auth_lookup_connection,"u-b",sid,jti)
    assert proof
    auth_lookup_connection.commit()
    sql="SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)"
    args=("u-b",sid,jti,3600,proof)
    assert one(issuer_connection,sql,args) is True
    issuer_connection.commit()
    assert one(issuer_connection,sql,args) is False


def test_r27_wrong_user_session_and_jti_do_not_consume_proof(issuer_connection,auth_lookup_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    proof=prepare_signed_proof(auth_lookup_connection,"u-b",sid,jti)
    assert proof
    auth_lookup_connection.commit()
    sql="SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)"
    for user,bad_sid,bad_jti in (
       ("u-a",sid,jti),
       ("u-b",str(uuid.uuid4()),jti),
       ("u-b",sid,str(uuid.uuid4())),
    ):
        assert one(issuer_connection,sql,(user,bad_sid,bad_jti,3600,proof)) is False
    assert one(issuer_connection,sql,("u-b",sid,jti,3600,proof)) is True


def test_r27_expired_proof_and_bad_nonce_rejected(issuer_connection,auth_lookup_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    proof=prepare_signed_proof(auth_lookup_connection,"u-b",sid,jti)
    assert proof
    auth_lookup_connection.commit()
    sql="SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)"
    assert one(issuer_connection,sql,("u-b",sid,jti,3600,"not-a-uuid")) is False
    assert one(issuer_connection,sql,("u-b",sid,jti,3600,None)) is False
    admin=psycopg2.connect(DSN)
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute(
                    "UPDATE domi_pilot.auth_session_proofs "
                    "SET expires_at=clock_timestamp()-interval '1 second' "
                    "WHERE proof_id=%s::uuid",(proof,))
    finally:
        admin.close()
    assert one(issuer_connection,sql,("u-b",sid,jti,3600,proof)) is False


def test_r27_proof_not_visible_before_lookup_commit(issuer_connection,auth_lookup_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    proof=prepare_signed_proof(auth_lookup_connection,"u-b",sid,jti)
    assert proof
    assert one(issuer_connection,
        "SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)",
        ("u-b",sid,jti,3600,proof)) is False
    issuer_connection.rollback()
    auth_lookup_connection.commit()
    assert one(issuer_connection,
        "SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)",
        ("u-b",sid,jti,3600,proof)) is True



# R28: server-only HMAC attestation closes R27's arbitrary-ID minting flaw.
def test_r28_legacy_unsigned_proof_function_dropped(auth_lookup_connection):
    import uuid
    with pytest.raises(psycopg2.errors.UndefinedFunction):
        one(auth_lookup_connection,"SELECT domi_auth.prepare_session_proof(%s,%s,%s)",
            ("u-b",str(uuid.uuid4()),str(uuid.uuid4())))
    auth_lookup_connection.rollback()


def test_r28_lookup_without_correct_hmac_cannot_mint_proof(auth_lookup_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    args=list(signed_attestation_args("u-b",sid,jti))
    for invalid in ("0"*64,None,"bad"):
        args[-1]=invalid
        assert one(auth_lookup_connection,
            "SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)",tuple(args)) is None


def test_r28_hmac_cannot_be_transplanted_between_users_ttl_or_session(auth_lookup_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    good=signed_attestation_args("u-b",sid,jti)
    cases=[
       ("u-a",)+good[1:],
       good[:3]+(7200,)+good[4:],
       (good[0],str(uuid.uuid4()))+good[2:],
       good[:2]+(str(uuid.uuid4()),)+good[3:],
    ]
    for args in cases:
        assert one(auth_lookup_connection,
            "SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)",args) is None


def test_r28_hmac_expired_future_or_changed_nonce_denied(auth_lookup_connection):
    import time,uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    for epoch in (int(time.time())-100,int(time.time())+120):
        args=signed_attestation_args("u-b",sid,jti,issued_epoch=epoch)
        assert one(auth_lookup_connection,
            "SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)",args) is None
    args=list(signed_attestation_args("u-b",sid,jti))
    args[-2]="f"*32
    assert one(auth_lookup_connection,
        "SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)",tuple(args)) is None


def test_r28_proof_signed_message_cannot_be_minted_twice(auth_lookup_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    args=signed_attestation_args("u-b",sid,jti)
    sql="SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)"
    assert one(auth_lookup_connection,sql,args)
    assert one(auth_lookup_connection,sql,args) is None


def test_r28_hmac_secret_inaccessible_to_lookup_and_issuer(auth_lookup_connection,issuer_connection):
    for conn in (auth_lookup_connection,issuer_connection):
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            one(conn,"SELECT count(*) FROM domi_pilot.auth_attestation_secrets")
        conn.rollback()


def test_r28_issuer_cannot_increase_signed_session_ttl(auth_lookup_connection,issuer_connection):
    import uuid
    sid,jti=str(uuid.uuid4()),str(uuid.uuid4())
    proof=prepare_signed_proof(auth_lookup_connection,"u-b",sid,jti,1800)
    assert proof
    auth_lookup_connection.commit()
    sql="SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)"
    assert one(issuer_connection,sql,("u-b",sid,jti,3600,proof)) is False
    assert one(issuer_connection,sql,("u-b",sid,jti,1800,proof)) is True


def test_r28_bad_password_does_not_create_signed_proof(auth_lookup_connection,issuer_connection):
    from fastapi import HTTPException
    from app.pg_auth_bootstrap import login_postgres
    admin=psycopg2.connect(DSN)
    try:
        before=one(admin,"SELECT count(*) FROM domi_pilot.auth_session_proofs")
        with pytest.raises(HTTPException) as fail:
            login_postgres(auth_lookup_connection,issuer_connection,
                "b@example.invalid","incorrect-password",None,max_attempts=5,window_seconds=900)
        assert fail.value.status_code==401
        after=one(admin,"SELECT count(*) FROM domi_pilot.auth_session_proofs")
        assert before==after
    finally:
        admin.close()


def test_r28_missing_server_key_fails_closed(monkeypatch,auth_lookup_connection,issuer_connection):
    import uuid
    from fastapi import HTTPException
    from app.pg_auth_bootstrap import login_postgres
    monkeypatch.delenv("DOMI_AUTH_ATTESTATION_SECRET",raising=False)
    with pytest.raises(HTTPException) as failure:
        login_postgres(auth_lookup_connection,issuer_connection,
            "b@example.invalid","R15-local-synthetic-passphrase",None,
            max_attempts=5,window_seconds=900)
    assert failure.value.status_code==503

