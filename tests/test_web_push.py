"""
OPS-2 M7.B — Tests de Web Push (sin red).

Cubre: gating fail-closed (sin llaves VAPID → deshabilitado), guardado/borrado
idempotente de suscripciones, envío best-effort con transporte falso (sin red),
limpieza de suscripciones muertas (410), y el barrido tick (deliver_due_detailed
+ households_with_pending). El cifrado real (pywebpush) queda tras _send_raw, que
aquí se monkeypatchea.
Ejecutar: python -m pytest tests/test_web_push.py -q
"""
import sys
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


def _iso(dt):
    return dt.astimezone(timezone.utc).isoformat()


@pytest.fixture()
def env(tmp_path, monkeypatch):
    for k in ("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "REMINDER_TICK_SECRET"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "push.db"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    import importlib
    import app.config as cfg
    importlib.reload(cfg)
    import app.db as dbmod
    importlib.reload(dbmod)
    dbmod.ensure_schema()
    con = dbmod.connect()
    hid = str(uuid.uuid4())
    pA = str(uuid.uuid4())
    con.execute("INSERT INTO households (id,name,meta,created_at) VALUES (?,?,?,?)",
                (hid, "Hogar", "{}", "2026-07-22T00:00:00Z"))
    con.execute("INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                (pA, hid, "Ana", "userA", "2026-07-22"))
    con.commit()
    return SimpleNamespace(con=con, hid=hid, pA=pA)


def test_push_disabled_without_vapid(env):
    from app.assistant import web_push as wp
    # Sin llaves VAPID en el entorno → deshabilitado, pase lo que pase el perfil.
    assert wp.push_configured() is False
    assert wp.push_enabled() is False


def test_save_and_delete_subscription(env):
    from app.assistant import web_push as wp
    db, hid = env.con, env.hid
    sid = wp.save_subscription(db, household_id=hid, person_id=env.pA, user_id="userA",
                               endpoint="https://push.example/abc", p256dh="KEY", auth="AUTH")
    assert sid
    # Upsert por endpoint: mismo endpoint no duplica.
    sid2 = wp.save_subscription(db, household_id=hid, person_id=env.pA, user_id="userA",
                                endpoint="https://push.example/abc", p256dh="KEY2", auth="AUTH2")
    assert sid2 == sid
    n = db.execute("SELECT COUNT(*) c FROM web_push_subscriptions WHERE household_id=?", (hid,)).fetchone()["c"]
    assert n == 1
    assert wp.delete_subscription(db, endpoint="https://push.example/abc", household_id=hid) is True


def test_notify_skipped_when_disabled(env):
    from app.assistant import web_push as wp
    db, hid = env.con, env.hid
    wp.save_subscription(db, household_id=hid, person_id=env.pA, user_id="userA",
                         endpoint="https://push.example/x", p256dh="K", auth="A")
    res = wp.notify_person(db, household_id=hid, person_id=env.pA, title="Hola", body="test")
    assert res["skipped"] is True
    assert res["sent"] == 0


def test_notify_sends_and_cleans_dead(env, monkeypatch):
    from app.assistant import web_push as wp
    db, hid = env.con, env.hid
    wp.save_subscription(db, household_id=hid, person_id=env.pA, user_id="userA",
                         endpoint="https://push.example/live", p256dh="K", auth="A")
    wp.save_subscription(db, household_id=hid, person_id=env.pA, user_id="userA",
                         endpoint="https://push.example/dead", p256dh="K", auth="A")
    monkeypatch.setattr(wp, "push_enabled", lambda: True)
    # Transporte falso: 'live' entrega 201, 'dead' responde 410 (suscripción muerta).
    def fake_send(*, endpoint, p256dh, auth, payload):
        return 410 if endpoint.endswith("/dead") else 201
    monkeypatch.setattr(wp, "_send_raw", fake_send)
    res = wp.notify_person(db, household_id=hid, person_id=env.pA, title="Recordatorio", body="Pagar luz")
    assert res["sent"] == 1
    assert res["dead"] == 1
    # La muerta se borró; la viva quedó con last_ok_at.
    rows = db.execute("SELECT endpoint, last_ok_at FROM web_push_subscriptions WHERE household_id=?", (hid,)).fetchall()
    assert len(rows) == 1
    assert rows[0]["endpoint"].endswith("/live")
    assert rows[0]["last_ok_at"]


def test_private_reminder_only_targets_subject(env, monkeypatch):
    from app.assistant import web_push as wp
    db, hid = env.con, env.hid
    pB = str(uuid.uuid4())
    db.execute("INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
               (pB, hid, "Bruno", "userB", "2026-07-22"))
    wp.save_subscription(db, household_id=hid, person_id=env.pA, user_id="userA",
                         endpoint="https://push.example/ana", p256dh="K", auth="A")
    wp.save_subscription(db, household_id=hid, person_id=pB, user_id="userB",
                         endpoint="https://push.example/bruno", p256dh="K", auth="A")
    monkeypatch.setattr(wp, "push_enabled", lambda: True)
    hits = []
    monkeypatch.setattr(wp, "_send_raw", lambda **kw: (hits.append(kw["endpoint"]), 201)[1])
    # Recordatorio dirigido SOLO a Bruno → solo su dispositivo recibe.
    wp.notify_person(db, household_id=hid, person_id=pB, title="Privado", body="de Bruno")
    assert hits == ["https://push.example/bruno"]


def test_tick_endpoint_auth(env, monkeypatch):
    import importlib
    import app.routes.assistant as ar
    importlib.reload(ar)
    from fastapi import HTTPException
    db = env.con
    # Sin secreto configurado → 503 (no se puede autenticar el barrido).
    monkeypatch.delenv("REMINDER_TICK_SECRET", raising=False)
    with pytest.raises(HTTPException) as e1:
        ar.reminders_tick(db=db, x_tick_secret="lo-que-sea")
    assert e1.value.status_code == 503
    # Secreto configurado pero header equivocado → 401.
    monkeypatch.setenv("REMINDER_TICK_SECRET", "s3cr3t")
    with pytest.raises(HTTPException) as e2:
        ar.reminders_tick(db=db, x_tick_secret="incorrecto")
    assert e2.value.status_code == 401
    # Secreto correcto → corre (push deshabilitado en test, solo entrega in-app).
    out = ar.reminders_tick(db=db, x_tick_secret="s3cr3t")
    assert out["ok"] is True
    assert out["push_enabled"] is False


def test_tick_helpers(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    now = datetime(2026, 7, 22, 12, 0, 0, tzinfo=timezone.utc)
    rem.create_reminder(db, household_id=hid, organization_id=None, person_id=env.pA,
                        created_by_user_id="userA", title="Vencido", body=None,
                        remind_at=_iso(now - timedelta(minutes=1)))
    rem.create_reminder(db, household_id=hid, organization_id=None, person_id=env.pA,
                        created_by_user_id="userA", title="Futuro", body=None,
                        remind_at=_iso(now + timedelta(hours=2)))
    db.commit()
    assert hid in rem.households_with_pending(db)
    delivered = rem.deliver_due_detailed(db, hid, _iso(now))
    assert len(delivered) == 1
    assert delivered[0]["title"] == "Vencido"
    # Idempotente: segunda pasada no re-entrega.
    assert rem.deliver_due_detailed(db, hid, _iso(now)) == []
