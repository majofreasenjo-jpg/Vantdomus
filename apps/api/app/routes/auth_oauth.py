"""
U3 I3 — Login social (Google / Facebook), gateado por configuración.

DISEÑO HONESTO:
- Si NO hay credenciales del proveedor en variables de entorno, /start redirige
  de vuelta al login con un mensaje claro ("login social no está configurado").
  NO finge un inicio de sesión.
- Si SÍ hay credenciales, ejecuta el flujo OAuth real (authorization code):
  /start -> proveedor -> /callback -> intercambio de token -> email del usuario
  -> buscar/crear usuario -> emitir sesión -> handoff al frontend.

SEGURIDAD / LÍMITES:
- Los secretos viven SOLO en variables de entorno del proveedor, nunca en el
  repo ni en el chat. Ver docs/SOCIAL_LOGIN_SETUP.md.
- El intercambio de token y el handoff cross-dominio requieren credenciales
  reales y una prueba end-to-end antes de confiar en producción. Hasta entonces
  el camino seguro por defecto es "no configurado".
"""

import os
import uuid
import secrets as _secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from ..deps import get_db
from .auth import _issue_session, _normalize_email, now
from ..security import hash_password

router = APIRouter(prefix="/auth/oauth", tags=["Auth", "OAuth"])

# Base pública del frontend para el handoff (donde el proxy fija la cookie).
WEB_BASE = os.environ.get("VANTDOMUS_WEB_BASE", "http://localhost:3000")
# Base pública de la API para construir el redirect_uri del proveedor.
API_BASE = os.environ.get("VANTDOMUS_API_PUBLIC_BASE", "http://127.0.0.1:8001")

PROVIDERS = {
    "google": {
        "client_id_env": "GOOGLE_OAUTH_CLIENT_ID",
        "client_secret_env": "GOOGLE_OAUTH_CLIENT_SECRET",
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "userinfo": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
    },
    "facebook": {
        "client_id_env": "FACEBOOK_OAUTH_CLIENT_ID",
        "client_secret_env": "FACEBOOK_OAUTH_CLIENT_SECRET",
        "authorize": "https://www.facebook.com/v19.0/dialog/oauth",
        "token": "https://graph.facebook.com/v19.0/oauth/access_token",
        "userinfo": "https://graph.facebook.com/me?fields=email,name",
        "scope": "email public_profile",
    },
}


def _provider_creds(provider: str):
    cfg = PROVIDERS.get(provider)
    if not cfg:
        return None
    cid = os.environ.get(cfg["client_id_env"], "").strip()
    csec = os.environ.get(cfg["client_secret_env"], "").strip()
    if not cid or not csec:
        return None
    return {**cfg, "client_id": cid, "client_secret": csec}


def _redirect_uri(provider: str) -> str:
    return f"{API_BASE}/auth/oauth/{provider}/callback"


def _login_error(msg: str) -> RedirectResponse:
    return RedirectResponse(url=f"{WEB_BASE}/login?error={msg}", status_code=302)


@router.get("/{provider}/start")
def oauth_start(provider: str):
    creds = _provider_creds(provider)
    if not creds:
        # Camino seguro por defecto: honesto, no finge login.
        return _login_error("Login social aún no está configurado. Usá email y contraseña por ahora.")
    state = _secrets.token_urlsafe(24)
    params = {
        "client_id": creds["client_id"],
        "redirect_uri": _redirect_uri(provider),
        "response_type": "code",
        "scope": creds["scope"],
        "state": state,
    }
    resp = RedirectResponse(url=f"{creds['authorize']}?{urlencode(params)}", status_code=302)
    # State anti-CSRF en cookie httpOnly de corta vida.
    resp.set_cookie("vd_oauth_state", state, max_age=600, httponly=True, samesite="lax", path="/")
    return resp


@router.get("/{provider}/callback")
def oauth_callback(provider: str, request: Request, code: str = "", state: str = "", db=Depends(get_db)):
    creds = _provider_creds(provider)
    if not creds:
        return _login_error("Login social aún no está configurado.")
    cookie_state = request.cookies.get("vd_oauth_state", "")
    if not state or not cookie_state or state != cookie_state:
        return _login_error("No pudimos validar el inicio de sesión social. Intentá de nuevo.")
    if not code:
        return _login_error("Inicio de sesión social cancelado.")

    try:
        with httpx.Client(timeout=10.0) as client:
            tok = client.post(creds["token"], data={
                "code": code,
                "client_id": creds["client_id"],
                "client_secret": creds["client_secret"],
                "redirect_uri": _redirect_uri(provider),
                "grant_type": "authorization_code",
            }, headers={"Accept": "application/json"})
            tok.raise_for_status()
            access = tok.json().get("access_token")
            if not access:
                return _login_error("No pudimos completar el login social.")
            ui = client.get(creds["userinfo"], headers={"Authorization": f"Bearer {access}"})
            ui.raise_for_status()
            info = ui.json()
    except Exception:
        return _login_error("No pudimos conectar con el proveedor. Intentá de nuevo.")

    email = _normalize_email(info.get("email") or "")
    if not email:
        return _login_error("El proveedor no entregó un email. Probá con otro método.")

    # Buscar o crear el usuario por email.
    row = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if row:
        user_id = row["id"]
    else:
        user_id = str(uuid.uuid4())
        # Sin contraseña usable: cuenta sólo-social (hash de un secreto aleatorio).
        db.execute(
            "INSERT INTO users (id,email,password_hash,is_active,created_at) VALUES (?,?,?,?,?)",
            (user_id, email, hash_password(_secrets.token_urlsafe(32)), 1, now()),
        )

    token, expires_in, session_id = _issue_session(db, user_id, email)
    db.commit()

    # Handoff al frontend: el proxy del web fija la cookie de sesión.
    resp = RedirectResponse(
        url=f"{WEB_BASE}/auth/social-callback?token={token}&session={session_id}&expires_in={expires_in}",
        status_code=302,
    )
    resp.delete_cookie("vd_oauth_state", path="/")
    return resp
