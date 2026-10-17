"""Opt-in transaction-bound PostgreSQL RLS subject signing.

This code is only valid after successful server-side JWT authentication.
The signing secret is provisioned out-of-band and NEVER sent to the client
or granted to a PostgreSQL runtime role. Uses SET LOCAL: no identity survives
COMMIT/ROLLBACK or a pooled-connection reuse.
"""
from __future__ import annotations
import hashlib
import hmac
import os
import re
import secrets
import time


def bind_signed_rls_context(connection, user_id: str, token_jti: str) -> bool:
    """Verify DB session context in one transaction; fail closed by default."""
    secret = os.getenv("DOMI_RLS_CONTEXT_SECRET","")
    if (len(secret.encode("utf-8")) < 32
        or secret == os.getenv("JWT_SECRET", "CHANGE_ME_SUPER_SECRET")
        or secret == os.getenv("DOMI_AUTH_ATTESTATION_SECRET", "")):
        raise RuntimeError("RLS context signing key unavailable or reused")
    if (not re.fullmatch(r"[A-Za-z0-9_-]{1,128}",user_id or "")
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}",token_jti or "")):
        raise ValueError("Invalid verified identity")
    with connection.cursor() as cur:
        cur.execute("SELECT pg_catalog.pg_backend_pid(),pg_catalog.txid_current()")
        pid,txid=cur.fetchone()
        issued=str(int(time.time()))
        nonce=secrets.token_hex(16)
        payload=f"r33|{user_id}|{token_jti}|{issued}|{nonce}|{pid}|{txid}"
        mac=hmac.new(secret.encode("utf-8"),payload.encode("utf-8"),hashlib.sha256).hexdigest()
        # Fixed GUC keys and parameterized values. SET LOCAL confines the
        # attestation to this exact transaction, including on pooled servers.
        for key,value in (
            ("domi.r31_subject",user_id),("domi.r31_jti",token_jti),
            ("domi.r31_issued",issued),("domi.r31_nonce",nonce),
            ("domi.r31_mac",mac),
        ):
            cur.execute("SELECT pg_catalog.set_config(%s,%s,true)",(key,value))
        cur.execute("SELECT domi_r31.subject_id()")
        row=cur.fetchone()
        return bool(row and row[0] == user_id)
