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
