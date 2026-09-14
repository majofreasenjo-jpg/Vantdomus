import os
import socket
import time
from collections import defaultdict, deque
from threading import Lock
from urllib.parse import urlparse

from fastapi import Request
from fastapi.responses import JSONResponse

from .db import connect
from .security import decode_access_token
from .security_events import write_security_event


_buckets: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()

# Memory rate-limit hardening:
# - the keyspace is (method, path, identity) which grows without bound
#   when distinct IPs / user IDs / unusual paths hit the API; left
#   unchecked, a long-running pod leaks memory.
# - we cap total buckets at MAX_MEMORY_BUCKETS and run a sweep that drops
#   buckets whose newest entry is older than the rate-limit window. The
#   sweep runs at most once every MEMORY_GC_INTERVAL_SECONDS, regardless
#   of request volume.
_MAX_MEMORY_BUCKETS = int(os.getenv("VANTDOMUS_API_RATE_LIMIT_MAX_BUCKETS", "50000"))
_MEMORY_GC_INTERVAL_SECONDS = float(
    os.getenv("VANTDOMUS_API_RATE_LIMIT_GC_INTERVAL_SECONDS", "60")
)
_last_gc_at: float = 0.0


def _gc_memory_buckets(now: float, window: int) -> None:
    """Drop expired buckets and (if still over cap) the oldest keys.

    Caller must already hold `_lock`.
    """
    global _last_gc_at
    if now - _last_gc_at < _MEMORY_GC_INTERVAL_SECONDS:
        return
    _last_gc_at = now

    # 1. Drop buckets whose newest sample is older than the active window —
    #    they can never be relevant for current rate decisions.
    expired_keys = [
        key
        for key, bucket in _buckets.items()
        if not bucket or now - bucket[-1] >= window
    ]
    for key in expired_keys:
        del _buckets[key]

    # 2. Hard cap. If we're still over MAX_MEMORY_BUCKETS, evict the
    #    keys with the oldest newest-entry. This makes the keyspace
    #    bounded even against a fast attacker probing distinct paths.
    if len(_buckets) > _MAX_MEMORY_BUCKETS:
        overflow = len(_buckets) - _MAX_MEMORY_BUCKETS
        # itemgetter-free sort: key by most-recent timestamp ascending.
        oldest_first = sorted(
            _buckets.items(),
            key=lambda kv: kv[1][-1] if kv[1] else 0.0,
        )
        for key, _bucket in oldest_first[:overflow]:
            del _buckets[key]


def _enabled() -> bool:
    return os.getenv("VANTDOMUS_API_RATE_LIMIT_MODE", "memory").strip().lower() != "off"


def _mode() -> str:
    return os.getenv("VANTDOMUS_API_RATE_LIMIT_MODE", "memory").strip().lower()


def _max_requests() -> int:
    return int(os.getenv("VANTDOMUS_API_RATE_LIMIT_REQUESTS", "600"))


def _window_seconds() -> int:
    return int(os.getenv("VANTDOMUS_API_RATE_LIMIT_WINDOW_SECONDS", "60"))


def _exempt_paths() -> set[str]:
    raw = os.getenv("VANTDOMUS_API_RATE_LIMIT_EXEMPT_PATHS", "/health")
    return {item.strip() for item in raw.split(",") if item.strip()}


def _redis_url() -> str:
    return os.getenv("VANTDOMUS_REDIS_URL", "redis://127.0.0.1:6379/0")


def _redis_timeout_seconds() -> float:
    return float(os.getenv("VANTDOMUS_REDIS_TIMEOUT_SECONDS", "2"))


def _request_identity(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        try:
            payload = decode_access_token(token)
            if payload.get("sub"):
                return f"user:{payload['sub']}"
        except Exception:
            pass
    host = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return f"ip:{forwarded or host}"


def _write_rate_limit_event(request: Request, identity: str, retry_after: int) -> None:
    try:
        user_id = identity.split(":", 1)[1] if identity.startswith("user:") else None
        db = connect()
        try:
            write_security_event(
                db,
                event_type="rate_limit_exceeded",
                severity="medium",
                source="api_rate_limit",
                user_id=user_id,
                metadata={
                    "identity": identity,
                    "method": request.method,
                    "path": request.url.path,
                    "retry_after": retry_after,
                },
                commit=True,
            )
        finally:
            db.close()
    except Exception:
        pass


def _redis_command(*parts: str | int) -> int | str | None:
    parsed = urlparse(_redis_url())
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 6379
    db = parsed.path.strip("/") or "0"
    password = parsed.password
    commands: list[tuple[str | int, ...]] = []
    if password:
        commands.append(("AUTH", password))
    if db != "0":
        commands.append(("SELECT", db))
    commands.append(parts)
    response = None
    sock = socket.create_connection((host, port), timeout=_redis_timeout_seconds())
    try:
        sock.settimeout(_redis_timeout_seconds())
        for command in commands:
            payload = f"*{len(command)}\r\n".encode("utf-8")
            for part in command:
                encoded = str(part).encode("utf-8")
                payload += b"$" + str(len(encoded)).encode("ascii") + b"\r\n" + encoded + b"\r\n"
            sock.sendall(payload)
            response = _read_redis_response(sock)
    finally:
        sock.close()
    return response


def _read_redis_response(sock) -> int | str | None:
    prefix = _recv_exact(sock, 1)
    line = _recv_line(sock)
    if prefix == b"+":
        return line.decode("utf-8", errors="replace")
    if prefix == b":":
        return int(line)
    if prefix == b"$":
        length = int(line)
        if length < 0:
            return None
        data = _recv_exact(sock, length)
        _recv_exact(sock, 2)
        return data.decode("utf-8", errors="replace")
    if prefix == b"-":
        raise RuntimeError(line.decode("utf-8", errors="replace"))
    raise RuntimeError("Unexpected Redis response")


def _recv_exact(sock, size: int) -> bytes:
    chunks = b""
    while len(chunks) < size:
        chunk = sock.recv(size - len(chunks))
        if not chunk:
            raise RuntimeError("Redis connection closed")
        chunks += chunk
    return chunks


def _recv_line(sock) -> bytes:
    data = b""
    while not data.endswith(b"\r\n"):
        chunk = sock.recv(1)
        if not chunk:
            raise RuntimeError("Redis connection closed")
        data += chunk
    return data[:-2]


def _check_redis_rate_limit(key: str, limit: int, window: int) -> tuple[bool, int, int]:
    redis_key = f"vantdomus:rate-limit:{key}"
    count = int(_redis_command("INCR", redis_key) or 0)
    if count == 1:
        _redis_command("EXPIRE", redis_key, window)
    ttl = int(_redis_command("TTL", redis_key) or window)
    retry_after = ttl if ttl > 0 else window
    remaining = max(0, limit - count)
    return count <= limit, remaining, retry_after


def check_redis_health() -> dict:
    if _mode() != "redis":
        return {"ok": True, "status": "not_required", "mode": _mode()}
    try:
        response = _redis_command("PING")
    except Exception as exc:
        return {"ok": False, "status": "unavailable", "detail": str(exc), "mode": "redis"}
    ok = str(response).upper() == "PONG"
    return {
        "ok": ok,
        "status": "ok" if ok else "unexpected_response",
        "detail": str(response),
        "mode": "redis",
    }


def _check_memory_rate_limit(key: str, limit: int, window: int) -> tuple[bool, int, int]:
    now = time.monotonic()
    with _lock:
        _gc_memory_buckets(now, window)
        bucket = _buckets[key]
        while bucket and now - bucket[0] >= window:
            bucket.popleft()
        remaining = limit - len(bucket)
        if remaining <= 0:
            retry_after = max(1, int(window - (now - bucket[0]))) if bucket else window
            return False, 0, retry_after
        bucket.append(now)
        return True, max(0, remaining - 1), window


def check_rate_limit(request: Request):
    if not _enabled() or request.url.path in _exempt_paths():
        return None

    limit = max(1, _max_requests())
    window = max(1, _window_seconds())
    identity = _request_identity(request)
    key = f"{request.method}:{request.url.path}:{identity}"

    if _mode() == "redis":
        allowed, remaining, retry_after = _check_redis_rate_limit(key, limit, window)
    else:
        allowed, remaining, retry_after = _check_memory_rate_limit(key, limit, window)

    if not allowed:
        _write_rate_limit_event(request, identity, retry_after)
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests"},
            headers={"Retry-After": str(retry_after), "X-RateLimit-Remaining": "0"},
        )
    return {"X-RateLimit-Remaining": str(remaining)}


# =============================================================================
# CP1d-FAMILY-PILOT-1a — Rate limits POR ACCION (login, registro, invitaciones,
# reset, backup). Complementan el limite global: ventanas mas estrictas para
# endpoints sensibles, con clave propia (email/usuario), independiente de IP.
# =============================================================================

def _action_limits() -> dict:
    """Limites por accion: (max_requests, window_seconds). Ajustables por env."""
    def _pair(name: str, default_max: int, default_window: int) -> tuple[int, int]:
        return (
            int(os.getenv(f"VANTDOMUS_RL_{name}_MAX", str(default_max))),
            int(os.getenv(f"VANTDOMUS_RL_{name}_WINDOW", str(default_window))),
        )
    return {
        "register": _pair("REGISTER", 5, 3600),          # 5/hora por email
        "login": _pair("LOGIN", 10, 300),                # 10 cada 5 min por email
        "password_reset": _pair("RESET", 3, 3600),       # 3/hora por email
        "invitation_create": _pair("INV_CREATE", 10, 3600),   # 10/hora por usuario
        "invitation_accept": _pair("INV_ACCEPT", 10, 3600),   # 10/hora por usuario
        "invitation_register": _pair("INV_REGISTER", 10, 3600),  # 10/hora por IP y por token-fp
        "verification_resend": _pair("VERIFY_RESEND", 3, 3600),  # 3/hora por usuario
        "backup": _pair("BACKUP", 3, 3600),              # 3/hora por usuario
    }


def enforce_action_limit(action: str, key: str) -> None:
    """
    Aplica el limite de la accion sobre la clave dada (email o user_id).
    Lanza HTTPException 429 si se supera. Usa la misma memoria compartida
    (con GC) del limitador global. No registra la clave en claro en eventos.
    """
    from fastapi import HTTPException  # import local para no ciclar

    if not _enabled():
        return
    limits = _action_limits()
    if action not in limits:
        return
    max_req, window = limits[action]
    bucket_key = f"action:{action}:{(key or 'anon').strip().lower()}"
    allowed, _remaining, retry_after = _check_memory_rate_limit(bucket_key, max_req, window)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espera unos minutos e intenta de nuevo.",
            headers={"Retry-After": str(retry_after)},
        )
