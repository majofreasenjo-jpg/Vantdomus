"""Verified JWT -> PostgreSQL runtime RLS authorization, per transaction.

The R36 signed mode is explicitly opt-in, requires an unprivileged SQL LOGIN
and the domi_app_runtime NOLOGIN role. It activates the R33 HMAC context only
after a cryptographically validated JWT is supplied by the API dependency.

No SQL claim survives a COMMIT, ROLLBACK or a change of authenticated user.
Legacy PostgreSQL mode stays untouched until the real staging rollout is
independently approved. This module does NOT enable Neon production access.
"""
from __future__ import annotations

from .pg_rls_context import bind_signed_rls_context


class PgSessionContext:
    _SQL = "SELECT domi_auth.activate_session(%s, %s)"

    def __init__(self, raw_connection, *, signed_rls: bool = False):
        self._connection = raw_connection
        self._signed_rls = bool(signed_rls)
        self._identity: tuple[str, str] | None = None
        self._active = False

    @property
    def authenticated(self) -> bool:
        return self._identity is not None and self._active

    def _activate_signed(self, user_id: str, token_jti: str) -> bool:
        # A PostgreSQL role that owns tables or bypasses RLS can never prove
        # effective cross-household isolation, regardless of the HMAC.
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT session_user,rolsuper,rolbypassrls,rolcreaterole,"
                "rolcreatedb,rolinherit,rolcanlogin "
                "FROM pg_catalog.pg_roles WHERE rolname=session_user"
            )
            row = cursor.fetchone()
            if (not row or not row[0] or row[0] in (
                "postgres", "neondb_owner", "domi_app_runtime"
            ) or any(row[1:6]) or not row[6]):
                raise PermissionError("Unsafe PostgreSQL runtime login role")

            # Requires explicit membership; no privileged fallback. SET LOCAL
            # role and signed session attributes last only in this transaction.
            cursor.execute("SET LOCAL ROLE domi_app_runtime")
            cursor.execute(
                "SELECT current_user,rolsuper,rolbypassrls,rolcreaterole,"
                "rolcreatedb,rolinherit,rolcanlogin "
                "FROM pg_catalog.pg_roles WHERE rolname=current_user"
            )
            runtime = cursor.fetchone()
            if (not runtime or runtime[0] != "domi_app_runtime"
                    or any(runtime[1:6]) or runtime[6]):
                raise PermissionError("Unsafe PostgreSQL runtime effective role")

        return bind_signed_rls_context(self._connection, user_id, token_jti)

    def _activate(self, user_id: str, token_jti: str) -> bool:
        if self._signed_rls:
            return self._activate_signed(user_id, token_jti)
        cursor = self._connection.cursor()
        try:
            cursor.execute(self._SQL, (user_id, token_jti))
            row = cursor.fetchone()
            return bool(row and row[0])
        finally:
            cursor.close()

    def bind_verified_claims(self, user_id: str, token_jti: str) -> bool:
        """Caller MUST first validate JWT cryptography and expiry."""
        previously_bound = self._identity is not None or self._active
        self.clear()
        if previously_bound:
            self._connection.rollback()
        if (not isinstance(user_id, str) or not user_id
                or not isinstance(token_jti, str) or not token_jti):
            return False
        try:
            if not self._activate(user_id, token_jti):
                # Do not leave failed attestations or SET LOCAL role alive.
                self._connection.rollback()
                return False
        except Exception:
            self._connection.rollback()
            self.clear()
            raise
        self._identity = (user_id, token_jti)
        self._active = True
        return True

    def ensure_bound(self) -> None:
        """Revalidate after every COMMIT/ROLLBACK; fail on revoked sessions."""
        if self._identity is None or self._active:
            return
        user_id, token_jti = self._identity
        self._identity = None
        try:
            if not self._activate(user_id, token_jti):
                self._connection.rollback()
                raise PermissionError("PostgreSQL session expired or revoked")
        except Exception:
            self._connection.rollback()
            self._active = False
            self.clear()
            raise
        self._identity = (user_id, token_jti)
        self._active = True

    def after_transaction(self) -> None:
        self._active = False

    def clear(self) -> None:
        self._identity = None
        self._active = False
