"""R107: prove PostgreSQL affects remain quarantined on disposable PG16.

Tests intentionally refuse any Neon/remote DSN, never deploy to production.
The candidate table is installed only inside a rollback-only transaction,
after the historic 57-table schema and R31/R33 restrictive security baseline.
R107 does NOT authorize migration 288 on PostgreSQL or edit readiness=57.
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
    raise RuntimeError("R107 requires disposable PostgreSQL")
pytestmark = pytest.mark.skipif(not DSN, reason="Disposable PostgreSQL CI only")
ROOT = Path(__file__).resolve().parents[2]
MIG_DIR = ROOT / "apps/api/postgres_staging_migrations"
SQLITE_MIGRATION = ROOT / "apps/api/sqlite_migrations/288_domi_affective_memory_links.sql"
BASE = ("000_110_part_a.sql", "120_260_part_b.sql", "270_287_part_c.sql")


def disposable_connection():
    parsed = urlsplit(DSN)
    if (parsed.scheme not in {"postgres", "postgresql"}
            or parsed.hostname not in {"127.0.0.1", "localhost"}
            or parsed.path != "/domi_rls_ci"):
        pytest.fail("R107 forbids all non-disposable PostgreSQL DSNs")
    conn = psycopg2.connect(DSN)
    with conn.cursor() as cursor:
        cursor.execute("SELECT current_database(),current_user")
        assert cursor.fetchone() == ("domi_rls_ci", "postgres")
    return conn


@pytest.fixture(scope="module")
def pg():
    conn = disposable_connection()
    try:
        # Set up base only once; do not share the R107 PG cluster with other
        # RLS tests which install overlapping global roles/schemas.
        with conn:
            with conn.cursor() as cursor:
                for script in BASE:
                    cursor.execute((MIG_DIR / script).read_text(encoding="utf8"))
                cursor.execute("SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'")
                assert cursor.fetchone()[0] == 57
                cursor.execute(
                    (MIG_DIR / "security/300_domi_r31_owner_beta_rls_up.sql")
                    .read_text(encoding="utf8")
                )
                cursor.execute(
                    (MIG_DIR / "security/301_domi_r33_owner_beta_rls_hardening.sql")
                    .read_text(encoding="utf8")
                )
        yield conn
    finally:
        conn.close()


def test_r107_new_table_is_not_present_in_current_pg_baseline(pg):
    with pg.cursor() as cursor:
        cursor.execute("SELECT to_regclass('public.domi_affective_memory_links')")
        assert cursor.fetchone()[0] is None
        cursor.execute(
            "SELECT COUNT(*) FROM pg_catalog.pg_class c "
            "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname='public' AND c.relkind='r'"
        )
        assert cursor.fetchone()[0] == 57


def test_r107_58th_table_would_fail_current_readiness(pg):
    # DDL in a transaction that is ALWAYS rolled back; this is not a
    # PostgreSQL migration release. Never leave the new table installed.
    try:
        with pg.cursor() as cursor:
            cursor.execute(SQLITE_MIGRATION.read_text(encoding="utf8"))
            cursor.execute(
                "ALTER TABLE public.domi_affective_memory_links ENABLE ROW LEVEL SECURITY"
            )
            cursor.execute(
                "ALTER TABLE public.domi_affective_memory_links FORCE ROW LEVEL SECURITY"
            )
            cursor.execute(
                "REVOKE ALL ON public.domi_affective_memory_links FROM PUBLIC"
            )
            cursor.execute(
                "REVOKE ALL ON public.domi_affective_memory_links FROM domi_app_runtime"
            )
            cursor.execute(
                "CREATE POLICY domi_r107_closed ON public.domi_affective_memory_links "
                "AS PERMISSIVE FOR ALL TO domi_app_runtime "
                "USING (false) WITH CHECK (false)"
            )
            cursor.execute("SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'")
            assert cursor.fetchone()[0] == 58
            cursor.execute(
                "SELECT relrowsecurity,relforcerowsecurity FROM pg_class "
                "WHERE oid='public.domi_affective_memory_links'::regclass"
            )
            assert cursor.fetchone() == (True, True)
            cursor.execute(
                "SELECT has_table_privilege('domi_app_runtime',"
                "'public.domi_affective_memory_links','SELECT'),"
                "has_table_privilege('domi_app_runtime',"
                "'public.domi_affective_memory_links','INSERT'),"
                "has_table_privilege('domi_app_runtime',"
                "'public.domi_affective_memory_links','UPDATE'),"
                "has_table_privilege('domi_app_runtime',"
                "'public.domi_affective_memory_links','DELETE')"
            )
            assert cursor.fetchone() == (False, False, False, False)
            cursor.execute(
                "SELECT count(*) FROM pg_policies WHERE "
                "schemaname='public' AND tablename='domi_affective_memory_links'"
            )
            assert cursor.fetchone()[0] == 1
            # Real catalog result must be caught by the existing strict
            # start gate, not hidden by updating its expected count.
            from pathlib import Path
            import sys
            if str(ROOT / "apps/api") not in sys.path:
                sys.path.insert(0, str(ROOT / "apps/api"))
            from app.pg_staging_gate import check_postgres_staging_readiness

            class PGCatalog:
                def __init__(self, raw):
                    self.raw = raw
                    self.row = None

                def execute(self, sql, params=None):
                    with self.raw.cursor() as cur:
                        cur.execute(sql, params)
                        names = [x[0] for x in cur.description]
                        self.row = dict(zip(names, cur.fetchone()))
                    return self

                def fetchone(self):
                    return self.row

            with pytest.raises(RuntimeError, match="POSTGRES_SCHEMA_GATE"):
                check_postgres_staging_readiness(PGCatalog(pg))
    finally:
        pg.rollback()


def test_r107_candidate_transaction_left_no_table(pg):
    with pg.cursor() as cursor:
        cursor.execute("SELECT to_regclass('public.domi_affective_memory_links')")
        assert cursor.fetchone()[0] is None


def test_r107_runtime_cannot_read_or_write_new_table_even_with_signed_role(pg):
    # The restricted role exists only as a database role; the SQL operation
    # must fail for every privilege class independently of client identity.
    try:
        with pg.cursor() as cursor:
            cursor.execute(SQLITE_MIGRATION.read_text(encoding="utf8"))
            cursor.execute(
                "ALTER TABLE public.domi_affective_memory_links ENABLE ROW LEVEL SECURITY"
            )
            cursor.execute(
                "ALTER TABLE public.domi_affective_memory_links FORCE ROW LEVEL SECURITY"
            )
            cursor.execute(
                "REVOKE ALL ON public.domi_affective_memory_links FROM PUBLIC,domi_app_runtime"
            )
            cursor.execute(
                "CREATE POLICY domi_r107_closed ON public.domi_affective_memory_links "
                "FOR ALL TO domi_app_runtime USING (false) WITH CHECK (false)"
            )
            cursor.execute("SAVEPOINT before_switch")
            cursor.execute("SET LOCAL ROLE domi_app_runtime")
            for operation in (
                "SELECT id FROM public.domi_affective_memory_links",
                "INSERT INTO public.domi_affective_memory_links(id) VALUES ('x')",
                "UPDATE public.domi_affective_memory_links SET context_key='x'",
                "DELETE FROM public.domi_affective_memory_links",
            ):
                with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                    cursor.execute(operation)
                cursor.execute("ROLLBACK TO SAVEPOINT before_switch")
                cursor.execute("SAVEPOINT before_switch_2")
                cursor.execute("RELEASE SAVEPOINT before_switch_2")
                cursor.execute("SET LOCAL ROLE domi_app_runtime")
    finally:
        pg.rollback()
