import uuid
import os
import re
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role, require_verified_email_for_sensitive_action
from ..mfa import generate_totp_secret, otpauth_url, protect_totp_secret, reveal_totp_secret, should_reprotect_totp_secret, verify_totp
from ..notify import notifier
from ..security import hash_password, verify_password, create_access_token
from ..security_events import write_security_event

router = APIRouter(prefix="/auth", tags=["Auth"])

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class SessionRevoke(BaseModel):
    session_id: str


class LoginBody(BaseModel):
    """JSON body for /auth/login. Replaces the legacy query-string form."""
    email: str
    password: str
    mfa_code: str | None = None


class RegisterBody(BaseModel):
    """JSON body for /auth/register. Replaces the legacy query-string form."""
    email: str
    password: str


class EmailVerifyBody(BaseModel):
    """JSON body for /auth/email/verify. Tokens in URLs leak via logs."""
    token: str


class PasswordResetRequestBody(BaseModel):
    """JSON body for /auth/password/reset/request. Emails leak via URL logs."""
    email: str


def _resolve_credentials(
    body_email: str | None,
    body_password: str | None,
    body_mfa: str | None,
    query_email: str | None,
    query_password: str | None,
    query_mfa: str | None,
) -> tuple[str, str, str | None]:
    """
    Reconcile credentials provided in JSON body vs legacy query string.

    SECURITY: body takes precedence. Both forms are supported during the
    migration period (some older clients still pass credentials in the
    URL, which leaks them to access logs, proxies, and crash reporters).
    The query-string form should be removed once the API metrics show no
    clients still rely on it.
    """
    email = (body_email or query_email or "").strip()
    password = body_password or query_password or ""
    mfa = body_mfa if body_mfa is not None else query_mfa
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")
    return email, password, mfa

def now():
    return datetime.now(timezone.utc).isoformat()

def _normalize_email(email: str) -> str:
    return email.strip().lower()

# Common-password / weak-token blacklist. Not exhaustive — just the lowest-
# hanging fruit that any reasonable B2B policy should refuse outright.
# Extend as needed, or wire in a HIBP k-anonymity check for stronger coverage.
_COMMON_WEAK_PASSWORDS = frozenset(
    p.lower()
    for p in [
        "password", "passw0rd", "password1", "password123",
        "12345678", "123456789", "1234567890", "qwerty123",
        "qwertyuiop", "letmein", "welcome", "admin", "administrator",
        "iloveyou", "abc12345", "monkey12", "dragon12",
        "vantdomus", "demo1234", "demo12345", "vantunit",
        "changeme", "changeme123", "change_me", "test1234",
        "securepassword", "securepass1",
    ]
)


def _validate_registration(email: str, password: str) -> None:
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Invalid email")
    # SECURITY: B2B-grade default is 10 chars with mixed character classes.
    # The env override is still honoured (so on-prem or dev environments can
    # opt down) but the floor is now meaningful.
    min_length = max(10, int(os.getenv("VANTDOMUS_MIN_PASSWORD_LENGTH", "10")))
    if len(password or "") < min_length:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {min_length} characters",
        )

    # Complexity: at least 3 of {lowercase, uppercase, digit, symbol}.
    # Allows passphrase-style passwords (which are long enough to skip the
    # symbol class) while still rejecting "abcdefghij" / "1111111111".
    classes = sum(
        bool(re.search(pattern, password))
        for pattern in (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]")
    )
    if classes < 3 and len(password) < 16:
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must mix at least 3 of: lowercase, uppercase, digits, symbols "
                "(or be at least 16 characters long)."
            ),
        )

    lowered = password.lower()
    if lowered in _COMMON_WEAK_PASSWORDS:
        raise HTTPException(
            status_code=400,
            detail="Password is in a list of commonly-breached credentials.",
        )
    # Prevent obviously-related-to-account values (email-derived).
    local_part = email.split("@", 1)[0].lower() if "@" in email else email.lower()
    if local_part and local_part in lowered:
        raise HTTPException(
            status_code=400,
            detail="Password must not contain the local part of your email.",
        )

def _failed_login_limit() -> tuple[int, int]:
    max_attempts = int(os.getenv("VANTDOMUS_AUTH_MAX_FAILED_LOGIN_ATTEMPTS", "5"))
    window_seconds = int(os.getenv("VANTDOMUS_AUTH_FAILED_LOGIN_WINDOW_SECONDS", "900"))
    return max_attempts, window_seconds

def _recent_failed_login_count(db, email: str) -> int:
    max_attempts, window_seconds = _failed_login_limit()
    window_start = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
    row = db.execute(
        "SELECT COUNT(*) AS c FROM auth_login_attempts WHERE email=? AND success=0 AND created_at>=?",
        (email, window_start),
    ).fetchone()
    return int(row["c"] if row else 0)

def _record_login_attempt(db, email: str, success: bool) -> None:
    db.execute(
        "INSERT INTO auth_login_attempts (id, email, success, created_at) VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), email, 1 if success else 0, now()),
    )

def _clear_failed_login_attempts(db, email: str) -> None:
    db.execute("DELETE FROM auth_login_attempts WHERE email=? AND success=0", (email,))

def _recovery_code_count() -> int:
    return int(os.getenv("VANTDOMUS_MFA_RECOVERY_CODE_COUNT", "8"))

def _new_recovery_code() -> str:
    raw = secrets.token_hex(5).upper()
    return f"{raw[:5]}-{raw[5:]}"

def _hash_recovery_code(code: str) -> str:
    normalized = str(code or "").strip().upper().replace(" ", "")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def _email_fingerprint(email: str) -> str:
    return hashlib.sha256(_normalize_email(email).encode("utf-8")).hexdigest()

def _hash_token(token: str) -> str:
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()

def _raw_action_token() -> str:
    return secrets.token_urlsafe(32)

def _local_token_payload(raw_token: str) -> dict:
    env = os.getenv("APP_ENV", "local").strip().lower()
    return {"token": raw_token} if env not in {"production", "prod", "staging"} else {}

def _public_app_url() -> str:
    return os.getenv("VANTDOMUS_APP_PUBLIC_URL", "http://127.0.0.1:3000").rstrip("/")

def _send_transactional_email(db, *, user_id: str, to_email: str, subject: str, body: str, event_type: str) -> dict:
    result = notifier.send_email(to_email, subject, body)
    if result.get("ok"):
        write_security_event(
            db,
            event_type=event_type,
            severity="low",
            source="email_delivery",
            user_id=user_id,
            metadata={"email_fingerprint": _email_fingerprint(to_email), "provider": result.get("provider", "smtp")},
        )
    else:
        write_security_event(
            db,
            event_type=f"{event_type}_failed",
            severity="high",
            source="email_delivery",
            user_id=user_id,
            metadata={"email_fingerprint": _email_fingerprint(to_email), "provider": result.get("provider", "smtp"), "error": result.get("error", "unknown")},
        )
    return result

def _token_expiry(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()

def _issue_session(db, user_id: str, email: str) -> tuple[str, int, str]:
    session_id = str(uuid.uuid4())
    token_jti = str(uuid.uuid4())
    token, expires_in = create_access_token(sub=user_id, email=email, jti=token_jti)
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
    seen_at = now()
    db.execute(
        """
        INSERT INTO auth_sessions (id, user_id, token_jti, created_at, expires_at, revoked_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?)
        """,
        (session_id, user_id, token_jti, seen_at, expires_at, seen_at),
    )
    return token, expires_in, session_id

def _create_email_verification_token(db, user_id: str) -> str:
    raw_token = _raw_action_token()
    db.execute(
        """
        INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
        VALUES (?, ?, ?, ?, ?, NULL)
        """,
        (str(uuid.uuid4()), user_id, _hash_token(raw_token), now(), _token_expiry(48)),
    )
    return raw_token

def _create_password_reset_token(db, user_id: str) -> str:
    raw_token = _raw_action_token()
    db.execute(
        """
        INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
        VALUES (?, ?, ?, ?, ?, NULL)
        """,
        (str(uuid.uuid4()), user_id, _hash_token(raw_token), now(), _token_expiry(2)),
    )
    return raw_token

def _send_email_verification(db, *, user_id: str, email: str, raw_token: str) -> dict:
    verify_url = f"{_public_app_url()}/verify-email?token={raw_token}"
    body = (
        "Confirma tu email en VantDomus.\n\n"
        f"Abre este enlace para verificar tu cuenta:\n{verify_url}\n\n"
        "Si no solicitaste esta accion, ignora este mensaje."
    )
    return _send_transactional_email(
        db,
        user_id=user_id,
        to_email=email,
        subject="Verifica tu email en VantDomus",
        body=body,
        event_type="email_verification_delivery",
    )

def _send_password_reset(db, *, user_id: str, email: str, raw_token: str) -> dict:
    reset_url = f"{_public_app_url()}/reset-password?token={raw_token}"
    body = (
        "Recibimos una solicitud para restablecer tu contrasena de VantDomus.\n\n"
        f"Abre este enlace para continuar:\n{reset_url}\n\n"
        "Si no solicitaste este cambio, ignora este mensaje."
    )
    return _send_transactional_email(
        db,
        user_id=user_id,
        to_email=email,
        subject="Restablece tu contrasena de VantDomus",
        body=body,
        event_type="password_reset_delivery",
    )

def _generate_recovery_codes(db, user_id: str) -> list[str]:
    db.execute("DELETE FROM user_mfa_recovery_codes WHERE user_id=? AND used_at IS NULL", (user_id,))
    codes = [_new_recovery_code() for _ in range(_recovery_code_count())]
    ts = now()
    for code in codes:
        db.execute(
            """
            INSERT INTO user_mfa_recovery_codes (id, user_id, code_hash, created_at, used_at)
            VALUES (?, ?, ?, ?, NULL)
            """,
            (str(uuid.uuid4()), user_id, _hash_recovery_code(code), ts),
        )
    return codes

def _unused_recovery_code_count(db, user_id: str) -> int:
    row = db.execute(
        "SELECT COUNT(*) AS c FROM user_mfa_recovery_codes WHERE user_id=? AND used_at IS NULL",
        (user_id,),
    ).fetchone()
    return int(row["c"] if row else 0)

def _consume_recovery_code(db, user_id: str, code: str) -> bool:
    code_hash = _hash_recovery_code(code)
    row = db.execute(
        """
        SELECT id FROM user_mfa_recovery_codes
        WHERE user_id=? AND code_hash=? AND used_at IS NULL
        """,
        (user_id, code_hash),
    ).fetchone()
    if not row:
        return False
    db.execute("UPDATE user_mfa_recovery_codes SET used_at=? WHERE id=?", (now(), row["id"]))
    return True

def _verified_totp(db, user_id: str, stored_secret: str, code: str) -> bool:
    secret = reveal_totp_secret(stored_secret)
    verified = verify_totp(secret, code)
    if verified and should_reprotect_totp_secret(stored_secret):
        db.execute("UPDATE user_mfa SET totp_secret=? WHERE user_id=?", (protect_totp_secret(secret), user_id))
    return verified

@router.get("/config")
def auth_config():
    """
    CP1d-FAMILY-PILOT-1a — Config pública NO sensible para la UI (evita usar
    NEXT_PUBLIC_* para gating). Solo expone si el registro público está abierto.
    """
    from app.config import public_registration_enabled
    return {"public_registration": public_registration_enabled()}


@router.post("/register")
def register(
    body: RegisterBody | None = None,
    email: str | None = None,
    password: str | None = None,
    db=Depends(get_db),
):
    # CP1d-FAMILY-PILOT-1a — puerta cerrada: en piloto/producción el registro
    # público se RECHAZA en el ENDPOINT (no basta ocultarlo en la UI). El alta
    # de integrantes es por invitación privada del hogar (single-use, expira).
    from app.config import public_registration_enabled
    if not public_registration_enabled():
        raise HTTPException(
            status_code=403,
            detail="El registro público está deshabilitado. Pide una invitación al administrador de tu hogar.",
        )
    # Accept credentials from JSON body (preferred) or legacy query params
    # (deprecated; logs URLs and leaks the password).
    body_email = body.email if body else None
    body_password = body.password if body else None
    resolved_email, password, _ = _resolve_credentials(
        body_email, body_password, None, email, password, None,
    )
    email = _normalize_email(resolved_email)
    from app.rate_limit import enforce_action_limit
    enforce_action_limit("register", email)
    _validate_registration(email, password)
    row = db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone()
    if row:
        raise HTTPException(status_code=400, detail="Email exists")
    uid = str(uuid.uuid4())
    db.execute("INSERT INTO users (id,email,password_hash,is_active,created_at) VALUES (?,?,?,?,?)",
               (uid, email, hash_password(password), 1, now()))
    raw_token = _create_email_verification_token(db, uid)
    delivery = _send_email_verification(db, user_id=uid, email=email, raw_token=raw_token)
    write_security_event(
        db,
        event_type="email_verification_token_created",
        severity="low",
        source="auth",
        user_id=uid,
        metadata={"email_fingerprint": _email_fingerprint(email), "purpose": "registration"},
    )
    db.commit()
    return {"user_id": uid, "email_delivery": {"ok": bool(delivery.get("ok")), "provider": delivery.get("provider")}, **_local_token_payload(raw_token)}

@router.post("/login")
def login(
    body: LoginBody | None = None,
    email: str | None = None,
    password: str | None = None,
    mfa_code: str | None = None,
    db=Depends(get_db),
):
    # Accept credentials from JSON body (preferred) or legacy query params
    # (deprecated). See _resolve_credentials for rationale.
    body_email = body.email if body else None
    body_password = body.password if body else None
    body_mfa = body.mfa_code if body else None
    resolved_email, password, mfa_code = _resolve_credentials(
        body_email, body_password, body_mfa, email, password, mfa_code,
    )
    email = _normalize_email(resolved_email)
    from app.rate_limit import enforce_action_limit
    enforce_action_limit("login", email)
    max_attempts, _window_seconds = _failed_login_limit()
    if _recent_failed_login_count(db, email) >= max_attempts:
        write_security_event(
            db,
            event_type="auth_login_throttled",
            severity="high",
            source="auth",
            metadata={"email_fingerprint": _email_fingerprint(email), "max_attempts": max_attempts},
            commit=True,
        )
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many failed login attempts")

    row = db.execute("SELECT id, password_hash FROM users WHERE email=?", (email,)).fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        _record_login_attempt(db, email, False)
        failed_count = _recent_failed_login_count(db, email)
        write_security_event(
            db,
            event_type="auth_login_failed",
            severity="medium" if failed_count >= max_attempts else "low",
            source="auth",
            metadata={
                "email_fingerprint": _email_fingerprint(email),
                "reason": "invalid_credentials",
                "failed_count": failed_count,
                "max_attempts": max_attempts,
            },
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    mfa_row = db.execute("SELECT totp_secret, is_enabled FROM user_mfa WHERE user_id=?", (row["id"],)).fetchone()
    if mfa_row and int(mfa_row["is_enabled"] or 0) == 1:
        if not mfa_code:
            raise HTTPException(status_code=428, detail="MFA required")
        verified_totp = _verified_totp(db, row["id"], mfa_row["totp_secret"], mfa_code)
        verified_recovery = False if verified_totp else _consume_recovery_code(db, row["id"], mfa_code)
        if not verified_totp and not verified_recovery:
            _record_login_attempt(db, email, False)
            failed_count = _recent_failed_login_count(db, email)
            write_security_event(
                db,
                event_type="auth_login_failed",
                severity="medium" if failed_count >= max_attempts else "low",
                source="auth",
                user_id=row["id"],
                metadata={
                    "email_fingerprint": _email_fingerprint(email),
                    "reason": "invalid_mfa",
                    "failed_count": failed_count,
                    "max_attempts": max_attempts,
                },
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")
    _clear_failed_login_attempts(db, email)
    _record_login_attempt(db, email, True)
    token, exp, session_id = _issue_session(db, row["id"], email)
    db.commit()
    return {"access_token": token, "token_type": "bearer", "expires_in": exp, "session_id": session_id}


@router.get("/email/status")
def email_status(user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT email_verified_at FROM users WHERE id=?", (user["user_id"],)).fetchone()
    return {"is_verified": bool(row and row["email_verified_at"]), "email_verified_at": row["email_verified_at"] if row else None}


@router.post("/email/verification/request")
def request_email_verification(user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT email, email_verified_at FROM users WHERE id=?", (user["user_id"],)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if row["email_verified_at"]:
        return {"status": "already_verified"}
    raw_token = _create_email_verification_token(db, user["user_id"])
    delivery = _send_email_verification(db, user_id=user["user_id"], email=row["email"], raw_token=raw_token)
    write_security_event(
        db,
        event_type="email_verification_token_created",
        severity="low",
        source="auth",
        user_id=user["user_id"],
        metadata={"email_fingerprint": _email_fingerprint(row["email"]), "purpose": "request"},
    )
    db.commit()
    return {"status": "created", "email_delivery": {"ok": bool(delivery.get("ok")), "provider": delivery.get("provider")}, **_local_token_payload(raw_token)}


@router.post("/email/verify")
def verify_email(
    body: EmailVerifyBody | None = None,
    token: str | None = None,
    db=Depends(get_db),
):
    # Accept token from JSON body (preferred) or legacy query string
    # (deprecated; verification tokens in URLs leak via access logs).
    effective_token = (body.token if body else None) or token or ""
    if not effective_token:
        raise HTTPException(status_code=400, detail="token is required")
    token = effective_token
    token_hash = _hash_token(token)
    row = db.execute(
        """
        SELECT id, user_id, expires_at, used_at
        FROM email_verification_tokens
        WHERE token_hash=?
        """,
        (token_hash,),
    ).fetchone()
    if not row or row["used_at"]:
        raise HTTPException(status_code=404, detail="Verification token not found")
    if datetime.fromisoformat(row["expires_at"]) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Verification token expired")
    ts = now()
    db.execute("UPDATE email_verification_tokens SET used_at=? WHERE id=?", (ts, row["id"]))
    db.execute("UPDATE users SET email_verified_at=? WHERE id=?", (ts, row["user_id"]))
    write_security_event(
        db,
        event_type="email_verified",
        severity="medium",
        source="auth",
        user_id=row["user_id"],
        metadata={"verified_at": ts},
    )
    db.commit()
    return {"status": "verified", "verified_at": ts}


@router.post("/password/change")
def change_password(payload: PasswordChange, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT email, password_hash FROM users WHERE id=?", (user["user_id"],)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.current_password, row["password_hash"]):
        write_security_event(
            db,
            event_type="password_change_failed",
            severity="medium",
            source="auth",
            user_id=user["user_id"],
            metadata={"reason": "invalid_current_password", "email_fingerprint": _email_fingerprint(row["email"])},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid current password")
    _validate_registration(row["email"], payload.new_password)
    if verify_password(payload.new_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="New password must be different")

    ts = now()
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(payload.new_password), user["user_id"]))
    _clear_failed_login_attempts(db, row["email"])
    write_audit_log(
        db,
        action="change_password",
        resource_type="user",
        user_id=user["user_id"],
        resource_id=user["user_id"],
        metadata={"changed_at": ts},
    )
    write_security_event(
        db,
        event_type="password_changed",
        severity="high",
        source="auth",
        user_id=user["user_id"],
        metadata={"changed_at": ts, "email_fingerprint": _email_fingerprint(row["email"])},
    )
    db.commit()
    return {"status": "changed", "changed_at": ts}


@router.post("/password/reset/request")
def request_password_reset(
    body: PasswordResetRequestBody | None = None,
    email: str | None = None,
    db=Depends(get_db),
):
    # Accept email from JSON body (preferred) or legacy query string
    # (deprecated; email addresses in URLs leak via access logs).
    effective_email = (body.email if body else None) or email or ""
    if not effective_email:
        raise HTTPException(status_code=400, detail="email is required")
    email = effective_email
    normalized = _normalize_email(email)
    from app.rate_limit import enforce_action_limit
    enforce_action_limit("password_reset", normalized)
    row = db.execute("SELECT id FROM users WHERE email=?", (normalized,)).fetchone()
    response = {"status": "accepted"}
    if row:
        raw_token = _create_password_reset_token(db, row["id"])
        delivery = _send_password_reset(db, user_id=row["id"], email=normalized, raw_token=raw_token)
        write_security_event(
            db,
            event_type="password_reset_token_created",
            severity="medium",
            source="auth",
            user_id=row["id"],
            metadata={"email_fingerprint": _email_fingerprint(normalized)},
        )
        response["email_delivery"] = {"ok": bool(delivery.get("ok")), "provider": delivery.get("provider")}
        response.update(_local_token_payload(raw_token))
    else:
        write_security_event(
            db,
            event_type="password_reset_requested_unknown_email",
            severity="low",
            source="auth",
            metadata={"email_fingerprint": _email_fingerprint(normalized)},
        )
    db.commit()
    return response


@router.post("/password/reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm, db=Depends(get_db)):
    token_hash = _hash_token(payload.token)
    token_row = db.execute(
        """
        SELECT id, user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token_hash=?
        """,
        (token_hash,),
    ).fetchone()
    if not token_row or token_row["used_at"]:
        raise HTTPException(status_code=404, detail="Password reset token not found")
    if datetime.fromisoformat(token_row["expires_at"]) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Password reset token expired")
    user_row = db.execute("SELECT email, password_hash FROM users WHERE id=?", (token_row["user_id"],)).fetchone()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    _validate_registration(user_row["email"], payload.new_password)
    if verify_password(payload.new_password, user_row["password_hash"]):
        raise HTTPException(status_code=400, detail="New password must be different")
    ts = now()
    db.execute("UPDATE password_reset_tokens SET used_at=? WHERE id=?", (ts, token_row["id"]))
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(payload.new_password), token_row["user_id"]))
    db.execute("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL", (ts, token_row["user_id"]))
    _clear_failed_login_attempts(db, user_row["email"])
    write_audit_log(
        db,
        action="reset_password",
        resource_type="user",
        user_id=token_row["user_id"],
        resource_id=token_row["user_id"],
        metadata={"reset_at": ts},
    )
    write_security_event(
        db,
        event_type="password_reset_completed",
        severity="high",
        source="auth",
        user_id=token_row["user_id"],
        metadata={"reset_at": ts, "email_fingerprint": _email_fingerprint(user_row["email"])},
    )
    db.commit()
    return {"status": "reset", "reset_at": ts}


@router.get("/sessions")
def list_sessions(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.execute(
        """
        SELECT id, created_at, expires_at, revoked_at, token_jti, last_seen_at
        FROM auth_sessions
        WHERE user_id=?
        ORDER BY created_at DESC
        """,
        (user["user_id"],),
    ).fetchall()
    return {
        "items": [
            {
                "id": row["id"],
                "created_at": row["created_at"],
                "expires_at": row["expires_at"],
                "revoked_at": row["revoked_at"],
                "last_seen_at": row["last_seen_at"],
                "current": row["token_jti"] == user.get("jti"),
            }
            for row in rows
        ]
    }


@router.post("/logout")
def logout(user=Depends(get_current_user), db=Depends(get_db)):
    ts = now()
    db.execute("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND token_jti=?", (ts, user["user_id"], user["jti"]))
    write_security_event(
        db,
        event_type="session_revoked",
        severity="medium",
        source="auth_session",
        user_id=user["user_id"],
        metadata={"revoked_at": ts, "reason": "logout"},
    )
    db.commit()
    return {"status": "revoked", "revoked_at": ts}


@router.post("/sessions/revoke")
def revoke_session(payload: SessionRevoke, user=Depends(get_current_user), db=Depends(get_db)):
    target = db.execute(
        "SELECT id, token_jti, revoked_at FROM auth_sessions WHERE id=? AND user_id=?",
        (payload.session_id, user["user_id"]),
    ).fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")
    ts = target["revoked_at"] or now()
    db.execute("UPDATE auth_sessions SET revoked_at=? WHERE id=?", (ts, payload.session_id))
    write_security_event(
        db,
        event_type="session_revoked",
        severity="medium",
        source="auth_session",
        user_id=user["user_id"],
        metadata={"session_id": payload.session_id, "revoked_at": ts, "current": target["token_jti"] == user.get("jti")},
    )
    db.commit()
    return {"status": "revoked", "revoked_at": ts}


@router.post("/sessions/revoke-others")
def revoke_other_sessions(user=Depends(get_current_user), db=Depends(get_db)):
    ts = now()
    db.execute(
        "UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND token_jti<>? AND revoked_at IS NULL",
        (ts, user["user_id"], user["jti"]),
    )
    write_security_event(
        db,
        event_type="other_sessions_revoked",
        severity="high",
        source="auth_session",
        user_id=user["user_id"],
        metadata={"revoked_at": ts},
    )
    db.commit()
    return {"status": "revoked", "revoked_at": ts}


@router.post("/mfa/setup")
def setup_mfa(user=Depends(get_current_user), db=Depends(get_db)):
    secret = generate_totp_secret()
    ts = now()
    existing = db.execute("SELECT is_enabled FROM user_mfa WHERE user_id=?", (user["user_id"],)).fetchone()
    if existing and int(existing["is_enabled"] or 0) == 1:
        raise HTTPException(status_code=400, detail="MFA already enabled")
    db.execute(
        """
        INSERT INTO user_mfa (user_id, totp_secret, is_enabled, created_at, enabled_at, disabled_at)
        VALUES (?, ?, 0, ?, NULL, NULL)
        ON CONFLICT(user_id) DO UPDATE SET
          totp_secret=excluded.totp_secret,
          is_enabled=0,
          created_at=excluded.created_at,
          enabled_at=NULL,
          disabled_at=NULL
        """,
        (user["user_id"], protect_totp_secret(secret), ts),
    )
    db.commit()
    return {
        "secret": secret,
        "otpauth_url": otpauth_url(secret, user.get("email") or user["user_id"]),
        "status": "pending",
    }


@router.get("/mfa/status")
def mfa_status(user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute(
        "SELECT is_enabled, created_at, enabled_at, disabled_at FROM user_mfa WHERE user_id=?",
        (user["user_id"],),
    ).fetchone()
    if not row:
        return {"is_enabled": False, "is_configured": False}
    return {
        "is_enabled": bool(row["is_enabled"]),
        "is_configured": True,
        "created_at": row["created_at"],
        "enabled_at": row["enabled_at"],
        "disabled_at": row["disabled_at"],
        "recovery_codes_remaining": _unused_recovery_code_count(db, user["user_id"]),
    }


@router.post("/mfa/enable")
def enable_mfa(code: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT totp_secret FROM user_mfa WHERE user_id=?", (user["user_id"],)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="MFA setup not found")
    if not _verified_totp(db, user["user_id"], row["totp_secret"], code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")
    ts = now()
    db.execute(
        "UPDATE user_mfa SET is_enabled=1, enabled_at=?, disabled_at=NULL WHERE user_id=?",
        (ts, user["user_id"]),
    )
    recovery_codes = _generate_recovery_codes(db, user["user_id"])
    write_audit_log(
        db,
        action="enable_mfa",
        resource_type="user",
        user_id=user["user_id"],
        resource_id=user["user_id"],
        metadata={"enabled_at": ts},
    )
    write_security_event(
        db,
        event_type="mfa_enabled",
        severity="medium",
        source="mfa",
        user_id=user["user_id"],
        metadata={"enabled_at": ts, "recovery_code_count": len(recovery_codes)},
    )
    db.commit()
    return {"status": "enabled", "enabled_at": ts, "recovery_codes": recovery_codes}


@router.post("/mfa/recovery-codes/regenerate")
def regenerate_mfa_recovery_codes(code: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT totp_secret, is_enabled FROM user_mfa WHERE user_id=?", (user["user_id"],)).fetchone()
    if not row or int(row["is_enabled"] or 0) != 1:
        raise HTTPException(status_code=404, detail="MFA not enabled")
    if not _verified_totp(db, user["user_id"], row["totp_secret"], code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")
    recovery_codes = _generate_recovery_codes(db, user["user_id"])
    write_audit_log(
        db,
        action="regenerate_mfa_recovery_codes",
        resource_type="user",
        user_id=user["user_id"],
        resource_id=user["user_id"],
        metadata={"count": len(recovery_codes)},
    )
    write_security_event(
        db,
        event_type="mfa_recovery_codes_regenerated",
        severity="medium",
        source="mfa",
        user_id=user["user_id"],
        metadata={"recovery_code_count": len(recovery_codes)},
    )
    db.commit()
    return {"status": "regenerated", "recovery_codes": recovery_codes}


@router.post("/mfa/disable")
def disable_mfa(code: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT totp_secret, is_enabled FROM user_mfa WHERE user_id=?", (user["user_id"],)).fetchone()
    if not row or int(row["is_enabled"] or 0) != 1:
        raise HTTPException(status_code=404, detail="MFA not enabled")
    if not _verified_totp(db, user["user_id"], row["totp_secret"], code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")
    ts = now()
    db.execute("UPDATE user_mfa SET is_enabled=0, disabled_at=? WHERE user_id=?", (ts, user["user_id"]))
    db.execute("DELETE FROM user_mfa_recovery_codes WHERE user_id=? AND used_at IS NULL", (user["user_id"],))
    write_audit_log(
        db,
        action="disable_mfa",
        resource_type="user",
        user_id=user["user_id"],
        resource_id=user["user_id"],
        metadata={"disabled_at": ts},
    )
    write_security_event(
        db,
        event_type="mfa_disabled",
        severity="high",
        source="mfa",
        user_id=user["user_id"],
        metadata={"disabled_at": ts},
    )
    db.commit()
    return {"status": "disabled", "disabled_at": ts}


@router.post("/mfa/admin-reset")
def admin_reset_user_mfa(
    household_id: str,
    target_user_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "admin")
    require_verified_email_for_sensitive_action(db, user["user_id"])
    if target_user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Admins cannot self-reset MFA with this endpoint")

    target_membership = db.execute(
        "SELECT role FROM household_memberships WHERE household_id=? AND user_id=?",
        (household_id, target_user_id),
    ).fetchone()
    if not target_membership:
        raise HTTPException(status_code=404, detail="Target user is not a household member")

    ts = now()
    db.execute(
        """
        UPDATE user_mfa
        SET is_enabled=0, disabled_at=?
        WHERE user_id=?
        """,
        (ts, target_user_id),
    )
    db.execute("DELETE FROM user_mfa_recovery_codes WHERE user_id=? AND used_at IS NULL", (target_user_id,))
    write_audit_log(
        db,
        action="admin_reset_mfa",
        resource_type="user",
        household_id=household_id,
        user_id=user["user_id"],
        resource_id=target_user_id,
        metadata={"target_role": target_membership["role"], "reset_at": ts},
    )
    write_security_event(
        db,
        event_type="mfa_admin_reset",
        severity="high",
        source="mfa_admin",
        household_id=household_id,
        user_id=user["user_id"],
        metadata={"target_user_id": target_user_id, "target_role": target_membership["role"], "reset_at": ts},
    )
    db.commit()
    return {"status": "reset", "target_user_id": target_user_id, "reset_at": ts}
