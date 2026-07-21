"""
OPS-2.A — Tests de la memoria por persona de Domi (sin red).

Verifica: alta + recall; exclusión de tipos sensibles (salud) del contexto de la
IA; respeto del consentimiento (self-only NO entra); e inyección al contexto del
orquestador. Base SQLite temporal migrada.
Ejecutar: python -m pytest tests/test_domi_memory.py -q
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
    monkeypatch.setenv("DB_PATH", str(tmp_path / "mem.db"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    import importlib
    import app.config as cfg
    importlib.reload(cfg)
    import app.db as dbmod
    importlib.reload(dbmod)
    dbmod.ensure_schema()
    con = dbmod.connect()
    # Hogar + persona mínimos para los joins.
    hid = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    con.execute("INSERT INTO households (id,name,meta,created_at) VALUES (?,?,?,?)",
                (hid, "Hogar Test", "{}", "2026-07-21T00:00:00Z"))
    con.execute("INSERT INTO persons (id,household_id,display_name,created_at) VALUES (?,?,?,?)",
                (pid, hid, "Diego Pérez", "2026-07-21T00:00:00Z"))
    con.commit()
    return SimpleNamespace(con=con, hid=hid, pid=pid)


def test_add_and_recall(env):
    from app.assistant import memory as mem
    db, hid, pid = env.con, env.hid, env.pid
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=pid,
                   memory_type="study_pattern", content="A Diego le cuesta álgebra; rinde mejor en bloques cortos.",
                   importance=0.9, created_by_user_id="u1")
    db.commit()
    got = mem.recall_for_context(db, hid)
    assert len(got) == 1
    assert got[0]["about"] == "Diego"
    assert "álgebra" in got[0]["note"]
    assert got[0]["type"] == "study_pattern"


def test_health_type_excluded_from_context(env):
    from app.assistant import memory as mem
    db, hid, pid = env.con, env.hid, env.pid
    # Un tipo de salud NO se puede crear por add_memory...
    with pytest.raises(ValueError):
        mem.add_memory(db, household_id=hid, organization_id=None, person_id=pid,
                       memory_type="health_context", content="dato clínico", importance=0.9,
                       created_by_user_id="u1")
    # ...y aunque exista en la tabla (insertado por otra vía), recall lo excluye.
    db.execute(
        "INSERT INTO memory_items (id,person_id,household_id,memory_type,content,importance,"
        "consent_scope,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), pid, hid, "health_context", "diagnóstico X", 0.9,
         '{"visible_to":["self","household"]}', "u1", "2026-07-21T00:00:00Z", "2026-07-21T00:00:00Z"),
    )
    db.commit()
    got = mem.recall_for_context(db, hid)
    assert all(g["type"] != "health_context" for g in got)


def test_self_only_consent_excluded(env):
    from app.assistant import memory as mem
    db, hid, pid = env.con, env.hid, env.pid
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=pid,
                   memory_type="preference", content="privado", importance=0.8,
                   created_by_user_id="u1", visible_to_household=False)
    db.commit()
    got = mem.recall_for_context(db, hid)
    assert got == []  # self-only no entra al contexto compartido


def test_orchestrator_context_includes_memories(env):
    from app.assistant import memory as mem
    from app.assistant.orchestrator import build_minimal_context
    db, hid, pid = env.con, env.hid, env.pid
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=pid,
                   memory_type="calm_strategy", content="A Diego lo calma escuchar música suave.",
                   importance=0.7, created_by_user_id="u1")
    db.commit()
    ctx = build_minimal_context(db, hid, "¿cómo ayudo a Diego?")
    assert "memories" in ctx
    assert any("música" in m["note"] for m in ctx["memories"])


def test_family_wide_memory(env):
    from app.assistant import memory as mem
    db, hid = env.con, env.hid
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=None,
                   memory_type="family_story", content="Los domingos almuerzan donde la abuela.",
                   importance=0.6, created_by_user_id="u1")
    db.commit()
    got = mem.recall_for_context(db, hid)
    assert any(g["about"] == "familia" for g in got)
