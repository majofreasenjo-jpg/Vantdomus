"""
DOMI R94-A — Enrutamiento interno Next -> FastAPI bajo TrustedHost.

Contexto (verificado en código, no supuesto):
  * `apps/web/app/api/proxy/[...path]/route.ts` incluye "host" en
    HOP_BY_HOP_HEADERS, es decir ELIMINA el Host del navegador, y construye la
    URL upstream con `API_BASE` (= http://127.0.0.1:8001). Por tanto el salto
    interno llega a FastAPI con `Host: 127.0.0.1:8001`.
  * `apps/api/app/config.py` PROHÍBE loopback y wildcard en
    `VANTDOMUS_ALLOWED_HOSTS` para el perfil familiar, porque esa variable
    declara la superficie pública del navegador.

Consecuencia antes de R94-A: con perfil familiar, la API rechazaba su propio
salto de proxy con `400 Invalid host header`. Estos tests fijan ese
comportamiento y verifican la separación de responsabilidades.

NINGÚN test aquí abre sockets de red, instala certificados ni toca firewall.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

PUBLIC_HOST = "domi.lab.example.invalid"
# El navegador/cliente envía la autoridad completa con puerto...
LOOPBACK_AUTHORITY = "127.0.0.1:8001"
# ...pero TrustedHostMiddleware compara SOLO el hostname: descarta el puerto.
# Por eso el allowlist debe declararse SIN puerto (ver test dedicado abajo).
LOOPBACK_HOST = "127.0.0.1"


def _allowed_hosts_with(monkeypatch, *, public: str | None, api: str | None,
                        app_env: str = "test") -> list[str]:
    """Reevalúa `_allowed_hosts()` con el entorno indicado."""
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("APP_ENV", app_env)
    for name, value in (("VANTDOMUS_ALLOWED_HOSTS", public),
                        ("VANTDOMUS_API_ALLOWED_HOSTS", api)):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    import app.main as main
    importlib.reload(main)
    return main._allowed_hosts()


def _trusted_host_status(allowed: list[str], sent_host: str) -> int:
    """Status que TrustedHostMiddleware devuelve para un Host dado."""
    from starlette.applications import Starlette
    from starlette.middleware.trustedhost import TrustedHostMiddleware
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route
    from starlette.testclient import TestClient

    app = Starlette(routes=[Route("/health", lambda r: PlainTextResponse("ok"))])
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed)
    return TestClient(app, base_url=f"http://{sent_host}").get("/health").status_code


def test_public_allowlist_alone_rejects_the_internal_proxy_hop(monkeypatch):
    """Regresión del bloqueador: una sola variable no puede hacer los dos trabajos."""
    allowed = _allowed_hosts_with(monkeypatch, public=PUBLIC_HOST, api=None)
    assert allowed == [PUBLIC_HOST]
    # El navegador entra por el proxy TLS con el nombre público: pasa.
    assert _trusted_host_status(allowed, PUBLIC_HOST) == 200
    # El salto interno Next -> FastAPI llega con autoridad loopback: 400.
    assert _trusted_host_status(allowed, LOOPBACK_AUTHORITY) == 400


def test_api_scoped_allowlist_admits_only_the_internal_hop(monkeypatch):
    """Con la lista propia de la API, el salto interno pasa y el resto no."""
    allowed = _allowed_hosts_with(monkeypatch, public=PUBLIC_HOST, api=LOOPBACK_HOST)
    assert allowed == [LOOPBACK_HOST]
    assert _trusted_host_status(allowed, LOOPBACK_AUTHORITY) == 200
    # Un cliente de LAN que intente hablar directo con la API por nombre o IP
    # NO es admitido por el Host (la defensa real es el bind loopback).
    assert _trusted_host_status(allowed, "192.168.1.50:8001") == 400
    assert _trusted_host_status(allowed, PUBLIC_HOST) == 400


def test_allowlist_entries_must_not_carry_a_port(monkeypatch):
    """
    Gotcha operativo: TrustedHostMiddleware compara solo el hostname, por lo que
    una entrada con puerto NUNCA coincide y bloquea el salto interno. Este test
    fija la forma correcta de configurar la variable.
    """
    with_port = _allowed_hosts_with(monkeypatch, public=PUBLIC_HOST, api=LOOPBACK_AUTHORITY)
    assert with_port == [LOOPBACK_AUTHORITY]
    assert _trusted_host_status(with_port, LOOPBACK_AUTHORITY) == 400, (
        "una entrada con puerto no debe coincidir: documenta el error de configuración"
    )
    without_port = _allowed_hosts_with(monkeypatch, public=PUBLIC_HOST, api=LOOPBACK_HOST)
    assert _trusted_host_status(without_port, LOOPBACK_AUTHORITY) == 200


def test_api_scoped_allowlist_never_widens_the_public_surface(monkeypatch):
    """`VANTDOMUS_ALLOWED_HOSTS` y su validación familiar quedan intactas."""
    _allowed_hosts_with(monkeypatch, public=PUBLIC_HOST, api=LOOPBACK_HOST)
    import app.config as cfg
    importlib.reload(cfg)
    # Secreto fuerte para llegar al chequeo de hosts (no es el objeto del test).
    monkeypatch.setenv("JWT_SECRET", "x" * 48)
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEYS", "y" * 48)
    # La validación del perfil familiar sigue rechazando loopback en la
    # superficie pública, aunque la API acepte loopback internamente.
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "127.0.0.1")
    monkeypatch.setenv("VANTDOMUS_APP_PUBLIC_URL", "https://127.0.0.1")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://127.0.0.1")
    importlib.reload(cfg)
    with pytest.raises(RuntimeError, match="loopback"):
        cfg._require_family_closed_base("family-pilot")


def test_api_scoped_allowlist_refuses_wildcard(monkeypatch):
    """Fail-closed: esta lista existe para ser estrecha."""
    with pytest.raises(RuntimeError, match="wildcard"):
        _allowed_hosts_with(monkeypatch, public=PUBLIC_HOST, api="*")


def test_absent_api_variable_preserves_legacy_behaviour(monkeypatch):
    """Compatibilidad: sin la variable nueva, nada cambia."""
    assert _allowed_hosts_with(monkeypatch, public="a.example,b.example", api=None) == \
        ["a.example", "b.example"]
    # Sin ninguna configuración y entorno no productivo: comportamiento previo.
    assert _allowed_hosts_with(monkeypatch, public=None, api=None) == ["*"]
