"""R62: real PostgreSQL concurrent reminder confirmation, disposable CI ONLY.

Run after the R31 57-table RLS fixture in the isolated R53 PostgreSQL job.
The connection uses disposable CI superuser to isolate *transaction semantics*
only; it does NOT establish signed-RLS tenant security or production readiness.
Never point DOMI_RLS_TEST_DSN at Neon or any remote service.

Two independent physical PostgreSQL connections both read a pending proposal.
The first holds its CAS row lock; the second must wait on that same row.
After release, exactly one confirmation and one reminder are committed.
A post-insert audit exception must roll back the reminder on PostgreSQL too.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import pytest

psycopg2 = pytest.importorskip("psycopg2")
DSN = os.environ.get("DOMI_RLS_TEST_DSN", "")
REQUIRED = os.environ.get("DOMI_RLS_REQUIRE_LIVE", "") == "1"
if REQUIRED and not DSN:
    raise RuntimeError("R62 requires disposable PostgreSQL DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="disposable PG CI only")

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps/api"))
from app.db import PostgresConnectionWrapper
from app.assistant import proposals as store


def _disposable_only() -> None:
    u = urlsplit(DSN)
    if (u.scheme not in ("postgres", "postgresql") or
            u.hostname not in ("127.0.0.1", "localhost") or
            u.path != "/domi_rls_ci"):
        pytest.fail("R62 refuses remote and non-disposable PostgreSQL DSNs")


def _connect():
    _disposable_only()
    raw = psycopg2.connect(DSN)
    raw.autocommit = False
    return raw


@pytest.fixture(scope="module")
def pg_ready():
    _disposable_only()
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_user,current_database()")
            assert cur.fetchone() == ("postgres", "domi_rls_ci")
            cur.execute(
                "SELECT to_regclass('public.assistant_proposals'),"
                "to_regclass('public.family_reminders')"
            )
            row = cur.fetchone()
            assert row[0] is not None and row[1] is not None, \
                "R31 real-schema fixture must run before R62"
            cur.execute("SELECT count(*) FROM pg_class c "
                        "JOIN pg_namespace n ON n.oid=c.relnamespace "
                        "WHERE n.nspname='public' AND c.relkind='r' "
                        "AND c.relrowsecurity AND c.relforcerowsecurity")
            assert cur.fetchone()[0] == 57
        conn.rollback()
        yield
    finally:
        conn.close()


@pytest.fixture
def pending(pg_ready):
    suffix = uuid.uuid4().hex
    hid = "r62-h-" + suffix
    uid = "r62-u-" + suffix
    prop_id = "r62-p-" + suffix
    now = "2026-10-17T00:00:00+00:00"
    expiry = "2099-01-01T00:00:00+00:00"
    payload = {"title": "Reunion sintetica", "remind_at":
               "2030-11-10T19:00:00-03:00"}
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO households(id,name,created_at) "
                        "VALUES(%s,%s,%s)", (hid,"R62 synthetic",now))
            cur.execute(
                "INSERT INTO assistant_proposals("
                "id,household_id,user_id,tool_name,category,title,summary,"
                "sensitive,requires_confirmation,proposed_payload,provider,"
                "status,created_at,expires_at) "
                "VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (prop_id,hid,uid,"propose_family_reminder","family",
                 "Reunion sintetica","R62 confirmation candidate",
                 1,1,json.dumps(payload),"mock","pending",now,expiry))
        conn.commit()
    finally:
        conn.close()

    yield {"household_id":hid,"user_id":uid,"id":prop_id}

    conn = _connect()
    try:
        with conn.cursor() as cur:
            for table in ("audit_log","assistant_action_log",
                          "family_reminders","assistant_proposals"):
                cur.execute("DELETE FROM " + table + " WHERE household_id=%s",(hid,))
            cur.execute("DELETE FROM households WHERE id=%s",(hid,))
        conn.commit()
    finally:
        conn.close()


def _count(table, hid):
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM "+table+" WHERE household_id=%s",(hid,))
            return cur.fetchone()[0]
    finally:
        conn.close()


class _CoordinatedPg(PostgresConnectionWrapper):
    """Pause the first caller after holding the proposal row's UPDATE lock."""
    def __init__(self, raw, *, leader: bool, leader_holds, follower_attempts, release):
        super().__init__(raw, signed_rls=False)
        self.leader = leader
        self.leader_holds = leader_holds
        self.follower_attempts = follower_attempts
        self.release = release

    def execute(self, sql, params=None):
        claim = "UPDATE assistant_proposals SET status='confirmed'" in sql
        if claim and not self.leader:
            self.follower_attempts.set()
        cur = super().execute(sql, params)
        if claim and self.leader:
            assert cur.rowcount == 1, "first caller must win the row lock"
            self.leader_holds.set()
            assert self.release.wait(12), "R62 barrier timed out"
        return cur


def test_r62_two_postgres_connections_only_one_can_confirm(pending):
    hid = pending["household_id"]
    uid = pending["user_id"]
    pid = pending["id"]
    leader_holds = threading.Event()
    follower_attempts = threading.Event()
    release = threading.Event()
    out = {}
    thread_errors = {}
    active = {}

    def worker(label, leader):
        raw = _connect()
        active[label] = raw.get_backend_pid()
        db = _CoordinatedPg(raw, leader=leader, leader_holds=leader_holds,
                            follower_attempts=follower_attempts, release=release)
        try:
            proposal = store.get_proposal(db, pid)
            assert proposal and proposal["status"] == "pending"
            try:
                result = store.execute_proposal(db, proposal, uid)
                out[label] = result["status"]
            except store.ProposalConflict:
                out[label] = "stale_rejected"
        except Exception as exc:
            thread_errors[label] = type(exc).__name__
            db.rollback()
        finally:
            db.close()

    t1 = threading.Thread(target=worker,args=("first",True),daemon=True)
    t2 = threading.Thread(target=worker,args=("second",False),daemon=True)
    try:
        t1.start()
        assert leader_holds.wait(8), "first PG caller never claimed the row"
        t2.start()
        assert follower_attempts.wait(8), "second PG caller never attempted CAS"

        # Observe actual PostgreSQL row-lock wait, not just thread scheduling.
        observer = _connect()
        observer.autocommit = True
        try:
            blocked = False
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                pid_second = active.get("second")
                if pid_second:
                    with observer.cursor() as cur:
                        cur.execute("SELECT pg_blocking_pids(%s)",(pid_second,))
                        if cur.fetchone()[0]:
                            blocked = True
                            break
                time.sleep(0.05)
            assert blocked, "second backend did not block on first row lock"
            assert not out and not thread_errors, "side effects before lock release"
        finally:
            observer.close()
    finally:
        release.set()
        t1.join(timeout=12)
        t2.join(timeout=12)

    assert not t1.is_alive() and not t2.is_alive()
    assert not thread_errors, thread_errors
    assert out == {"first":"executed","second":"stale_rejected"}
    assert _count("family_reminders",hid) == 1
    assert _count("assistant_action_log",hid) == 1
    assert _count("audit_log",hid) == 1


def test_r62_postgres_late_audit_failure_rolls_back_reminder(
    pending, monkeypatch
):
    hid,uid,pid = pending["household_id"],pending["user_id"],pending["id"]
    original = store.write_audit_log

    def fail_on_success(db, **kw):
        if kw.get("action") == "assistant_executed":
            raise ValueError("R62 injected failure")
        return original(db, **kw)

    monkeypatch.setattr(store,"write_audit_log",fail_on_success)
    db = PostgresConnectionWrapper(_connect(), signed_rls=False)
    try:
        candidate = store.get_proposal(db,pid)
        with pytest.raises(ValueError,match="R62 injected failure"):
            store.execute_proposal(db,candidate,uid)
    finally:
        db.close()
    assert _count("family_reminders",hid) == 0
    assert _count("assistant_action_log",hid) == 1  # failure audit only
    assert _count("audit_log",hid) == 0

    monkeypatch.setattr(store,"write_audit_log",original)
    db = PostgresConnectionWrapper(_connect(), signed_rls=False)
    try:
        current = store.get_proposal(db,pid)
        assert current["status"] == "failed"
        assert store.execute_proposal(db,current,uid)["status"] == "executed"
    finally:
        db.close()
    assert _count("family_reminders",hid) == 1
