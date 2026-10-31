"""R65: real LOGIN + HMAC-signed PostgreSQL RLS reads, two synthetic households.

This runs ONLY against the disposable CI PostgreSQL service at
127.0.0.1:5432/domi_rls_ci after the R31/R33 initialization, BEFORE
any R36 revocation. R63 grants SELECT only. No Neon, API, user data, or LLM.

An intentionally unprivileged LOGIN reads its own proposals and household's
shared reminders but cannot read another household, forge a signed identity,
write a proposal status, or insert a reminder. All DDL and rows are test-only.
"""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit
import json
import os
import secrets
import sys

import pytest

psycopg2 = pytest.importorskip("psycopg2")
DSN = os.getenv("DOMI_RLS_TEST_DSN", "")
REQUIRED = os.getenv("DOMI_RLS_REQUIRE_LIVE") == "1"
if REQUIRED and not DSN:
    raise RuntimeError("R65 must have a disposable PostgreSQL DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="R65 only on disposable PostgreSQL")

ROOT = Path(__file__).resolve().parents[2]
UP = ROOT / (
    "apps/api/postgres_staging_migrations/security/"
    "305_domi_r63_reminder_pilot_rls_up.sql"
)
sys.path.insert(0, str(ROOT / "apps/api"))
from app.pg_rls_context import bind_signed_rls_context

LOGIN_ROLE = "domi_r65_ci_client"
# Fixed, labeled synthetic IDs; never real user or family data.
PROPOSALS = {
    "r65-prop-a": ("h-u-a", "u-a"),
    "r65-prop-b": ("h-u-b", "u-b"),
    "r65-prop-c": ("h-u-a", "u-c"),
}
REMINDERS = {
    "r65-rem-a-shared": ("h-u-a", "u-a", "household_shared"),
    "r65-rem-a-private": ("h-u-a", "u-a", "private_self"),
    "r65-rem-b-shared": ("h-u-b", "u-b", "household_shared"),
}


def _check_dsn():
    u = urlsplit(DSN)
    if not (
        u.scheme in ("postgres", "postgresql")
        and u.hostname in ("127.0.0.1", "localhost")
        and (u.port is None or u.port == 5432)
        and u.path == "/domi_rls_ci"
    ):
        pytest.fail("R65 refuses remote or non-disposable database")


def _scalar(conn, query, args=()):
    with conn.cursor() as cur:
        cur.execute(query, args)
        return cur.fetchone()[0]


@pytest.fixture(scope="module")
def prepared():
    _check_dsn()
    admin = psycopg2.connect(DSN)
    login_password = secrets.token_urlsafe(48)
    context_secret = secrets.token_urlsafe(48)
    old_env = os.environ.get("DOMI_RLS_CONTEXT_SECRET")
    old_key = None
    created = False
    try:
        with admin:
            with admin.cursor() as cur:
                cur.execute("SELECT current_user, current_database()")
                assert cur.fetchone() == ("postgres", "domi_rls_ci")
                cur.execute(
                    "SELECT count(*) FROM pg_class c "
                    "JOIN pg_namespace n ON n.oid=c.relnamespace "
                    "WHERE n.nspname='public' AND c.relkind='r' "
                    "AND c.relrowsecurity AND c.relforcerowsecurity"
                )
                assert cur.fetchone()[0] == 57, "R31/R33 fixture required"
                cur.execute("SELECT secret_key FROM domi_r31.context_secrets "
                            "WHERE key_name='active'")
                old_key = cur.fetchone()[0]
                assert old_key and len(old_key) >= 32

                cur.execute(
                    "CREATE ROLE domi_r65_ci_client LOGIN NOINHERIT "
                    "NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB "
                    "NOREPLICATION PASSWORD %s", (login_password,)
                )
                cur.execute("GRANT domi_app_runtime TO domi_r65_ci_client")
                cur.execute(
                    "GRANT CONNECT ON DATABASE domi_rls_ci TO domi_r65_ci_client"
                )

                # R31's synthetic u-a/u-b exist. Add another MEMBER of A:
                # a member reads A's shared reminder but not A owner's proposal.
                cur.execute("INSERT INTO public.users"
                            "(id,email,password_hash,is_active,created_at)"
                            "VALUES('u-c','u-c@example.invalid','synthetic',1,"
                            "'2026-10-18T00:00:00Z')")
                cur.execute("INSERT INTO public.auth_sessions"
                            "(id,user_id,token_jti,created_at,expires_at)"
                            "VALUES('s-u-c','u-c','jti-u-c',"
                            "'2026-10-18T00:00:00Z','2099-01-01T00:00:00Z')")
                cur.execute(
                    "INSERT INTO public.household_memberships"
                    "(household_id,user_id,role,created_at) "
                    "VALUES('h-u-a','u-c','member','2026-10-18T00:00:00Z')"
                )

                for item_id, (hid, uid) in PROPOSALS.items():
                    payload = json.dumps({
                        "title": "Synthetic R65 reminder",
                        "remind_at": "2030-11-10T19:00:00-03:00"
                    })
                    cur.execute(
                        "INSERT INTO public.assistant_proposals("
                        "id,household_id,organization_id,user_id,tool_name,"
                        "category,title,summary,sensitive,requires_confirmation,"
                        "proposed_payload,provider,status,created_at,expires_at)"
                        "VALUES(%s,%s,NULL,%s,'propose_family_reminder',"
                        "'family','R65 synthetic','test',1,1,%s,'mock','pending',"
                        "'2026-10-18T00:00:00Z','2030-12-01T00:00:00Z')",
                        (item_id, hid, uid, payload),
                    )
                for item_id, (hid, uid, scope) in REMINDERS.items():
                    cur.execute(
                        "INSERT INTO public.family_reminders("
                        "id,household_id,organization_id,person_id,"
                        "created_by_user_id,title,remind_at,channel,"
                        "visibility_scope,status,dedupe_key,created_at)"
                        "VALUES(%s,%s,NULL,NULL,%s,'R65 synthetic',"
                        "'2030-11-10T22:00:00+00:00','in_app',%s,"
                        "'pending',%s,'2026-10-18T00:00:00Z')",
                        (item_id, hid, uid, scope, item_id),
                    )
                cur.execute(
                    "UPDATE domi_r31.context_secrets SET "
                    "secret_key=convert_to(%s,'UTF8') WHERE key_name='active'",
                    (context_secret,)
                )
                assert cur.rowcount == 1
                # Apply the actual R63 migration and commit so an independent
                # LOGIN can observe the permissions and policies.
                cur.execute(UP.read_text(encoding="utf8"))
        created = True
        os.environ["DOMI_RLS_CONTEXT_SECRET"] = context_secret
        yield {"password": login_password}
    finally:
        if old_env is None:
            os.environ.pop("DOMI_RLS_CONTEXT_SECRET", None)
        else:
            os.environ["DOMI_RLS_CONTEXT_SECRET"] = old_env

        if created:
            with admin:
                with admin.cursor() as cur:
                    cur.execute("DROP POLICY IF EXISTS domi_r63_proposal_self_select "
                                "ON public.assistant_proposals")
                    cur.execute("DROP POLICY IF EXISTS domi_r63_reminder_shared_select "
                                "ON public.family_reminders")
                    cur.execute("REVOKE SELECT ON public.assistant_proposals,"
                                "public.family_reminders FROM domi_app_runtime")
                    cur.execute("DELETE FROM public.family_reminders "
                                "WHERE id LIKE 'r65-rem-%'")
                    cur.execute("DELETE FROM public.assistant_proposals "
                                "WHERE id LIKE 'r65-prop-%'")
                    cur.execute("DELETE FROM public.household_memberships "
                                "WHERE household_id='h-u-a' AND user_id='u-c'")
                    cur.execute("DELETE FROM public.auth_sessions WHERE user_id='u-c'")
                    cur.execute("DELETE FROM public.users WHERE id='u-c'")
                    cur.execute("UPDATE domi_r31.context_secrets "
                                "SET secret_key=%s WHERE key_name='active'",
                                (old_key,))
                    cur.execute("REVOKE domi_app_runtime FROM domi_r65_ci_client")
                    cur.execute("REVOKE CONNECT ON DATABASE domi_rls_ci "
                                "FROM domi_r65_ci_client")
                    cur.execute("DROP ROLE domi_r65_ci_client")
        admin.close()


@contextmanager
def runtime(prepared, uid=None, *, jti=None):
    raw = psycopg2.connect(DSN, user=LOGIN_ROLE, password=prepared["password"])
    raw.autocommit = False
    try:
        with raw.cursor() as cur:
            cur.execute("SELECT session_user,current_user")
            assert cur.fetchone() == (LOGIN_ROLE, LOGIN_ROLE)
            cur.execute("SET LOCAL ROLE domi_app_runtime")
            cur.execute("SELECT current_user")
            assert cur.fetchone()[0] == "domi_app_runtime"
        if uid is not None:
            assert bind_signed_rls_context(raw, uid, jti or "jti-" + uid)
        yield raw
    finally:
        raw.rollback()
        raw.close()


def _visible(conn, table):
    assert table in ("assistant_proposals", "family_reminders")
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM public." + table + " ORDER BY id")
        return [row[0] for row in cur.fetchall()]


def test_r65_two_signed_households_have_no_data_leakage(prepared):
    with runtime(prepared, "u-a") as a, runtime(prepared, "u-b") as b:
        assert _visible(a, "assistant_proposals") == ["r65-prop-a"]
        assert _visible(b, "assistant_proposals") == ["r65-prop-b"]
        assert _visible(a, "family_reminders") == ["r65-rem-a-shared"]
        assert _visible(b, "family_reminders") == ["r65-rem-b-shared"]


def test_r65_same_household_member_sees_shared_but_not_owner_proposal(prepared):
    with runtime(prepared, "u-c") as c:
        assert _visible(c, "assistant_proposals") == ["r65-prop-c"]
        assert _visible(c, "family_reminders") == ["r65-rem-a-shared"]


def test_r65_unsigned_role_denied_even_with_member_account(prepared):
    with runtime(prepared) as guest:
        assert _visible(guest, "assistant_proposals") == []
        assert _visible(guest, "family_reminders") == []


def test_r65_unsigned_sql_guc_cannot_impersonate_other_household(prepared):
    with runtime(prepared, "u-a") as a:
        assert _visible(a, "family_reminders") == ["r65-rem-a-shared"]
        with a.cursor() as cur:
            cur.execute("SELECT set_config('domi.r31_subject','u-b',true)")
            cur.execute("SELECT set_config('domi.r31_jti','jti-u-b',true)")
        # A user can change the GUC, but not the transaction-bound HMAC.
        assert _visible(a, "family_reminders") == []
        assert _visible(a, "assistant_proposals") == []


def test_r65_bad_session_token_prevents_signed_context(prepared):
    with runtime(prepared) as conn:
        assert not bind_signed_rls_context(conn, "u-a", "fake-jti")
        assert _visible(conn, "family_reminders") == []


def test_r65_direct_writes_and_privileged_data_denied(prepared):
    with runtime(prepared, "u-a") as conn:
        for sql in (
            "UPDATE public.assistant_proposals SET status='confirmed' "
            "WHERE id='r65-prop-a'",
            "DELETE FROM public.family_reminders WHERE id='r65-rem-a-shared'",
            "INSERT INTO public.family_reminders(id,household_id,"
            "created_by_user_id,title,remind_at) VALUES("
            "'r65-forged','h-u-a','u-a','forged',"
            "'2030-11-10T22:00:00+00:00')",
            "SELECT * FROM domi_r31.context_secrets",
        ):
            with conn.cursor() as cur:
                cur.execute("SAVEPOINT r65_probe")
                with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                    cur.execute(sql)
                cur.execute("ROLLBACK TO SAVEPOINT r65_probe")
                cur.execute("RELEASE SAVEPOINT r65_probe")
        assert _visible(conn, "assistant_proposals") == ["r65-prop-a"]


def test_r65_rolled_back_signed_context_cannot_be_replayed(prepared):
    with runtime(prepared, "u-a") as conn:
        assert _visible(conn, "family_reminders") == ["r65-rem-a-shared"]
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE domi_app_runtime")
        # No new HMAC or verified session bound after the transaction boundary.
        assert _visible(conn, "family_reminders") == []
