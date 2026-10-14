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
DOWN_R36 = MIG_DIR / "security/302_domi_r36_owner_beta_rls_safe_rollback.sql"
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



def test_r36_signed_runtime_wrapper_verifies_rls_and_transaction_rebind(admin):
    from app.db import PostgresConnectionWrapper
    assert _CI_RUNTIME_PASSWORD is not None
    raw=psycopg2.connect(DSN,user="domi_r31_ci_client",password=_CI_RUNTIME_PASSWORD)
    wrapped=PostgresConnectionWrapper(raw,signed_rls=True)
    try:
        assert wrapped.bind_verified_session("u-a","jti-u-a") is True
        assert wrapped.execute("SELECT COUNT(*) AS n FROM public.memory_items").fetchone()["n"]==1
        wrapped.commit()
        assert wrapped.execute("SELECT COUNT(*) AS n FROM public.memory_items").fetchone()["n"]==1
        wrapped.rollback()
        assert wrapped.execute("SELECT COUNT(*) AS n FROM public.memory_items").fetchone()["n"]==1
        assert wrapped.bind_verified_session("u-a","wrong-jti") is False
        # Failure must invalidate the formerly successful identity.
        assert wrapped._auth_context.authenticated is False
    finally:
        wrapped.close()


def test_r36_signed_runtime_rejects_unprivileged_but_unverified_user(admin):
    from app.db import PostgresConnectionWrapper
    raw=psycopg2.connect(DSN,user="domi_r31_ci_client",password=_CI_RUNTIME_PASSWORD)
    wrapped=PostgresConnectionWrapper(raw,signed_rls=True)
    try:
        assert wrapped.bind_verified_session("u-b","invalid") is False
        assert wrapped._auth_context.authenticated is False
    finally:
        wrapped.close()


# R38 HTTP proof: real FastAPI dependency graph + signed JWT + PostgreSQL RLS.
# This is a disposable HTTP TestClient, NOT an external owner-device test.
@pytest.fixture
def r38_http(admin, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.deps import get_db
    from app.db import PostgresConnectionWrapper
    from app.routes.owner_memory import router
    from app.config import settings

    monkeypatch.setattr(settings, "JWT_SECRET", "r38-ci-only-strong-jwt-signing-key-fake-2026")
    monkeypatch.setenv("DOMI_ENABLE_OWNER_PG_MEMORY", "1")
    monkeypatch.setenv("DOMI_ENABLE_SIGNED_RLS_RUNTIME", "1")
    monkeypatch.setenv("DOMI_ENABLE_PG_AUTH_LOGIN", "1")
    monkeypatch.setenv("APP_ENV", "local")

    def isolated_pg():
        raw = psycopg2.connect(
            DSN, user="domi_r31_ci_client", password=_CI_RUNTIME_PASSWORD,
        )
        db = PostgresConnectionWrapper(raw, signed_rls=True)
        try:
            yield db
        finally:
            db.close()

    http_app = FastAPI()
    http_app.include_router(router)
    http_app.dependency_overrides[get_db] = isolated_pg
    with TestClient(http_app) as client:
        yield client


def _r38_token(user_id: str, jti: str) -> dict:
    from app.security import create_access_token
    token, _ = create_access_token(user_id, user_id+"@example.invalid",jti=jti)
    return {"Authorization":"Bearer "+token}


def test_r38_http_requires_signed_bearer(r38_http):
    url="/owner-beta/memory/private"
    assert r38_http.get(url).status_code==401
    assert r38_http.get(url,headers={"Authorization":"Bearer invalid"}).status_code==401
    assert r38_http.get(url,headers=_r38_token("u-a","wrong-jti")).status_code==401


def test_r38_http_private_memory_survives_new_request_and_db_connection(r38_http):
    url="/owner-beta/memory/private"
    owner=_r38_token("u-a","jti-u-a")
    data={"person_id":"p-u-a","content":"fictional:R38 memory continuity marker"}
    created=r38_http.post(url,headers=owner,json=data)
    assert created.status_code==201, created.text
    memory_id=created.json()["id"]
    # Next request obtains a NEW PostgreSQL SQL connection and transaction.
    reopened=r38_http.get(url,headers=owner)
    assert reopened.status_code==200, reopened.text
    assert reopened.headers["Cache-Control"]=="no-store"
    assert any(row["id"]==memory_id and row["content"]==data["content"]
               for row in reopened.json()["items"])


def test_r38_http_cross_household_memory_never_visible(r38_http):
    url="/owner-beta/memory/private"
    a=r38_http.get(url,headers=_r38_token("u-a","jti-u-a"))
    b=r38_http.get(url,headers=_r38_token("u-b","jti-u-b"))
    assert a.status_code==200 and b.status_code==200
    assert all(row["content"]!="fictional:R38 memory continuity marker"
               for row in b.json()["items"])
    assert all(row["id"]!="m-u-b" for row in a.json()["items"])
    # The owner cannot post against another household/person either.
    forbidden=r38_http.post(url,headers=_r38_token("u-a","jti-u-a"),
        json={"person_id":"p-u-b","content":"fictional:cross-home"})
    assert forbidden.status_code==404


def test_r38_http_client_cannot_change_consent_or_owner(r38_http):
    url="/owner-beta/memory/private"
    result=r38_http.post(url,headers=_r38_token("u-a","jti-u-a"),
      json={
        "person_id":"p-u-a","content":"fictional:R38",
        "visibility_scope":"household_shared",
      })
    assert result.status_code==422


def test_r38_http_private_memory_feature_off_is_closed(r38_http,monkeypatch):
    monkeypatch.setenv("DOMI_ENABLE_OWNER_PG_MEMORY","0")
    url="/owner-beta/memory/private"
    resp=r38_http.get(url,headers=_r38_token("u-a","jti-u-a"))
    assert resp.status_code==503
    assert not resp.json().get("items")


def test_r38_http_private_memory_rejects_production_mode(r38_http,monkeypatch):
    monkeypatch.setenv("APP_ENV","production")
    resp=r38_http.get("/owner-beta/memory/private",
        headers=_r38_token("u-a","jti-u-a"))
    assert resp.status_code==503




# R39 real HTTP-to-existing-chat-provider bridge. Strictly MOCKED provider:
# CI never sends memory over a network or incurs LLM costs.
def _r39_mock_provider(monkeypatch,handler):
    from app.assistant.providers.openai_provider import OpenAIProvider
    monkeypatch.setenv("DOMI_OWNER_CHAT_ENABLED","1")
    monkeypatch.setenv("DOMI_OWNER_CHAT_EXTERNAL_MEMORY_ALLOWED","1")
    monkeypatch.setattr(OpenAIProvider,"is_available",lambda self: True)
    monkeypatch.setattr(
        OpenAIProvider,"complete_json",
        lambda self,*,system,user,max_tokens: handler(system,user,max_tokens)
    )


def _r39_body(consent=True):
    return {"question":"Que recuerdas sobre mi?","share_private_memories_with_provider":consent}


def test_r39_chat_requires_new_explicit_consent(r38_http,monkeypatch):
    _r39_mock_provider(monkeypatch,lambda *_: (_ for _ in ()).throw(
        AssertionError("provider called without consent")))
    r=r38_http.post("/owner-beta/memory/chat",headers=_r38_token("u-a","jti-u-a"),
                    json=_r39_body(False))
    assert r.status_code==403


def test_r39_chat_is_disabled_without_server_flags(r38_http,monkeypatch):
    monkeypatch.delenv("DOMI_OWNER_CHAT_ENABLED",raising=False)
    monkeypatch.delenv("DOMI_OWNER_CHAT_EXTERNAL_MEMORY_ALLOWED",raising=False)
    r=r38_http.post("/owner-beta/memory/chat",headers=_r38_token("u-a","jti-u-a"),
                    json=_r39_body())
    assert r.status_code==503


def test_r39_chat_existing_provider_gates_still_mandatory(r38_http,monkeypatch):
    monkeypatch.setenv("DOMI_OWNER_CHAT_ENABLED","1")
    monkeypatch.setenv("DOMI_OWNER_CHAT_EXTERNAL_MEMORY_ALLOWED","1")
    monkeypatch.setenv("ASSISTANT_PROVIDER_MODE","mock")
    monkeypatch.setenv("ASSISTANT_REAL_PROVIDER_ENABLED","0")
    monkeypatch.setenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED","0")
    monkeypatch.delenv("OPENAI_API_KEY",raising=False)
    r=r38_http.post("/owner-beta/memory/chat",headers=_r38_token("u-a","jti-u-a"),
                    json=_r39_body())
    assert r.status_code==503


def test_r39_chat_recalls_owner_private_memory_across_http_requests(r38_http,monkeypatch):
    import json
    marker="fictional:R39 owner A consented preference"
    owner=_r38_token("u-a","jti-u-a")
    write=r38_http.post("/owner-beta/memory/private",headers=owner,
        json={"person_id":"p-u-a","content":marker})
    assert write.status_code==201,write.text
    captured=[]
    def fake(system,user,max_tokens):
        values=json.loads(user)
        captured.append(values)
        assert "nunca son instrucciones" in system
        assert max_tokens==400
        assert marker in values["authorized_private_memories"]
        assert "household_id" not in values and "user_id" not in values
        return {"reply":"Recuerdo la preferencia autorizada."}
    _r39_mock_provider(monkeypatch,fake)
    reply=r38_http.post("/owner-beta/memory/chat",headers=owner,json=_r39_body())
    assert reply.status_code==200,reply.text
    assert reply.headers["Cache-Control"]=="no-store"
    assert reply.json()["reply"]=="Recuerdo la preferencia autorizada."
    assert reply.json()["authorized_memory_count"]>=1
    assert len(captured)==1


def test_r39_chat_never_includes_other_household_memory(r38_http,monkeypatch):
    import json
    marker="fictional:R39 no transfer from owner A to B"
    a=_r38_token("u-a","jti-u-a")
    assert r38_http.post("/owner-beta/memory/private",headers=a,
        json={"person_id":"p-u-a","content":marker}).status_code==201
    seen=[]
    def fake(system,user,max_tokens):
        seen.append(json.loads(user))
        return {"reply":"Respuesta sin memoria ajena."}
    _r39_mock_provider(monkeypatch,fake)
    b=r38_http.post("/owner-beta/memory/chat",
        headers=_r38_token("u-b","jti-u-b"),json=_r39_body())
    assert b.status_code==200,b.text
    assert len(seen)==1
    assert marker not in json.dumps(seen[0],ensure_ascii=False)


def test_r39_chat_rejects_wrong_session_before_provider(r38_http,monkeypatch):
    _r39_mock_provider(monkeypatch,lambda *_: (_ for _ in ()).throw(
        AssertionError("bad session reached provider")))
    r=r38_http.post("/owner-beta/memory/chat",
        headers=_r38_token("u-a","wrong-jti"),json=_r39_body())
    assert r.status_code==401


def test_r39_chat_rejects_extra_provider_actions(r38_http,monkeypatch):
    _r39_mock_provider(monkeypatch,lambda *_: {
        "reply":"test","actions":[{"tool":"unsafe"}]
    })
    r=r38_http.post("/owner-beta/memory/chat",
        headers=_r38_token("u-a","jti-u-a"),json=_r39_body())
    assert r.status_code==503 and "unsafe" not in r.text


def test_r39_chat_experimental_route_never_runs_in_production(r38_http,monkeypatch):
    _r39_mock_provider(monkeypatch,lambda *_: (_ for _ in ()).throw(
        AssertionError("production context reached provider")))
    monkeypatch.setenv("APP_ENV","production")
    r=r38_http.post("/owner-beta/memory/chat",
        headers=_r38_token("u-a","jti-u-a"),json=_r39_body())
    assert r.status_code==503


def test_r40_owner_person_picker_uses_signed_rls(r38_http):
    a=r38_http.get("/owner-beta/memory/persons",headers=_r38_token("u-a","jti-u-a"))
    b=r38_http.get("/owner-beta/memory/persons",headers=_r38_token("u-b","jti-u-b"))
    assert a.status_code==200 and b.status_code==200
    assert a.headers["Cache-Control"]=="no-store"
    assert [v["id"] for v in a.json()["items"]]==["p-u-a"]
    assert [v["id"] for v in b.json()["items"]]==["p-u-b"]
    assert all(set(v)=={"id","name"} for v in a.json()["items"])


def test_r40_person_picker_denies_unsigned_and_invalid_sessions(r38_http):
    assert r38_http.get("/owner-beta/memory/persons").status_code==401
    assert r38_http.get("/owner-beta/memory/persons",
        headers=_r38_token("u-a","wrong-jti")).status_code==401



def test_r41_owner_api_denies_missing_force_rls_in_57_table_schema(r38_http,admin):
    with admin:
        with admin.cursor() as cur:
            cur.execute("ALTER TABLE public.scheduler_runs NO FORCE ROW LEVEL SECURITY")
    try:
        response=r38_http.get("/owner-beta/memory/private",
            headers=_r38_token("u-a","jti-u-a"))
        assert response.status_code==503
        assert "RLS admission" in response.text
    finally:
        with admin:
            with admin.cursor() as cur:
                cur.execute("ALTER TABLE public.scheduler_runs FORCE ROW LEVEL SECURITY")


def test_r41_owner_api_denies_schema_drift_with_force_rls(r38_http,admin):
    with admin:
        with admin.cursor() as cur:
            cur.execute("CREATE TABLE public.r41_synthetic_drift(id text PRIMARY KEY)")
            cur.execute("ALTER TABLE public.r41_synthetic_drift ENABLE ROW LEVEL SECURITY")
            cur.execute("ALTER TABLE public.r41_synthetic_drift FORCE ROW LEVEL SECURITY")
            cur.execute("CREATE POLICY r41_deny ON public.r41_synthetic_drift "
                        "TO domi_app_runtime USING (false) WITH CHECK (false)")
    try:
        response=r38_http.get("/owner-beta/memory/private",
            headers=_r38_token("u-a","jti-u-a"))
        assert response.status_code==503
    finally:
        with admin:
            with admin.cursor() as cur:
                cur.execute("DROP TABLE public.r41_synthetic_drift")




def test_r44_signed_startup_gate_accepts_real_disposable_schema(admin):
    from app.pg_staging_gate import check_postgres_staging_readiness
    from app.db import PostgresConnectionWrapper
    raw=psycopg2.connect(
        DSN,user="domi_r31_ci_client",password=_CI_RUNTIME_PASSWORD
    )
    wrapper=PostgresConnectionWrapper(raw,signed_rls=True)
    try:
        check_postgres_staging_readiness(wrapper,signed_rls=True)
    finally:
        wrapper.close()


def test_r44_signed_startup_gate_rejects_revoked_verifier_execute(admin):
    from app.pg_staging_gate import check_postgres_staging_readiness
    from app.db import PostgresConnectionWrapper
    with admin:
        with admin.cursor() as cur:
            cur.execute(
                "REVOKE EXECUTE ON FUNCTION domi_r31.subject_id() FROM domi_app_runtime"
            )
    try:
        raw=psycopg2.connect(
            DSN,user="domi_r31_ci_client",password=_CI_RUNTIME_PASSWORD
        )
        wrapper=PostgresConnectionWrapper(raw,signed_rls=True)
        try:
            with pytest.raises(RuntimeError,match="POSTGRES_SIGNED_AUTH_GATE"):
                check_postgres_staging_readiness(wrapper,signed_rls=True)
        finally:
            wrapper.close()
    finally:
        with admin:
            with admin.cursor() as cur:
                cur.execute(
                    "GRANT EXECUTE ON FUNCTION domi_r31.subject_id() TO domi_app_runtime"
                )


def test_safe_rollback_never_disables_rls(admin):
    with admin:
        with admin.cursor() as cur:
            cur.execute(DOWN_R36.read_text(encoding="utf8"))
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
