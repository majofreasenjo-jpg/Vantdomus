"""R63 PostgreSQL read-only pilot: no writable runtime grant or forged consent.

Runs only with the dedicated 57-table disposable CI PostgreSQL database.
The entire R63 migration is rolled back after inspection. No Neon access.
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
    raise RuntimeError("R63 required disposable DSN missing")
pytestmark = pytest.mark.skipif(not DSN, reason="Disposable PG CI only")
SQL = Path(__file__).resolve().parents[2] / (
    "apps/api/postgres_staging_migrations/security/"
    "305_domi_r63_reminder_pilot_rls_up.sql"
)


@pytest.fixture(scope="module")
def piloted():
    u = urlsplit(DSN)
    if not (u.scheme in ("postgres", "postgresql")
            and u.hostname in ("localhost", "127.0.0.1")
            and u.path == "/domi_rls_ci"):
        pytest.fail("R63 refuses remote/non-disposable databases")
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_user,current_database()")
            assert cur.fetchone() == ("postgres", "domi_rls_ci")
            cur.execute(
                "SELECT count(*) FROM pg_class c "
                "JOIN pg_namespace n ON c.relnamespace=n.oid "
                "WHERE n.nspname='public' AND c.relkind='r' "
                "AND c.relrowsecurity AND c.relforcerowsecurity"
            )
            assert cur.fetchone()[0] == 57, "R31 fixture must run first"
            cur.execute(SQL.read_text(encoding="utf-8"))
        yield conn
    finally:
        conn.rollback()  # drop candidate grants and policies transactionally
        conn.close()


def test_r63_two_read_permissions_only(piloted):
    with piloted.cursor() as cur:
        for table in ("assistant_proposals", "family_reminders"):
            relation = "public." + table
            cur.execute("SELECT has_table_privilege('domi_app_runtime',%s,'SELECT')",
                        (relation,))
            assert cur.fetchone()[0] is True
            for perm in ("INSERT", "UPDATE", "DELETE", "TRUNCATE"):
                cur.execute(
                    "SELECT has_table_privilege('domi_app_runtime',%s,%s)",
                    (relation, perm)
                )
                assert cur.fetchone()[0] is False, (relation, perm)


def test_r63_no_forged_consent_or_outbox_write_grants(piloted):
    with piloted.cursor() as cur:
        for table in ("audit_log", "assistant_action_log",
                      "notification_outbox", "auth_sessions"):
            for perm in ("INSERT", "UPDATE", "DELETE"):
                cur.execute(
                    "SELECT has_table_privilege('domi_app_runtime',%s,%s)",
                    ("public." + table, perm)
                )
                assert cur.fetchone()[0] is False, (table, perm)


def test_r63_only_scoped_read_policies_exist(piloted):
    with piloted.cursor() as cur:
        cur.execute(
            "SELECT tablename,cmd,qual FROM pg_policies "
            "WHERE schemaname='public' AND policyname LIKE 'domi_r63_%'"
        )
        got = cur.fetchall()
        assert {(r[0], r[1]) for r in got} == {
            ("assistant_proposals", "SELECT"), ("family_reminders", "SELECT")
        }
        assert all("domi_r31.subject_id()" in q or
                   "domi_r31.household_ok" in q for _,_,q in got)


def test_r63_without_verified_session_cannot_read_or_update(piloted):
    # SET ROLE is enough to exercise the unprivileged role; no signed JWT
    # context is bound and the RLS policies must not reveal any rows.
    piloted.rollback()
    with piloted.cursor() as cur:
        cur.execute("SET LOCAL ROLE domi_app_runtime")
        cur.execute("SELECT COUNT(*) FROM public.assistant_proposals")
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT COUNT(*) FROM public.family_reminders")
        assert cur.fetchone()[0] == 0
        cur.execute("SAVEPOINT r63_write_denied")
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute("UPDATE public.assistant_proposals SET status='confirmed'")
        cur.execute("ROLLBACK TO SAVEPOINT r63_write_denied")
    # Run this last: transaction rollback also rolls back R63 candidate setup.
