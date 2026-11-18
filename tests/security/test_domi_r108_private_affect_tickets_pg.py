"""R108: disposable PostgreSQL proof for private consent voucher design.

No Neon or production. Issuer is deliberately absent: test superuser seeds
synthetic vouchers only to falsify SQL authorization and replay claims.
Never interpret seeding by superuser as proof of human consent.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlsplit
import uuid

import pytest

psycopg2 = pytest.importorskip("psycopg2")
DSN = os.getenv("DOMI_RLS_TEST_DSN", "")
REQUIRED = os.getenv("DOMI_RLS_REQUIRE_LIVE", "") == "1"
if REQUIRED and not DSN:
    raise RuntimeError("R108 requires dedicated disposable PostgreSQL")
pytestmark = pytest.mark.skipif(not DSN, reason="Disposable PostgreSQL CI only")
ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "apps/api/postgres_staging_migrations"
SOURCE = MIG / "security/306_domi_r108_private_affect_ticket_candidate.sql"
sys.path.insert(0, str(ROOT / "apps/api"))

from app.pg_rls_context import bind_signed_rls_context


def connect():
    p = urlsplit(DSN)
    if (p.scheme not in ("postgres", "postgresql")
            or p.hostname not in ("127.0.0.1", "localhost")
            or p.path != "/domi_rls_ci"):
        pytest.fail("R108 refuses a remote or persistent DB")
    return psycopg2.connect(DSN)


def scalar(conn, query, args=()):
    with conn.cursor() as cur:
        cur.execute(query, args)
        return cur.fetchone()[0]


@pytest.fixture(scope="module")
def admin():
    conn = connect()
    try:
        with conn:
            with conn.cursor() as cur:
                assert scalar(conn, "SELECT current_database()") == "domi_rls_ci"
                for name in ("000_110_part_a.sql", "120_260_part_b.sql", "270_287_part_c.sql"):
                    cur.execute((MIG / name).read_text(encoding="utf8"))
                cur.execute((MIG / "security/300_domi_r31_owner_beta_rls_up.sql").read_text(encoding="utf8"))
                cur.execute((MIG / "security/301_domi_r33_owner_beta_rls_hardening.sql").read_text(encoding="utf8"))
                # Voucher issuer is NOT built. Synthetic fixture is seeded by
                # admin for model falsification ONLY.
                for uid in ("u-a", "u-b"):
                    cur.execute(
                        "INSERT INTO users(id,email,password_hash,is_active,created_at) "
                        "VALUES(%s,%s,'synthetic',1,'2026-11-17T00:00:00Z')",
                        (uid,uid+"@example.invalid"))
                    cur.execute(
                        "INSERT INTO auth_sessions(id,user_id,token_jti,created_at,expires_at) "
                        "VALUES(%s,%s,%s,'2026-11-17T00:00:00Z','2099-11-17T00:00:00Z')",
                        ("s-"+uid,uid,"jti-"+uid))
                    cur.execute(
                        "INSERT INTO households(id,name,created_at) "
                        "VALUES(%s,%s,'2026-11-17T00:00:00Z')",("h-"+uid,uid))
                    cur.execute(
                        "INSERT INTO household_memberships(household_id,user_id,role,created_at) "
                        "VALUES(%s,%s,'owner','2026-11-17T00:00:00Z')",("h-"+uid,uid))
                    cur.execute(
                        "INSERT INTO persons(id,household_id,display_name,created_at,user_id,age_band) "
                        "VALUES(%s,%s,'Test','2026-11-17T00:00:00Z',%s,'adult')",
                        ("p-"+uid,"h-"+uid,uid))
                    cur.execute(
                        "INSERT INTO memory_items"
                        "(id,person_id,household_id,memory_type,content,importance,"
                        "consent_scope,visibility_scope,created_by_user_id,created_at,"
                        "updated_at,source,sensitivity,inference_status,verified_at)"
                        "VALUES(%s,%s,%s,'preference',%s,0.5,%s,'private_self',%s,"
                        "'2026-11-17T00:00:00Z','2026-11-17T00:00:00Z',"
                        "'family','normal','confirmed','2026-11-17T00:00:00Z')",
                        ("m-"+uid,"p-"+uid,"h-"+uid,"fictional:"+uid,
                         '{"visible_to":["self"]}',uid))
                cur.execute(SOURCE.read_text(encoding="utf8"))
                import secrets
                secret=secrets.token_urlsafe(48)
                os.environ["DOMI_RLS_CONTEXT_SECRET"]=secret
                cur.execute(
                    "INSERT INTO domi_r31.context_secrets(key_name,secret_key) "
                    "VALUES('active',convert_to(%s,'UTF8'))",(secret,))
                import secrets
                password=secrets.token_urlsafe(32)
                cur.execute(
                    "CREATE ROLE domi_r108_ci_login LOGIN NOINHERIT NOSUPERUSER "
                    "NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %s", (password,))
                cur.execute("GRANT domi_app_runtime TO domi_r108_ci_login")
                cur.execute("GRANT CONNECT ON DATABASE domi_rls_ci TO domi_r108_ci_login")
        yield conn,password
    finally:
        conn.close()


def login(admin, uid):
    conn=psycopg2.connect(DSN, user="domi_r108_ci_login",password=admin[1])
    conn.autocommit=False
    with conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE domi_app_runtime")
        if uid:
            assert bind_signed_rls_context(conn,uid,"jti-"+uid)
    return conn


def seed_voucher(admin, uid="u-a", *, memory="m-u-a", memory_owner="u-a",
                 expires="2099-01-01T00:00:00Z", revoked=False):
    conn=admin[0]
    voucher=str(uuid.uuid4())
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO domi_affect.approved_tickets("
                "id,household_id,person_id,memory_id,memory_updated_at,"
                "memory_content_sha256,ratified_by_user_id,context_key,"
                "valence,activation,relevance,issued_at,expires_at,revoked_at)"
                "VALUES(%s,%s,%s,%s,'2026-11-17T00:00:00Z',"
                "digest(convert_to(%s,'UTF8'),'sha256'),%s,'schedule',"
                "0.75,0.5,1.0,%s,%s,%s)",
                (voucher,"h-"+memory_owner,"p-"+memory_owner,memory,
                 "fictional:"+memory_owner,uid,
                 "2024-01-01T00:00:00Z" if expires.startswith("2025") else "2026-11-17T00:00:00Z",
                 expires,
                 "2026-11-17T00:00:00Z" if revoked else None))
    return voucher


def test_pg_private_schema_preserves_57_table_public_inventory(admin):
    conn=admin[0]
    assert scalar(conn,"SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'")==57
    assert scalar(conn,"SELECT COUNT(*) FROM pg_tables WHERE schemaname='domi_affect'")==2
    assert scalar(conn, "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                  "WHERE n.nspname='domi_affect' AND c.relkind='r' "
                  "AND c.relrowsecurity AND c.relforcerowsecurity")==2
    for obj in ("approved_tickets","memory_links"):
        assert scalar(conn, "SELECT has_table_privilege('domi_app_runtime',"
                      "%s,'SELECT')",("domi_affect."+obj,)) is False


def test_runtime_cannot_mint_ticket_or_write_private_link(admin):
    conn=login(admin,"u-a")
    try:
        for sql in (
            "SELECT id FROM domi_affect.approved_tickets",
            "INSERT INTO domi_affect.approved_tickets(id) VALUES(gen_random_uuid())",
            "UPDATE domi_affect.approved_tickets SET used_at=clock_timestamp()",
            "DELETE FROM domi_affect.approved_tickets",
            "SELECT id FROM domi_affect.memory_links",
            "INSERT INTO domi_affect.memory_links(id) VALUES(gen_random_uuid())",
            "UPDATE domi_affect.memory_links SET revoked_at=clock_timestamp()",
            "DELETE FROM domi_affect.memory_links",
        ):
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                with conn.cursor() as cur: cur.execute(sql)
            conn.rollback()
            with conn.cursor() as cur: cur.execute("SET LOCAL ROLE domi_app_runtime")
            assert bind_signed_rls_context(conn,"u-a","jti-u-a")
    finally:
        conn.rollback()
        conn.close()


def test_signed_subject_redeems_own_one_use_ticket(admin):
    ticket=seed_voucher(admin)
    conn=login(admin,"u-a")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT domi_affect.redeem_ticket(%s::uuid)",(ticket,))
            new_id=cur.fetchone()[0]
            assert new_id is not None
            cur.execute("SELECT domi_affect.redeem_ticket(%s::uuid)",(ticket,))
            assert cur.fetchone()[0] is None
        conn.commit()
    finally:
        conn.close()
    assert scalar(admin[0],"SELECT COUNT(*) FROM domi_affect.memory_links "
                  "WHERE receipt_id=%s::uuid",(ticket,))==1


@pytest.mark.parametrize("bad_kind",["wrong_user","wrong_memory","expired","revoked"])
def test_invalid_voucher_fails_closed(admin,bad_kind):
    if bad_kind=="wrong_user":
        ticket=seed_voucher(admin,uid="u-a")
        actor="u-b"
    elif bad_kind=="wrong_memory":
        ticket=seed_voucher(admin,memory="m-u-b",memory_owner="u-a")
        actor="u-a"
    elif bad_kind=="expired":
        ticket=seed_voucher(admin,expires="2025-01-01T00:00:00Z")
        actor="u-a"
    else:
        ticket=seed_voucher(admin,revoked=True)
        actor="u-a"
    conn=login(admin,actor)
    try:
        assert scalar(conn,"SELECT domi_affect.redeem_ticket(%s::uuid)",(ticket,)) is None
    finally:
        conn.rollback()
        conn.close()


def test_unsigned_connection_cannot_redeem(admin):
    ticket=seed_voucher(admin)
    conn=login(admin,"")
    try:
        assert scalar(conn,"SELECT domi_affect.redeem_ticket(%s::uuid)",(ticket,)) is None
    finally:
        conn.rollback()
        conn.close()


def test_content_mismatch_invalidates_ticket(admin):
    ticket=seed_voucher(admin)
    try:
        with admin[0]:
            with admin[0].cursor() as cur:
                cur.execute("UPDATE memory_items SET content='changed-without-timestamp' WHERE id='m-u-a'")
        conn=login(admin,"u-a")
        try:
            assert scalar(conn,"SELECT domi_affect.redeem_ticket(%s::uuid)",(ticket,)) is None
        finally:
            conn.rollback()
            conn.close()
    finally:
        # Test isolation: no mutation may affect the later concurrency
        # falsifier or turn a valid voucher into a mismatched memory.
        with admin[0]:
            with admin[0].cursor() as cur:
                cur.execute("UPDATE memory_items SET content='fictional:u-a' WHERE id='m-u-a'")


def test_signed_jti_mismatch_denies_ticket(admin):
    ticket=seed_voucher(admin)
    conn=psycopg2.connect(DSN, user="domi_r108_ci_login",password=admin[1])
    conn.autocommit=False
    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE domi_app_runtime")
            assert not bind_signed_rls_context(conn,"u-a","wrong-jti")
            assert scalar(conn,"SELECT domi_affect.redeem_ticket(%s::uuid)",(ticket,)) is None
    finally:
        conn.rollback()
        conn.close()


def test_two_concurrent_verified_sessions_only_redeem_one_ticket(admin):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    ticket=seed_voucher(admin)
    barrier=Barrier(2)

    def compete(_):
        conn=login(admin,"u-a")
        try:
            barrier.wait(timeout=10)
            result=scalar(conn,"SELECT domi_affect.redeem_ticket(%s::uuid)",(ticket,))
            conn.commit()
            return result
        finally:
            conn.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(compete,[0,1]))
    assert sum(v is not None for v in outcomes)==1
    assert scalar(admin[0],"SELECT count(*) FROM domi_affect.memory_links "
                  "WHERE receipt_id=%s::uuid",(ticket,))==1
