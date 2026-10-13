"""First-stage PostgreSQL authentication lookup; NOT a login endpoint.

Only the auth bootstrap SQL identity can invoke the restricted lookup function.
The runtime household SQL identity MUST be different and has no access.
Passwords are verified with the existing bcrypt scheme on the trusted server.
No JWT, session or MFA bypass is created by this component.
"""
from __future__ import annotations

import bcrypt

QUERY = "SELECT user_id, password_digest FROM domi_auth.lookup_password_credential(%s)"
# One synthetic unused hash, computed locally; never a user credential.
_FAKE_HASH = bcrypt.hashpw(b"unused-domi-credential-verification", bcrypt.gensalt())


def verify_password_only(auth_connection, email: str, password: str) -> str | None:
    """Verify a normalized candidate using a restricted authentication login.

    A returned user_id is only a password proof. Calling code must still
    enforce brute-force throttles, active MFA, session issuance and audit.
    """
    if not isinstance(email, str) or not isinstance(password, str):
        return None
    if not email.strip() or len(email) > 320 or not password:
        return None

    cursor = auth_connection.cursor()
    try:
        cursor.execute(QUERY, (email.strip().lower(),))
        row = cursor.fetchone()
    finally:
        cursor.close()

    user_id = row[0] if row else None
    digest = row[1] if row else _FAKE_HASH.decode("ascii")
    try:
        matches = bcrypt.checkpw(password.encode("utf-8"), digest.encode("utf-8"))
    except (ValueError, TypeError, UnicodeError):
        matches = False
    return user_id if user_id and matches else None



def get_mfa_state(auth_connection, user_id: str) -> tuple[str, bool] | None:
    """Read a protected MFA configuration via an auth-only function.

    The stored secret remains encrypted until the trusted server uses
    app.mfa.reveal_totp_secret and app.mfa.verify_totp after password proof.
    """
    if not user_id:
        return None
    cursor = auth_connection.cursor()
    try:
        cursor.execute("SELECT totp_secret,is_enabled FROM domi_auth.lookup_mfa_state(%s)", (user_id,))
        row = cursor.fetchone()
        return (row[0], bool(row[1])) if row else None
    finally:
        cursor.close()


def consume_recovery_code(auth_connection, user_id: str, code_hash: str) -> bool:
    """Atomically consume one hashed recovery code; caller checks MFA first."""
    if not user_id or not code_hash or len(code_hash) != 64:
        return False
    cursor = auth_connection.cursor()
    try:
        cursor.execute("SELECT domi_auth.consume_recovery_code(%s,%s)", (user_id,code_hash))
        result = cursor.fetchone()
        return bool(result and result[0])
    finally:
        cursor.close()


def recent_failed_logins(auth_connection, email: str, from_timestamp) -> int:
    cursor = auth_connection.cursor()
    try:
        cursor.execute("SELECT domi_auth.recent_failed_logins(%s,%s)",(email,from_timestamp))
        row=cursor.fetchone()
        return int(row[0]) if row else 0
    finally:
        cursor.close()


def record_login_attempt(auth_connection, email: str, successful: bool) -> None:
    cursor = auth_connection.cursor()
    try:
        cursor.execute("SELECT domi_auth.record_login_attempt(%s,%s)",(email,successful))
    finally:
        cursor.close()


def clear_failed_logins(auth_connection, email: str) -> None:
    cursor = auth_connection.cursor()
    try:
        cursor.execute("SELECT domi_auth.clear_failed_logins(%s)",(email,))
    finally:
        cursor.close()




def sign_session_attestation(
    user_id: str, session_id: str, token_jti: str, ttl_seconds: int,
    *, issued_epoch: int | None = None, nonce: str | None = None,
) -> tuple[int, str, str]:
    """Trusted-server HMAC attestation, minted only after bcrypt + MFA.

    The HMAC key is distinct from the JWT signing key and SQL login passwords;
    it is provisioned server-side and independently to the database definer
    role. This does NOT make a compromised application server trustworthy.
    """
    import hashlib
    import hmac
    import os
    import secrets
    import time

    secret = os.getenv("DOMI_AUTH_ATTESTATION_SECRET", "")
    if (len(secret.encode("utf-8")) < 32
            or secret == os.getenv("JWT_SECRET", "CHANGE_ME_SUPER_SECRET")):
        raise ValueError("Session attestation secret is missing or unsafe")
    if not isinstance(ttl_seconds, int) or not 60 <= ttl_seconds <= 86400:
        raise ValueError("Invalid attestation expiry")
    # User IDs must have an unambiguous canonical representation, identical
    # to the SQL verifier's allowlist. Signed delimiters are not user input.
    import re
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", user_id or ""):
        raise ValueError("Unsupported user ID for authorization")
    if not re.fullmatch(r"[0-9a-f-]{36}", session_id or ""):
        raise ValueError("Invalid session identifier")
    if not re.fullmatch(r"[0-9a-f-]{36}", token_jti or ""):
        raise ValueError("Invalid token JTI")
    issued = int(time.time()) if issued_epoch is None else issued_epoch
    one_time_nonce = secrets.token_hex(16) if nonce is None else nonce
    if not isinstance(issued, int) or not re.fullmatch(r"[0-9a-f]{32}", one_time_nonce or ""):
        raise ValueError("Invalid authorization timestamp or nonce")
    signed = f"{user_id}|{session_id}|{token_jti}|{ttl_seconds}|{issued}|{one_time_nonce}"
    digest = hmac.new(secret.encode("utf-8"), signed.encode("utf-8"), hashlib.sha256).hexdigest()
    return issued, one_time_nonce, digest

def prepare_session_proof(
    lookup_connection, user_id: str, session_id: str,
    token_jti: str, ttl_seconds: int
) -> str | None:
    """Prepare an HMAC-authorized proof. Bare SQL login cannot forge the HMAC."""
    issued, nonce, signature = sign_session_attestation(
        user_id, session_id, token_jti, ttl_seconds
    )
    with lookup_connection.cursor() as cursor:
        cursor.execute(
            "SELECT domi_auth.prepare_session_proof(%s,%s,%s,%s,%s,%s,%s)",
            (user_id, session_id, token_jti, ttl_seconds, issued, nonce, signature),
        )
        row = cursor.fetchone()
    return str(row[0]) if row and row[0] else None


def issue_session(
    issuer_connection, user_id: str, session_id: str,
    token_jti: str, ttl_seconds: int, proof_id: str
) -> bool:
    """Atomically consume a subject/session/JTI-bound authorization exactly once."""
    with issuer_connection.cursor() as cursor:
        cursor.execute(
            "SELECT domi_auth.issue_session_bound(%s,%s,%s,%s,%s)",
            (user_id, session_id, token_jti, ttl_seconds, proof_id),
        )
        row = cursor.fetchone()
    return bool(row and row[0])


def _rotate_mfa_secret(auth_connection, user_id: str, previous: str, replacement: str) -> bool:
    cursor = auth_connection.cursor()
    try:
        cursor.execute(
            "SELECT domi_auth.rotate_mfa_secret(%s,%s,%s)",
            (user_id,previous,replacement),
        )
        row = cursor.fetchone()
        return bool(row and row[0])
    finally:
        cursor.close()


def login_postgres(
    auth_connection,
    issuer_connection,
    email: str,
    password: str,
    mfa_code: str | None,
    *,
    max_attempts: int,
    window_seconds: int,
) -> dict:
    """Trusted server login: bcrypt, throttle, MFA, then atomic DB session.

    Enabled only through the restricted PostgreSQL authentication dependency.
    Registration/recovery/invite flows still require separate reviewed ports;
    do not promote staging until those flows and audit chains pass gates.
    """
    import hashlib
    import uuid
    from datetime import datetime, timedelta, timezone
    from fastapi import HTTPException, status
    from .mfa import (
        protect_totp_secret, reveal_totp_secret,
        should_reprotect_totp_secret, verify_totp,
    )
    from .security import create_access_token

    if max_attempts < 1 or not (60 <= window_seconds <= 86400):
        raise HTTPException(status_code=503, detail="Authentication limits not configured")
    email = (email or "").strip().lower()
    if not email or len(email) > 320 or not password or len(password) > 4096:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    start = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    if recent_failed_logins(auth_connection,email,start) >= max_attempts:
        raise HTTPException(status_code=429, detail="Too many failed login attempts")

    def deny(reason: str):
        record_login_attempt(issuer_connection,email,False)
        issuer_connection.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=reason)

    user_id = verify_password_only(auth_connection,email,password)
    if not user_id:
        deny("Invalid credentials")

    state = get_mfa_state(auth_connection,user_id)
    if state and state[1]:
        if not mfa_code:
            # Exactly like the existing SQLite route: password proof alone
            # does not generate a session when MFA is enabled.
            raise HTTPException(status_code=428, detail="MFA required")
        stored_secret = state[0]
        secret = reveal_totp_secret(stored_secret)
        verified_totp = verify_totp(secret,mfa_code)
        if verified_totp and should_reprotect_totp_secret(stored_secret):
            refreshed = protect_totp_secret(secret)
            if not _rotate_mfa_secret(issuer_connection,user_id,stored_secret,refreshed):
                issuer_connection.rollback()
                raise HTTPException(status_code=503, detail="MFA secret rotation failed")
        recovery_ok = False
        if not verified_totp:
            normalized = str(mfa_code).strip().upper().replace(" ","")
            recovery_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
            recovery_ok = consume_recovery_code(issuer_connection,user_id,recovery_hash)
        if not verified_totp and not recovery_ok:
            deny("Invalid MFA code")

    token_jti = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    token, expires_in = create_access_token(sub=user_id,email=email,jti=token_jti)
    try:
        proof_id = prepare_session_proof(
            auth_connection, user_id, session_id, token_jti, expires_in
        )
    except ValueError:
        auth_connection.rollback()
        issuer_connection.rollback()
        raise HTTPException(status_code=503, detail="Session attestation unavailable")
    if not proof_id:
        auth_connection.rollback()
        issuer_connection.rollback()
        raise HTTPException(status_code=503, detail="Session authorization unavailable")
    # The roles use separate PostgreSQL connections. Commit the lookup proof
    # before consuming it in the issuer transaction; NEVER promote a signed
    # JWT to the caller unless the bound session exists and commits.
    auth_connection.commit()
    if not issue_session(issuer_connection,user_id,session_id,token_jti,expires_in,proof_id):
        issuer_connection.rollback()
        raise HTTPException(status_code=503, detail="Session issuance unavailable")
    clear_failed_logins(issuer_connection,email)
    record_login_attempt(issuer_connection,email,True)
    issuer_connection.commit()
    return {
        "access_token": token, "token_type": "bearer",
        "expires_in": expires_in, "session_id": session_id,
    }
