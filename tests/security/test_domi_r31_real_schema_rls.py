"""R31 real-schema RLS tests on disposable PostgreSQL only.

Uses the repository's 000..287 schema, never a remote database. No Neon
writes are made by this suite. Check that a direct PostgreSQL role cannot
access another household's private memory, and safe rollback stays closed.
"""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path
from urllib.parse import urlsplit
import pytest

psycopg2 = pytest.importorskip("psycopg2")
DSN = os.getenv("DOMI_RLS_TEST_DSN", "")
REQUIRED = os.getenv("DOMI_RLS_REQUIRE_LIVE", "") == "1"
if REQUIRED and not DSN:
    raise RuntimeError("Required R31 disposable PostgreSQL DSN missing: fail closed")
pytestmark = pytest.mark.skipif(not DSN, reason="Dedicated disposable PostgreSQL CI job only")
ROOT = Path(__file__).resolve().parents[2]
MIG_DIR = ROOT / "apps/api/postgres_staging_migrations"
UP = MIG_DIR / "security/300_domi_r31_owner_beta_rls_up.sql"
HARDEN = MIG_DIR / "security/301_domi_r33_owner_beta_rls_hardening.sql"
DOWN = MIG_DIR / "security/300_domi_r31_owner_beta_rls_safe_rollback.sql"
API_PATH = str(ROOT / "apps/api")
if API_PATH not in sys.path:
    sys.path.insert(0,API_PATH)
from app.pg_rls_context import bind_signed_rls_context
ALL = ["000_110_part_a.sql", "120_260_part_b.sql", "270_287_part_c.sql"]
# A real LOGIN identity, not the fixture's PostgreSQL superuser. Never store
# this randomly generated CI-only password in GitHub or public logs.
_CI_RUNTIME_PASSWORD = None


def checked():
    p = urlsplit(DSN)
    if not (p.scheme in ("postgres", "postgresql") and
            p.hostname in ("127.0.0.1", "localhost") and
            p.path == "/domi_rls_ci"):
        pytest.fail("R31 refuses non-disposable and remote DSNs")


def scalar(conn, query, params=()):
    with conn.cursor() as cur:
        cur.execute(query, params)
        return cur.fetchone()[0]


@pytest.fixture(scope="module")
def admin():
    global _CI_RUNTIME_PASSWORD
    checked()
    conn=psycopg2.connect(DSN)
    try:
        assert scalar(conn,"SELECT current_database()")=="domi_rls_ci"
        with conn:
            with conn.cursor() as cur:
                for name in ALL:
                    cur.execute((MIG_DIR / name).read_text(encoding="utf8"))
                assert scalar(conn, "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'") == 57
                cur.execute(UP.read_text(encoding="utf8"))
                cur.execute(HARDEN.read_text(encoding="utf8"))
                # Privilege-escalation negatives MUST run as a genuine SQL
                # LOGIN without superuser/BYPASS/CREATEROLE inheritance.
                # SET ROLE from postgres would invalidate those tests.
                _CI_RUNTIME_PASSWORD=secrets.token_urlsafe(48)
                cur.execute(
                    "CREATE ROLE domi_r31_ci_client LOGIN NOINHERIT "
                    "NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB "
                    "NOREPLICATION PASSWORD %s", (_CI_RUNTIME_PASSWORD,)
                )
                cur.execute("GRANT domi_app_runtime TO domi_r31_ci_client")
                cur.execute("GRANT CONNECT ON DATABASE domi_rls_ci TO domi_r31_ci_client")
                secret=secrets.token_urlsafe(48)
                os.environ["DOMI_RLS_CONTEXT_SECRET"]=secret
                cur.execute(
                    "INSERT INTO domi_r31.context_secrets(key_name,secret_key) "
                    "VALUES('active',convert_to(%s,'UTF8'))",(secret,)
                )
                for uid in ("u-a","u-b"):
                    cur.execute("INSERT INTO users(id,email,password_hash,is_active,created_at) "
                                "VALUES(%s,%s,'synthetic',1,'2026-10-13T00:00:00Z')",
                                (uid,uid+"@example.invalid"))
                    cur.execute("INSERT INTO auth_sessions(id,user_id,token_jti,created_at,expires_at) "
                                "VALUES(%s,%s,%s,'2026-10-13T00:00:00Z','2099-10-13T00:00:00Z')",
                                ("s-"+uid,uid,"jti-"+uid))
                    cur.execute("INSERT INTO households(id,name,created_at) VALUES(%s,%s,'2026-10-13T00:00:00Z')",
                                ("h-"+uid,uid))
                    cur.execute("INSERT INTO household_memberships(household_id,user_id,role,created_at) "
                                "VALUES(%s,%s,'owner','2026-10-13T00:00:00Z')",("h-"+uid,uid))
                    cur.execute("INSERT INTO persons(id,household_id,display_name,created_at,user_id) "
                                "VALUES(%s,%s,'Synthetic','2026-10-13T00:00:00Z',%s)",
                                ("p-"+uid,"h-"+uid,uid))
                    cur.execute("INSERT INTO memory_items(id,person_id,household_id,memory_type,content,importance,"
                                "consent_scope,visibility_scope,created_by_user_id,created_at,updated_at) "
                                "VALUES(%s,%s,%s,'preference',%s,0.5,%s,'private_self',%s,"
                                "'2026-10-13T00:00:00Z','2026-10-13T00:00:00Z')",
                                ("m-"+uid,"p-"+uid,"h-"+uid,"fictional:"+uid,
                                 '{"visible_to":["self"]}',uid))
        yield conn
    finally:
        conn.close()


def as_runtime(admin, uid, jti=None):
    class Context:
        def __enter__(self):
            assert _CI_RUNTIME_PASSWORD is not None
            self.conn=psycopg2.connect(
                DSN,user="domi_r31_ci_client",password=_CI_RUNTIME_PASSWORD
            )
            self.conn.autocommit=False
            with self.conn.cursor() as cur:
                cur.execute("SET LOCAL ROLE domi_app_runtime")
                if uid:
                    self.signed=bind_signed_rls_context(
                        self.conn,uid,jti or 'jti-'+uid
                    )
                else:
                    self.signed=False
            return self.conn
        def __exit__(self,*_):
            self.conn.rollback()
            self.conn.close()
    return Context()


def test_all_57_tables_force_rls_and_exact_inventory(admin):
    assert scalar(admin,"SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                  "WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity")==57
    assert scalar(admin,"SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                  "WHERE n.nspname='public' AND c.relkind='r' "
                  "AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)")==0


def test_owner_can_read_own_private_memory_only(admin):
    with as_runtime(admin,"u-a") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM public.memory_items")
            assert [r[0] for r in cur.fetchall()]==["m-u-a"]


def test_other_household_cannot_be_read_or_changed(admin):
    with as_runtime(admin,"u-b") as conn:
        assert scalar(conn,"SELECT count(*) FROM public.memory_items WHERE id='m-u-a'")==0
        with conn.cursor() as cur:
            cur.execute("UPDATE public.memory_items SET content='attack' WHERE id='m-u-a'")
            assert cur.rowcount==0


def test_spoofed_subject_without_correct_jti_denied(admin):
    with as_runtime(admin,"u-a","wrong-jti") as conn:
        assert scalar(conn,"SELECT COUNT(*) FROM public.memory_items")==0


def test_without_context_denied(admin):
    with as_runtime(admin,"","") as conn:
        assert scalar(conn,"SELECT COUNT(*) FROM public.memory_items")==0


def test_sensitive_auth_and_other_domains_closed(admin):
    with as_runtime(admin,"u-a") as conn:
        for table in ("users","auth_sessions","user_mfa","expenses","security_events","guardian_consents"):
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                scalar(conn,"SELECT COUNT(*) FROM public."+table)
            conn.rollback()
            with conn.cursor() as cur:
                cur.execute("SET LOCAL ROLE domi_app_runtime")
                assert bind_signed_rls_context(conn,"u-a","jti-u-a")


def test_owner_cannot_insert_cross_household_memory(admin):
    with as_runtime(admin,"u-a") as conn:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege,match="row-level security"):
            with conn.cursor() as cur:
                cur.execute("INSERT INTO public.memory_items(id,person_id,household_id,memory_type,"
                            "content,importance,consent_scope,visibility_scope,created_by_user_id,"
                            "created_at,updated_at) VALUES ('forged','p-u-b','h-u-b','preference',"
                            "'forged',0.5,'{\"visible_to\":[\"self\"]}','private_self','u-a',"
                            "'2026-10-13T00:00:00Z','2026-10-13T00:00:00Z')")


def test_expiry_and_soft_delete_fail_closed(admin):
    # Preserve module-scoped fixtures for later positive tests. Always
    # restore the fictional memory after both negative assertions.
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute("UPDATE memory_items SET expires_at='2020-01-01T00:00:00Z' WHERE id='m-u-a'")
        with as_runtime(admin,"u-a") as conn:
            assert scalar(conn,"SELECT count(*) FROM public.memory_items")==0
        with admin:
            with admin.cursor() as cur:
                cur.execute("UPDATE memory_items SET expires_at=NULL,deleted_at='2026-10-13T00:00:00Z' WHERE id='m-u-a'")
        with as_runtime(admin,"u-a") as conn:
            assert scalar(conn,"SELECT count(*) FROM public.memory_items")==0
    finally:
        with admin:
            with admin.cursor() as cur:
                cur.execute("UPDATE memory_items SET expires_at=NULL,deleted_at=NULL WHERE id='m-u-a'")




def test_r33_changing_guc_to_other_user_cannot_impersonate(admin):
    with as_runtime(admin,"u-a") as conn:
        assert scalar(conn,"SELECT COUNT(*) FROM public.memory_items")==1
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('domi.r31_subject','u-b',true)")
            cur.execute("SELECT set_config('domi.r31_jti','jti-u-b',true)")
        assert scalar(conn,"SELECT COUNT(*) FROM public.memory_items")==0


def test_r33_unsigned_guc_alone_cannot_read_private_memory(admin):
    with as_runtime(admin,"") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('domi.r31_subject','u-a',true)")
            cur.execute("SELECT set_config('domi.r31_jti','jti-u-a',true)")
        assert scalar(conn,"SELECT COUNT(*) FROM public.memory_items")==0


def test_r33_transaction_replay_fails_after_rollback(admin):
    with as_runtime(admin,"u-a") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_setting('domi.r31_issued'),"
                        "current_setting('domi.r31_nonce'),current_setting('domi.r31_mac')")
            issued,nonce,mac=cur.fetchone()
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE domi_app_runtime")
            for key,val in (
                ("domi.r31_subject","u-a"),("domi.r31_jti","jti-u-a"),
                ("domi.r31_issued",issued),("domi.r31_nonce",nonce),
                ("domi.r31_mac",mac),
            ):
                cur.execute("SELECT set_config(%s,%s,true)",(key,val))
        assert scalar(conn,"SELECT COUNT(*) FROM public.memory_items")==0


def test_r33_direct_privacy_and_authority_updates_denied(admin):
    with as_runtime(admin,"u-a") as conn:
        for column,value in (
            ("consent_scope",'{"visible_to":["self","household"]}'),
            ("visibility_scope","household_shared"),
            ("created_by_user_id","u-b"),
            ("inference_status","confirmed"),
            ("person_id","p-u-b"),
        ):
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE public.memory_items SET "+column+"=%s WHERE id='m-u-a'",(value,)
                    )
            conn.rollback()
            with conn.cursor() as cur:
                cur.execute("SET LOCAL ROLE domi_app_runtime")
            assert bind_signed_rls_context(conn,"u-a","jti-u-a")


def test_r33_private_content_correction_remains_allowed(admin):
    with as_runtime(admin,"u-a") as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE public.memory_items SET content=%s,updated_at=%s WHERE id='m-u-a'",
                ("fictional:corrected","2026-10-13T12:00:00Z")
            )
            assert cur.rowcount==1
            cur.execute("SELECT content FROM public.memory_items WHERE id='m-u-a'")
            assert cur.fetchone()[0]=="fictional:corrected"


def test_r33_consented_memory_cannot_enable_doctor_sharing(admin):
    with as_runtime(admin,"u-a") as conn:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege,match="row-level security"):
            with conn.cursor() as cur:
                cur.execute(
                  "INSERT INTO public.memory_items(id,person_id,household_id,memory_type,"
                  "content,importance,consent_scope,visibility_scope,created_by_user_id,"
                  "created_at,updated_at) VALUES "
                  "('m-bad','p-u-a','h-u-a','preference','fictional:bad',0.5,"
                  "'{\"visible_to\":[\"self\"],\"shareable_with_doctor\":true}',"
                  "'private_self','u-a','2026-10-13T12:00:00Z','2026-10-13T12:00:00Z')"
                )


def test_r33_runtime_cannot_see_signing_secret_or_become_owner(admin):
    with as_runtime(admin,"u-a") as conn:
        assert scalar(conn,"SELECT session_user")=="domi_r31_ci_client"
        assert scalar(conn,"SELECT current_user")=="domi_app_runtime"
        assert scalar(conn,
            "SELECT rolsuper OR rolbypassrls OR rolcreaterole FROM pg_roles "
            "WHERE rolname=session_user") is False
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            scalar(conn,"SELECT COUNT(*) FROM domi_r31.context_secrets")
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE domi_app_runtime")
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("SET ROLE domi_r31_auth_owner")


def test_r35_runtime_login_is_not_superuser_or_rls_bypass(admin):
    # Proves the test operator cannot use its login privilege to impersonate
    # the migration owner even after a transaction rollback.
    with as_runtime(admin,"u-a") as conn:
        assert scalar(conn,"SELECT session_user")=="domi_r31_ci_client"
        assert scalar(conn,"SELECT current_user")=="domi_app_runtime"
        conn.rollback()
        assert scalar(conn,"SELECT current_user")=="domi_r31_ci_client"
        assert scalar(conn,
            "SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb "
            "FROM pg_roles WHERE rolname=current_user") is False
        with conn.cursor() as cur:
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("SET ROLE domi_r31_auth_owner")


def test_safe_rollback_never_disables_rls(admin):
    with admin:
        with admin.cursor() as cur:
            cur.execute(DOWN.read_text(encoding="utf8"))
    assert scalar(admin,"SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                  "WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity")==57
    # After rollback the signer itself is revoked; this must be visible as
    # an explicit denial, not an unexpected fixture setup exception.
    with as_runtime(admin,"") as conn:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            bind_signed_rls_context(conn,"u-b","jti-u-b")
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE domi_app_runtime")
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            scalar(conn,"SELECT count(*) FROM public.memory_items")
