"""
OPS-2 M6 — Tests del resumen del día (a demanda), sin red.

Cubre: modo reglas (sin IA) con tareas/compras; modo IA con complete_json falso;
y privacidad (no incluye memoria privada de otra persona).
Ejecutar: python -m pytest tests/test_domi_summary.py -q
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
    for k in ("ASSISTANT_PROVIDER_MODE", "ASSISTANT_REAL_PROVIDER_ENABLED",
              "ASSISTANT_EXTERNAL_CALLS_ALLOWED", "OPENAI_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "sum.db"))
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
    # 2 tareas abiertas + 3 compras pendientes.
    for t in ("Comprar pan", "Pagar la luz"):
        con.execute("INSERT INTO task_items (id,household_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                    (str(uuid.uuid4()), hid, t, "open", "2026-07-21", "2026-07-21"))
    for s in ("Leche", "Café", "Arroz"):
        con.execute("INSERT INTO household_shopping_items (id,household_id,item_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                    (str(uuid.uuid4()), hid, s, "pending", "2026-07-21", "2026-07-21"))
    con.commit()
    return SimpleNamespace(con=con, hid=hid, pA=pA, pB=pB)


def test_rules_summary_has_tasks_and_shopping(env):
    from app.assistant import summaries as S
    db, hid, pA = env.con, env.hid, env.pA
    r = S.build_personal_summary(db, hid, requester_user_id="userA", requester_person_id=pA,
                                 requester_role="member", person_name="Ana")
    assert r["mode"] == "rules"
    assert "Ana" in r["summary"]
    assert "tarea" in r["summary"].lower()
    assert "producto" in r["summary"].lower()


def test_summary_excludes_other_private_memory(env):
    from app.assistant import summaries as S
    from app.assistant import memory as mem
    db, hid, pA, pB = env.con, env.hid, env.pA, env.pB
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=pB,
                   memory_type="preference", content="secreto de Bruno",
                   importance=0.9, created_by_user_id="userB", visibility_scope="private_self")
    db.commit()
    r = S.build_personal_summary(db, hid, requester_user_id="userA", requester_person_id=pA,
                                 requester_role="member", person_name="Ana")
    assert "secreto de Bruno" not in r["summary"]


def test_ai_summary_with_fake_provider(env, monkeypatch):
    monkeypatch.setenv("APP_ENV", "family-live")
    import app.config as cfg
    monkeypatch.setattr(cfg.settings, "APP_ENV", "family-live")
    monkeypatch.setenv("ASSISTANT_PROVIDER_MODE", "openai")
    monkeypatch.setenv("ASSISTANT_REAL_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-TESTPLACEHOLDER")
    from app.assistant.providers import openai_provider as op
    monkeypatch.setattr(op.OpenAIProvider, "complete_json",
                        lambda self, **kw: {"summary": "Hola Ana, tu día está tranquilo."})
    from app.assistant import summaries as S
    db, hid, pA = env.con, env.hid, env.pA
    r = S.build_personal_summary(db, hid, requester_user_id="userA", requester_person_id=pA,
                                 requester_role="member", person_name="Ana")
    assert r["mode"] == "ai"
    assert "Ana" in r["summary"]
