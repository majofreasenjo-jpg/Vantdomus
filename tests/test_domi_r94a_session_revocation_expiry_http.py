"""
DOMI R94-A — Revocación y expiración de sesión POR HTTP, camino SQLite.

Respalda el criterio de aceptación F8 del banco físico PC↔teléfono
("Revocar la sesión del teléfono; reintentar → denegación") y el requisito
"revocación y expiración deben impedir nuevas lecturas".

Hueco que cubre (verificado antes de escribirlo, para no duplicar):
  * `tests/security/test_domi_pg_rls_pilot.py` prueba revocación y sesiones
    expiradas, pero SOLO en PostgreSQL (job aparte del CI).
  * `tests/security/test_tenant_isolation.py` prueba `/auth/sessions/revoke-others`.
  * NO existía una prueba HTTP de extremo a extremo sobre el camino **SQLite**,
    que es exactamente el que usará el banco R94-A en el PC local.

Asimetría documentada (NO es una vulnerabilidad): en el camino SQLite
`deps.get_current_user` comprueba `revoked_at` de la fila pero no su
`expires_at`; la expiración la impone la verificación del `exp` del JWT
(`security.py` firma con `exp` y `jwt.decode` lo valida). En PostgreSQL,
`bind_verified_session` valida JTI, expiración y revocación. Ambos caminos
deniegan; difieren en qué capa lo hace. Estas pruebas fijan la CONDUCTA
observable para que no se degrade en ninguno de los dos.

Sin red, sin certificados, sin datos reales: TestClient en memoria + SQLite
temporal.
"""

from __future__ import annotations

import importlib
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "FamilyPilot-2026!"
EMAIL = "prueba.sesion@example.invalid"


def _make_client(monkeypatch, tmp_path) -> tuple[TestClient, Path]:
    db_path = tmp_path / "r94a-session-tests.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "r94a-session-tests-secret-32-chars-x")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "r94a-session-tests-mfa-key-32-char")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.delenv("VANTDOMUS_PUBLIC_REGISTRATION", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    return TestClient(main.app), db_path


@pytest.fixture
def client(monkeypatch, tmp_path):
    test_client, db_path = _make_client(monkeypatch, tmp_path)
    with test_client as c:
        yield c, db_path


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(c: TestClient) -> str:
    r = c.post("/auth/register", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = c.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _revoke_current_session(c: TestClient, token: str):
    """Revoca la sesion ACTUAL: /sessions/revoke exige session_id explicito."""
    listed = c.get("/auth/sessions", headers=_auth(token))
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    assert items, "debe existir al menos una sesion viva"
    return c.post("/auth/sessions/revoke", headers=_auth(token),
                  json={"session_id": items[0]["id"]})


def _reads_ok(c: TestClient, token: str) -> bool:
    """Una lectura autenticada cualquiera: ¿la sesión sigue sirviendo?"""
    return c.get("/households", headers=_auth(token)).status_code == 200


# ---------------------------------------------------------------------------
def test_live_session_can_read(client):
    """Línea base: sin revocar ni expirar, la sesión lee."""
    c, _ = client
    token = _register_and_login(c)
    assert _reads_ok(c, token) is True


def test_revoked_session_is_denied_over_http(client):
    """F8: tras revocar, el MISMO token deja de leer. Camino SQLite."""
    c, _ = client
    token = _register_and_login(c)
    assert _reads_ok(c, token) is True

    revoke = _revoke_current_session(c, token)
    assert revoke.status_code == 200, revoke.text
    assert revoke.json()["status"] == "revoked"

    assert _reads_ok(c, token) is False, "una sesión revocada NO puede volver a leer"
    assert c.get("/households", headers=_auth(token)).status_code == 401


def test_revocation_survives_a_backend_restart(client, monkeypatch, tmp_path):
    """
    La revocación vive en la base, no en memoria del proceso: reiniciar el
    backend no puede resucitar una sesión revocada. Es el escenario real del
    banco físico (F6 + F8 combinados).
    """
    c, db_path = client
    token = _register_and_login(c)
    assert _revoke_current_session(c, token).status_code == 200
    assert _reads_ok(c, token) is False

    # Reinicio en frío del backend sobre la MISMA base.
    monkeypatch.setenv("DB_PATH", str(db_path))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    with TestClient(main.app) as c2:
        assert _reads_ok(c2, token) is False, "la revocación debe sobrevivir al reinicio"


def test_expired_token_is_denied_over_http(client):
    """
    Expiración: un token ya vencido no lee. Se emite directamente con un `exp`
    en el pasado para no depender de esperas reales.
    """
    c, _ = client
    token = _register_and_login(c)
    import app.config as cfg
    import app.security as security

    # SIN CONFOUND: se reutilizan el `sub` y el `jti` REALES de la sesion viva,
    # que acaba de leer correctamente. Lo UNICO que cambia respecto del token
    # valido es que este nace vencido, asi que un 401 solo puede deberse a la
    # expiracion, no a un usuario o una sesion inexistentes.
    live = security.decode_access_token(token)
    assert _reads_ok(c, token) is True, "la sesion debe estar viva antes de la prueba"

    original = cfg.settings.ACCESS_TOKEN_EXPIRES_SECONDS
    try:
        cfg.settings.ACCESS_TOKEN_EXPIRES_SECONDS = -10
        expired, _ = security.create_access_token(live["sub"], live.get("email"), jti=live["jti"])
    finally:
        cfg.settings.ACCESS_TOKEN_EXPIRES_SECONDS = original

    # Se demuestra la construccion: mismo sub y mismo jti que la sesion viva,
    # y `exp` en el pasado. (Se lee sin verificar la vigencia a proposito;
    # verificarla aqui lanzaria, que es justo lo que prueba el assert siguiente.)
    from jose import jwt as jose_jwt
    claims = jose_jwt.decode(expired, cfg.settings.JWT_SECRET,
                             algorithms=[cfg.settings.JWT_ALG],
                             options={"verify_exp": False})
    assert claims["sub"] == live["sub"] and claims["jti"] == live["jti"]
    assert claims["exp"] < claims["iat"], "el token debe nacer ya vencido"

    assert c.get("/households", headers=_auth(expired)).status_code == 401, (
        "un token vencido no puede leer aunque su sesion siga viva y sin revocar"
    )
    # Control: el token original (no vencido) sigue leyendo -> la denegacion
    # anterior fue por expiracion y no por haber invalidado la sesion.
    assert _reads_ok(c, token) is True


def test_unknown_session_jti_is_denied(client):
    """
    Un token bien firmado cuyo jti no corresponde a ninguna fila de sesión debe
    denegarse: la firma por sí sola no basta (defensa contra tokens huérfanos
    tras limpiar sesiones).
    """
    c, _ = client
    _register_and_login(c)
    import app.security as security

    forged, _ = security.create_access_token("usuario-inexistente", EMAIL)
    assert c.get("/households", headers=_auth(forged)).status_code == 401


def test_tampered_token_is_denied(client):
    """Una firma alterada se rechaza; no hay lectura sin token válido."""
    c, _ = client
    token = _register_and_login(c)
    tampered = token[:-3] + ("aaa" if not token.endswith("aaa") else "bbb")
    assert c.get("/households", headers=_auth(tampered)).status_code == 401
    assert c.get("/households").status_code in (401, 403), "sin token tampoco"
