"""Per-request PostgreSQL authorization context for DOMI.

The API first verifies the signed JWT, then asks a restricted database helper to
check the live session (user id + JTI). It does not read the auth_sessions
table with the runtime login. Bound SQL claims last only inside a transaction.
Committing/rolling back requires re-activation before the next statement.

This is NOT a substitute for the RLS policies, safe SQL coding, or for bootstrap
procedures required by unauthenticated login / password reset / MFA.
"""
from __future__ import annotations


class PgSessionContext:
    _SQL = "SELECT domi_auth.activate_session(%s, %s)"

    def __init__(self, raw_connection):
        self._connection = raw_connection
        self._identity: tuple[str, str] | None = None
        self._active = False

    @property
    def authenticated(self) -> bool:
        return self._identity is not None

    def _activate(self, user_id: str, token_jti: str) -> bool:
        # Only parameterized values; the helper name is a fixed server contract.
        cursor = self._connection.cursor()
        try:
            cursor.execute(self._SQL, (user_id, token_jti))
            row = cursor.fetchone()
            return bool(row and row[0])
        finally:
            cursor.close()

    def bind_verified_claims(self, user_id: str, token_jti: str) -> bool:
        """Only call AFTER verifying the bearer JWT cryptographically."""
        self.clear()
        if not isinstance(user_id, str) or not user_id or not isinstance(token_jti, str) or not token_jti:
            return False
        if not self._activate(user_id, token_jti):
            return False
        self._identity = (user_id, token_jti)
        self._active = True
        return True

    def ensure_bound(self) -> None:
        """Re-check revocation after each COMMIT/ROLLBACK; deny on failure."""
        if self._identity is None or self._active:
            return
        user_id, token_jti = self._identity
        self._identity = None
        try:
            valid = self._activate(user_id, token_jti)
        except Exception:
            self._active = False
            raise
        if not valid:
            self._active = False
            raise PermissionError("PostgreSQL session expired or revoked")
        self._identity = (user_id, token_jti)
        self._active = True

    def after_transaction(self) -> None:
        self._active = False

    def clear(self) -> None:
        self._identity = None
        self._active = False
