"""
OPS-2 M10 — Tests de MUSIC-0 (sin red).

Cubre: allowlist de dominios (acepta servicios musicales, rechaza dominios
arbitrarios / http / javascript:), detección de servicio, alta/lista por mood,
y borrado con permisos (quien agregó o admin).
Ejecutar: python -m pytest tests/test_family_music.py -q
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
    monkeypatch.setenv("DB_PATH", str(tmp_path / "music.db"))
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
                (hid, "Hogar", "{}", "2026-07-22T00:00:00Z"))
    con.commit()
    return SimpleNamespace(con=con, hid=hid)


def test_service_allowlist():
    from app.assistant import music
    assert music.service_for_url("https://open.spotify.com/playlist/abc") == "spotify"
    assert music.service_for_url("https://youtu.be/xyz") == "youtube"
    assert music.service_for_url("https://m.youtube.com/watch?v=1") == "youtube"
    assert music.service_for_url("https://music.apple.com/cl/album/x") == "apple"
    # Rechazos: dominio arbitrario, http plano, esquema raro, disfraz.
    assert music.service_for_url("https://evil.com/spotify") is None
    assert music.service_for_url("http://open.spotify.com/x") is None
    assert music.service_for_url("javascript:alert(1)") is None
    assert music.service_for_url("https://open.spotify.com.evil.com/x") is None


def test_add_and_list_by_mood(env):
    from app.assistant import music
    db, hid = env.con, env.hid
    r = music.add_link(db, household_id=hid, person_id=None, added_by_user_id="userA",
                       title="Lista para estudiar", url="https://open.spotify.com/playlist/estudio",
                       mood="estudio")
    assert r["service"] == "spotify"
    music.add_link(db, household_id=hid, person_id=None, added_by_user_id="userA",
                   title="Para dormir", url="https://youtu.be/zzz", mood="dormir")
    estudio = music.list_links(db, hid, "estudio")
    assert len(estudio) == 1 and estudio[0]["title"] == "Lista para estudiar"
    todos = music.list_links(db, hid)
    assert len(todos) == 2


def test_rejects_non_music_url(env):
    from app.assistant import music
    db, hid = env.con, env.hid
    with pytest.raises(ValueError):
        music.add_link(db, household_id=hid, person_id=None, added_by_user_id="userA",
                       title="Trampa", url="https://phishing.example.com/login")


def test_delete_permissions(env):
    from app.assistant import music
    db, hid = env.con, env.hid
    r = music.add_link(db, household_id=hid, person_id=None, added_by_user_id="userA",
                       title="Mía", url="https://open.spotify.com/track/1")
    # Otro member no puede borrarla…
    assert music.delete_link(db, hid, r["id"], requester_user_id="userB", requester_role="member") is False
    # …un admin sí.
    assert music.delete_link(db, hid, r["id"], requester_user_id="userB", requester_role="admin") is True
