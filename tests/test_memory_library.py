"""
OPS-2 M8 — Tests de la Biblioteca de Domi (6 capas) + inferencias (sin red).

Cubre: clasificación en capas, inferencia pending NO entra al contexto hasta
confirmar, dismiss la excluye, supersede retira la vieja, biblioteca agrupada +
privacidad, export, y corregir con permisos.
Ejecutar: python -m pytest tests/test_memory_library.py -q
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
    monkeypatch.setenv("DB_PATH", str(tmp_path / "lib.db"))
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


def test_layer_classification():
    from app.assistant import memory as mem
    assert mem.layer_of(memory_type="preference", visibility_scope="private_self", source="family") == "personal"
    assert mem.layer_of(memory_type="family_story", visibility_scope="household_shared", source="family") == "familiar"
    assert mem.layer_of(memory_type="preference", visibility_scope="document_derived", source="document") == "documental"
    assert mem.layer_of(memory_type="operational_context", visibility_scope="owner_operational", source="family") == "operativa"
    assert mem.layer_of(memory_type="study_pattern", visibility_scope="household_shared", source="inference") == "inferencia"
    assert mem.layer_of(memory_type="preference", visibility_scope="temporary_session", source="family") == "temporal"


def test_inference_not_in_context_until_confirmed(env):
    from app.assistant import memory as mem
    db, hid, pA = env.con, env.hid, env.pA
    mid = mem.add_inference(db, household_id=hid, organization_id=None, person_id=pA,
                            memory_type="study_pattern", content="estudia mejor en sesiones cortas",
                            created_by_user_id="userA", confidence=0.7)
    db.commit()
    # Pending: NO entra al contexto de IA.
    ctx = mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    assert all("sesiones cortas" not in m["note"] for m in ctx)
    # Aparece en la lista de inferencias por confirmar.
    infs = mem.list_inferences(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    assert any(i["id"] == mid for i in infs)
    # Confirmar → ahora SÍ entra al contexto.
    assert mem.confirm_inference(db, hid, mid, requester_user_id="userA", requester_person_id=pA, requester_role="member") is True
    db.commit()
    ctx2 = mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    assert any("sesiones cortas" in m["note"] for m in ctx2)


def test_dismiss_inference_excluded(env):
    from app.assistant import memory as mem
    db, hid, pA = env.con, env.hid, env.pA
    mid = mem.add_inference(db, household_id=hid, organization_id=None, person_id=pA,
                            memory_type="preference", content="prefiere té",
                            created_by_user_id="userA")
    db.commit()
    assert mem.dismiss_inference(db, hid, mid, requester_user_id="userA", requester_person_id=pA, requester_role="member") is True
    db.commit()
    infs = mem.list_inferences(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    assert all(i["id"] != mid for i in infs)
    ctx = mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    assert all("prefiere té" not in m["note"] for m in ctx)


def test_supersede_retires_old(env):
    from app.assistant import memory as mem
    db, hid, pA = env.con, env.hid, env.pA
    old = mem.add_memory(db, household_id=hid, organization_id=None, person_id=pA,
                         memory_type="preference", content="le gusta el fútbol",
                         importance=0.6, created_by_user_id="userA", visibility_scope="household_shared")
    db.commit()
    new = mem.add_memory(db, household_id=hid, organization_id=None, person_id=pA,
                         memory_type="preference", content="ahora le gusta el básquet",
                         importance=0.6, created_by_user_id="userA", visibility_scope="household_shared",
                         supersedes=old)
    db.commit()
    ctx = mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    notes = " ".join(m["note"] for m in ctx)
    assert "básquet" in notes
    assert "fútbol" not in notes
    lib = mem.library_view(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    ids = [it["id"] for layer in lib["layers"] for it in layer["items"]]
    assert new in ids and old not in ids


def test_library_grouped_and_private_hidden(env):
    from app.assistant import memory as mem
    db, hid, pA, pB = env.con, env.hid, env.pA, env.pB
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=pA,
                   memory_type="family_story", content="paseo del domingo",
                   importance=0.5, created_by_user_id="userA", visibility_scope="household_shared")
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=pB,
                   memory_type="preference", content="secreto de Bruno",
                   importance=0.5, created_by_user_id="userB", visibility_scope="private_self")
    db.commit()
    lib = mem.library_view(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    by_layer = {l["key"]: l["items"] for l in lib["layers"]}
    assert any(it["content"] == "paseo del domingo" for it in by_layer["familiar"])
    all_contents = [it["content"] for layer in lib["layers"] for it in layer["items"]]
    assert "secreto de Bruno" not in all_contents


def test_export_respects_privacy(env):
    from app.assistant import memory as mem
    db, hid, pA, pB = env.con, env.hid, env.pA, env.pB
    mem.add_memory(db, household_id=hid, organization_id=None, person_id=pB,
                   memory_type="preference", content="privado de Bruno",
                   importance=0.5, created_by_user_id="userB", visibility_scope="private_self")
    db.commit()
    exp = mem.export_for_user(db, hid, requester_user_id="userA", requester_person_id=pA, requester_role="member")
    assert all(it["content"] != "privado de Bruno" for it in exp["items"])


def test_correct_content_and_permission(env):
    from app.assistant import memory as mem
    db, hid, pA, pB = env.con, env.hid, env.pA, env.pB
    mid = mem.add_memory(db, household_id=hid, organization_id=None, person_id=pB,
                         memory_type="preference", content="dato de Bruno",
                         importance=0.5, created_by_user_id="userB", visibility_scope="private_self")
    db.commit()
    # Ana (member) no puede corregir el privado de Bruno.
    assert mem.correct_memory(db, hid, mid, "corregido por Ana",
                              requester_user_id="userA", requester_person_id=pA, requester_role="member") is False
    # Bruno sí.
    assert mem.correct_memory(db, hid, mid, "dato corregido",
                              requester_user_id="userB", requester_person_id=pB, requester_role="member") is True
