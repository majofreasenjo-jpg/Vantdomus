"""
OPS-2 M7.A — Tests del motor de recordatorios in-app (sin red).

Cubre: frontera de vencimiento (no entrega antes de la hora, sí después),
idempotencia de la entrega pull (no duplica), dedupe en creación, privacidad
(un recordatorio privado de otro integrante no aparece), y acuse (dismiss).
Ejecutar: python -m pytest tests/test_family_reminders.py -q
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
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "rem.db"))
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
    pB = str(uuid.uuid4())
    con.execute("INSERT INTO households (id,name,meta,created_at) VALUES (?,?,?,?)",
                (hid, "Hogar", "{}", "2026-07-21T00:00:00Z"))
    con.execute("INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                (pA, hid, "Ana", "userA", "2026-07-21"))
    con.execute("INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                (pB, hid, "Bruno", "userB", "2026-07-21"))
    con.commit()
    return SimpleNamespace(con=con, hid=hid, pA=pA, pB=pB)


def test_due_boundary_and_pull_delivery(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    now = datetime(2026, 7, 21, 12, 0, 0, tzinfo=timezone.utc)
    rem.create_reminder(db, household_id=hid, organization_id=None, person_id=None,
                        created_by_user_id="userA", title="Pagar la luz", body=None,
                        remind_at=_iso(now + timedelta(minutes=30)))
    db.commit()
    # Antes de la hora: 0 entregados, nada 'due'.
    assert rem.deliver_due(db, hid, _iso(now)) == 0
    before = rem.list_for_user(db, hid, requester_user_id="userA", requester_person_id=env.pA,
                               requester_role="member", now_iso=_iso(now))
    assert before["unseen"] == 0
    # Después de la hora: se entrega y aparece en la campana.
    after = rem.list_for_user(db, hid, requester_user_id="userA", requester_person_id=env.pA,
                              requester_role="member", now_iso=_iso(now + timedelta(hours=1)))
    assert after["unseen"] == 1
    assert after["items"][0]["is_due"] is True


def test_delivery_is_idempotent(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    now = datetime(2026, 7, 21, 12, 0, 0, tzinfo=timezone.utc)
    rem.create_reminder(db, household_id=hid, organization_id=None, person_id=None,
                        created_by_user_id="userA", title="Sacar la basura", body=None,
                        remind_at=_iso(now - timedelta(minutes=1)))
    db.commit()
    assert rem.deliver_due(db, hid, _iso(now)) == 1
    # Segunda pasada: ya estaba entregado, no re-entrega.
    assert rem.deliver_due(db, hid, _iso(now)) == 0


def test_dedupe_key_no_duplica(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    now = datetime(2026, 7, 21, 12, 0, 0, tzinfo=timezone.utc)
    a = rem.create_reminder(db, household_id=hid, organization_id=None, person_id=None,
                            created_by_user_id="userA", title="Cita dentista", body=None,
                            remind_at=_iso(now), dedupe_key="dentista-2026-07-21")
    b = rem.create_reminder(db, household_id=hid, organization_id=None, person_id=None,
                            created_by_user_id="userA", title="Cita dentista (otra vez)", body=None,
                            remind_at=_iso(now), dedupe_key="dentista-2026-07-21")
    assert a == b


def test_private_reminder_hidden_from_others(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    now = datetime(2026, 7, 21, 12, 0, 0, tzinfo=timezone.utc)
    # Recordatorio privado de Bruno.
    rem.create_reminder(db, household_id=hid, organization_id=None, person_id=env.pB,
                        created_by_user_id="userB", title="Secreto de Bruno", body=None,
                        remind_at=_iso(now - timedelta(minutes=5)),
                        visibility_scope="private_self")
    db.commit()
    # Ana NO lo ve.
    ana = rem.list_for_user(db, hid, requester_user_id="userA", requester_person_id=env.pA,
                            requester_role="member", now_iso=_iso(now))
    assert all("Secreto de Bruno" != it["title"] for it in ana["items"])
    # Bruno SÍ lo ve.
    bruno = rem.list_for_user(db, hid, requester_user_id="userB", requester_person_id=env.pB,
                              requester_role="member", now_iso=_iso(now))
    assert any(it["title"] == "Secreto de Bruno" for it in bruno["items"])


def test_dismiss_acuse(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    now = datetime(2026, 7, 21, 12, 0, 0, tzinfo=timezone.utc)
    rid = rem.create_reminder(db, household_id=hid, organization_id=None, person_id=None,
                              created_by_user_id="userA", title="Llamar al colegio", body=None,
                              remind_at=_iso(now - timedelta(minutes=1)))
    db.commit()
    seen = rem.list_for_user(db, hid, requester_user_id="userA", requester_person_id=env.pA,
                             requester_role="member", now_iso=_iso(now))
    assert seen["unseen"] == 1
    assert rem.dismiss(db, hid, rid, requester_user_id="userA",
                       requester_person_id=env.pA, requester_role="member") is True
    after = rem.list_for_user(db, hid, requester_user_id="userA", requester_person_id=env.pA,
                              requester_role="member", now_iso=_iso(now))
    assert after["unseen"] == 0


def test_other_cannot_dismiss_private(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    now = datetime(2026, 7, 21, 12, 0, 0, tzinfo=timezone.utc)
    rid = rem.create_reminder(db, household_id=hid, organization_id=None, person_id=env.pB,
                              created_by_user_id="userB", title="Privado Bruno", body=None,
                              remind_at=_iso(now - timedelta(minutes=1)),
                              visibility_scope="private_self")
    db.commit()
    # Ana (member, no owner) no puede descartar el privado de Bruno.
    assert rem.dismiss(db, hid, rid, requester_user_id="userA",
                       requester_person_id=env.pA, requester_role="member") is False
