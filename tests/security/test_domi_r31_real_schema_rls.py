"""R31 real-schema RLS tests on disposable PostgreSQL only.

Uses the repository's 000..287 schema, never a remote database. No Neon
writes are made by this suite. Check that a direct PostgreSQL role cannot
access another household's private memory, and safe rollback stays closed.
"""
from __future__ import annotations

import os
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
DOWN = MIG_DIR / "security/300_domi_r31_owner_beta_rls_safe_rollback.sql"
ALL = ["000_110_part_a.sql", "120_260_part_b.sql", "270_287_part_c.sql"]


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
            self.conn=psycopg2.connect(DSN)
            self.conn.autocommit=False
            with self.conn.cursor() as cur:
                cur.execute("SET LOCAL ROLE domi_app_runtime")
                cur.execute("SELECT set_config('domi.r31_subject',%s,true)",(uid,))
                cur.execute("SELECT set_config('domi.r31_jti',%s,true)",(jti or 'jti-'+uid,))
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
                cur.execute("SELECT set_config('domi.r31_subject','u-a',true)")
                cur.execute("SELECT set_config('domi.r31_jti','jti-u-a',true)")


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


def test_safe_rollback_never_disables_rls(admin):
    with admin:
        with admin.cursor() as cur:
            cur.execute(DOWN.read_text(encoding="utf8"))
    assert scalar(admin,"SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                  "WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity")==57
    with as_runtime(admin,"u-b") as conn:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            scalar(conn,"SELECT count(*) FROM public.memory_items")
