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
