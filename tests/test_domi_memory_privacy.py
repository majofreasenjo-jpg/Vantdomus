"""
OPS-2 M1 — Privacidad de memoria: recall filtra por QUIÉN pregunta.

Escenario: hogar con dos adultos (A, B), una menor (Mn) y A como guardián de Mn.
Verifica que private_self de A no la vea B, que guardian_supervised de Mn la vean
Mn y su guardián A pero no B, que owner_operational sea solo de administradores, y
que el borrado respete la autorización.
Ejecutar: python -m pytest tests/test_domi_memory_privacy.py -q
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
    monkeypatch.setenv("DB_PATH", str(tmp_path / "priv.db"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    import importlib
    import app.config as cfg
    importlib.reload(cfg)
    import app.db as dbmod
    importlib.reload(dbmod)
    dbmod.ensure_schema()
    con = dbmod.connect()
    hid = str(uuid.uuid4())
    con.execute("INSERT INTO households (id,name,meta,created_at) VALUES (?,?,?,?)",
                (hid, "Hogar", "{}", "2026-07-21T00:00:00Z"))
    ids = {}
    for key, name, uid in [("A", "Ana", "userA"), ("B", "Bruno", "userB"), ("Mn", "Mia", None)]:
        pid = str(uuid.uuid4())
        con.execute("INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                    (pid, hid, name, uid, "2026-07-21T00:00:00Z"))
        ids[key] = pid
    # A es guardián de Mn (relación activa).
    con.execute(
        "INSERT INTO guardian_relationships (id,household_id,minor_person_id,guardian_person_id,scope,created_by_user_id,created_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), hid, ids["Mn"], ids["A"], "full", "userA", "2026-07-21T00:00:00Z"),
    )
    con.commit()
    return SimpleNamespace(con=con, hid=hid, pid=ids)


def _add(mem, db, hid, pid, scope, content, created_by="userA", mtype="preference"):
    return mem.add_memory(db, household_id=hid, organization_id=None, person_id=pid,
                          memory_type=mtype, content=content, importance=0.8,
                          created_by_user_id=created_by, visibility_scope=scope)


def _notes(items):
    return {i["note"] for i in items}


def test_private_self_not_visible_to_other_adult(env):
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    _add(mem, db, hid, P["A"], "private_self", "secreto de Ana", created_by="userA")
    db.commit()
    seenByA = mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=P["A"], requester_role="member")
    seenByB = mem.recall_for_context(db, hid, requester_user_id="userB", requester_person_id=P["B"], requester_role="member")
    assert "secreto de Ana" in _notes(seenByA)
    assert "secreto de Ana" not in _notes(seenByB)


def test_household_shared_visible_to_all(env):
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    _add(mem, db, hid, None, "household_shared", "los domingos hay asado")
    db.commit()
    seenByB = mem.recall_for_context(db, hid, requester_user_id="userB", requester_person_id=P["B"], requester_role="member")
    assert "los domingos hay asado" in _notes(seenByB)


def test_guardian_supervised_seen_by_minor_and_guardian_not_other(env):
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    _add(mem, db, hid, P["Mn"], "guardian_supervised", "a Mia le cuesta concentrarse", mtype="study_pattern")
    db.commit()
    byGuardianA = mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=P["A"], requester_role="member")
    byMinor = mem.recall_for_context(db, hid, requester_user_id=None, requester_person_id=P["Mn"], requester_role="viewer")
    byOtherB = mem.recall_for_context(db, hid, requester_user_id="userB", requester_person_id=P["B"], requester_role="member")
    assert "a Mia le cuesta concentrarse" in _notes(byGuardianA)   # guardián
    assert "a Mia le cuesta concentrarse" in _notes(byMinor)       # el propio menor
    assert "a Mia le cuesta concentrarse" not in _notes(byOtherB)  # otro adulto NO


def test_owner_operational_only_admins(env):
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    _add(mem, db, hid, None, "owner_operational", "nota administrativa del hogar")
    db.commit()
    byOwner = mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=P["A"], requester_role="owner")
    byMember = mem.recall_for_context(db, hid, requester_user_id="userB", requester_person_id=P["B"], requester_role="member")
    assert "nota administrativa del hogar" in _notes(byOwner)
    assert "nota administrativa del hogar" not in _notes(byMember)


def test_delete_respects_authorization(env):
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    mid = _add(mem, db, hid, P["A"], "private_self", "privado de Ana", created_by="userA")
    db.commit()
    # B (otro adulto) NO puede borrar la privada de A.
    assert mem.delete_memory(db, hid, mid, requester_user_id="userB", requester_person_id=P["B"], requester_role="member") is False
    # A sí puede.
    assert mem.delete_memory(db, hid, mid, requester_user_id="userA", requester_person_id=P["A"], requester_role="member") is True
    # y tras el olvido, ya no entra al contexto de A.
    db.commit()
    assert "privado de Ana" not in _notes(
        mem.recall_for_context(db, hid, requester_user_id="userA", requester_person_id=P["A"], requester_role="member"))


def test_no_requester_only_household_scopes(env):
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    _add(mem, db, hid, P["A"], "private_self", "privadísimo")
    _add(mem, db, hid, None, "household_shared", "compartido")
    db.commit()
    # Fallback sin requester: solo scopes de hogar (nunca privadas).
    fallback = mem.recall_for_context(db, hid)
    assert "compartido" in _notes(fallback)
    assert "privadísimo" not in _notes(fallback)


def test_private_memory_creator_without_subject_rights_cannot_read_or_manage(env):
    """H4-01: creator is not automatically entitled to another person's private memory."""
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    mid = _add(mem, db, hid, P["B"], "private_self",
               "dato privado exclusivo de Bruno", created_by="userA")
    db.commit()
    creator = dict(requester_user_id="userA", requester_person_id=P["A"], requester_role="member")
    subject = dict(requester_user_id="userB", requester_person_id=P["B"], requester_role="member")
    assert "dato privado exclusivo de Bruno" not in _notes(mem.recall_for_context(db, hid, **creator))
    assert all(row["id"] != mid for row in mem.list_memories(db, hid, **creator))
    assert mem.correct_memory(db, hid, mid, "cambio no autorizado", **creator) is False
    assert mem.delete_memory(db, hid, mid, **creator) is False
    assert "dato privado exclusivo de Bruno" in _notes(mem.recall_for_context(db, hid, **subject))
    assert any(row["id"] == mid and row["content"] == "dato privado exclusivo de Bruno"
               for row in mem.list_memories(db, hid, **subject))


def test_household_admin_cannot_access_another_person_private_memory(env):
    """H4-02: household admin status alone confers no access to private_self."""
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    mid = _add(mem, db, hid, P["B"], "private_self",
               "nota privada de Bruno", created_by="userB")
    db.commit()
    admin = dict(requester_user_id="userA", requester_person_id=P["A"], requester_role="admin")
    subject = dict(requester_user_id="userB", requester_person_id=P["B"], requester_role="member")
    assert "nota privada de Bruno" not in _notes(mem.recall_for_context(db, hid, **admin))
    assert all(row["id"] != mid for row in mem.list_memories(db, hid, **admin))
    assert mem.correct_memory(db, hid, mid, "modificacion admin", **admin) is False
    assert mem.delete_memory(db, hid, mid, **admin) is False
    assert "nota privada de Bruno" in _notes(mem.recall_for_context(db, hid, **subject))
    assert any(row["id"] == mid and row["content"] == "nota privada de Bruno"
               for row in mem.list_memories(db, hid, **subject))


def test_private_memory_subject_can_read_correct_and_delete(env):
    """H4-03: subject can exercise own private memory rights end-to-end."""
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    mid = _add(mem, db, hid, P["B"], "private_self",
               "preferencia original de Bruno", created_by="userA")
    db.commit()
    subject = dict(requester_user_id="userB", requester_person_id=P["B"], requester_role="member")
    assert "preferencia original de Bruno" in _notes(mem.recall_for_context(db, hid, **subject))
    assert any(row["id"] == mid for row in mem.list_memories(db, hid, **subject))
    assert mem.correct_memory(db, hid, mid, "preferencia corregida de Bruno", **subject) is True
    db.commit()
    assert "preferencia corregida de Bruno" in _notes(mem.recall_for_context(db, hid, **subject))
    assert "preferencia original de Bruno" not in _notes(mem.recall_for_context(db, hid, **subject))
    assert mem.delete_memory(db, hid, mid, **subject) is True
    db.commit()
    assert all(row["id"] != mid for row in mem.list_memories(db, hid, **subject))
    assert "preferencia corregida de Bruno" not in _notes(mem.recall_for_context(db, hid, **subject))


def test_active_guardian_can_read_correct_and_delete_minors_private_memory(env):
    """H4-04: verified active guardianship grants access to minor's private record."""
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    mid = _add(mem, db, hid, P["Mn"], "private_self", "rutina de estudio de Mia")
    db.commit()
    guardian = dict(requester_user_id="userA", requester_person_id=P["A"], requester_role="member")
    assert "rutina de estudio de Mia" in _notes(mem.recall_for_context(db, hid, **guardian))
    assert any(row["id"] == mid for row in mem.list_memories(db, hid, **guardian))
    assert mem.correct_memory(db, hid, mid, "rutina corregida de Mia", **guardian) is True
    db.commit()
    assert "rutina corregida de Mia" in _notes(mem.recall_for_context(db, hid, **guardian))
    assert mem.delete_memory(db, hid, mid, **guardian) is True
    db.commit()
    assert all(row["id"] != mid for row in mem.list_memories(db, hid, **guardian))


def test_revoked_guardian_loses_private_access_and_management(env):
    """H4-05: revoked guardianship immediately withdraws read/write access."""
    from app.assistant import memory as mem
    db, hid, P = env.con, env.hid, env.pid
    mid = _add(mem, db, hid, P["Mn"], "private_self", "preferencia privada de Mia")
    db.commit()
    guardian = dict(requester_user_id="userA", requester_person_id=P["A"], requester_role="member")
    assert "preferencia privada de Mia" in _notes(mem.recall_for_context(db, hid, **guardian))
    db.execute(
        "UPDATE guardian_relationships SET revoked_at=? WHERE household_id=? AND minor_person_id=? AND guardian_person_id=?",
        ("2026-11-16T00:00:00Z", hid, P["Mn"], P["A"]),
    )
    db.commit()
    assert "preferencia privada de Mia" not in _notes(mem.recall_for_context(db, hid, **guardian))
    assert all(row["id"] != mid for row in mem.list_memories(db, hid, **guardian))
    assert mem.correct_memory(db, hid, mid, "cambio no autorizado", **guardian) is False
    assert mem.delete_memory(db, hid, mid, **guardian) is False
    assert db.execute("SELECT content, deleted_at FROM memory_items WHERE id=?", (mid,)).fetchone()["content"] == "preferencia privada de Mia"
    assert db.execute("SELECT deleted_at FROM memory_items WHERE id=?", (mid,)).fetchone()["deleted_at"] is None
