"""
OPS-2 M11 — Tests del calendario del hogar (sin red).

Cubre: build_ics (escape, UTC, omite canceladas/sin fecha), rango de fechas de
_visible_activities, privacidad (privada de otro no aparece para member), y
evento con recordatorio vinculado (family_reminder M7 con remind_at correcto e
idempotente por dedupe).
Ejecutar: python -m pytest tests/test_family_calendar.py -q
"""
import sys
import uuid
from types import SimpleNamespace
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "cal.db"))
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
                (hid, "Hogar", "{}", "2026-07-22T00:00:00Z"))
    con.execute("INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                (pA, hid, "Ana", "userA", "2026-07-22"))
    con.execute("INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                (pB, hid, "Bruno", "userB", "2026-07-22"))
    con.commit()
    return SimpleNamespace(con=con, hid=hid, pA=pA, pB=pB)


def _mk_act(db, hid, pid, title, starts_at, visibility="family", status="planned"):
    aid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO daily_activities (id,household_id,person_id,title,activity_type,"
        "starts_at,visibility,status,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (aid, hid, pid, title, "other", starts_at, visibility, status, "{}",
         "2026-07-22T00:00:00+00:00", "2026-07-22T00:00:00+00:00"))
    db.commit()
    return aid


def test_build_ics_escapes_and_skips():
    from app.assistant.calendar_export import build_ics
    ics = build_ics([
        {"id": "1", "title": "Cena; con, familia", "starts_at": "2026-07-25T20:00:00+00:00",
         "location_label": "Casa"},
        {"id": "2", "title": "Cancelada", "starts_at": "2026-07-26T10:00:00+00:00", "status": "cancelled"},
        {"id": "3", "title": "Sin fecha", "starts_at": None},
    ])
    assert "BEGIN:VCALENDAR" in ics and ics.endswith("\r\n")
    assert "SUMMARY:Cena\\; con\\, familia" in ics   # escape RFC 5545
    assert "DTSTART:20260725T200000Z" in ics          # UTC básico
    assert "Cancelada" not in ics and "Sin fecha" not in ics
    assert ics.count("BEGIN:VEVENT") == 1


def test_range_and_privacy(env):
    from app.routes.daily_activities import _visible_activities
    db, hid = env.con, env.hid
    _mk_act(db, hid, env.pA, "Julio 25", "2026-07-25T10:00:00+00:00")
    _mk_act(db, hid, env.pA, "Agosto 2", "2026-08-02T10:00:00+00:00")
    _mk_act(db, hid, env.pB, "Privada de Bruno", "2026-07-26T10:00:00+00:00", visibility="private")
    # Rango de julio: incluye 25/07, excluye 02/08.
    julio = _visible_activities(db, hid, "member", "userA", date_from="2026-07-01", date_to="2026-07-31")
    titles = [a["title"] for a in julio]
    assert "Julio 25" in titles and "Agosto 2" not in titles
    # Privacidad: la privada de Bruno no aparece para Ana (member).
    assert "Privada de Bruno" not in titles
    # Bruno sí la ve.
    bruno = _visible_activities(db, hid, "member", "userB", date_from="2026-07-01", date_to="2026-07-31")
    assert "Privada de Bruno" in [a["title"] for a in bruno]


def test_ics_respects_privacy(env):
    from app.routes.daily_activities import _visible_activities
    from app.assistant.calendar_export import build_ics
    db, hid = env.con, env.hid
    _mk_act(db, hid, env.pB, "Secreta", "2026-07-26T10:00:00+00:00", visibility="private")
    ics = build_ics(_visible_activities(db, hid, "member", "userA"))
    assert "Secreta" not in ics


def test_activity_with_linked_reminder(env):
    from app.assistant import reminders as rem
    db, hid = env.con, env.hid
    # Simula lo que hace create_activity: recordatorio 30 min antes, dedupe por actividad.
    aid = _mk_act(db, hid, env.pA, "Dentista", "2026-07-25T15:00:00+00:00")
    rid1 = rem.create_reminder(db, household_id=hid, organization_id=None, person_id=env.pA,
                               created_by_user_id="userA", title="Dentista (en 30 min)", body=None,
                               remind_at="2026-07-25T14:30:00+00:00", dedupe_key=f"activity-{aid}")
    rid2 = rem.create_reminder(db, household_id=hid, organization_id=None, person_id=env.pA,
                               created_by_user_id="userA", title="Dentista (en 30 min)", body=None,
                               remind_at="2026-07-25T14:30:00+00:00", dedupe_key=f"activity-{aid}")
    assert rid1 == rid2  # idempotente
    row = db.execute("SELECT remind_at, status FROM family_reminders WHERE id=?", (rid1,)).fetchone()
    assert row["status"] == "pending"
    assert row["remind_at"].startswith("2026-07-25T14:30")
