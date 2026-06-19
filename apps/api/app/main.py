from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from .config import validate_runtime_security
from .db import ensure_schema
from .db import connect
from .rate_limit import check_rate_limit
from .tenancy import backfill_tenant_columns
from .routes import (
    alerts,
    assistant,
    audit,
    audio,
    auth,
    ceo,
    coupling,
    demo,
    finance,
    forensics,
    gerencia,
    health,
    households,
    logbook,
    notifications,
    organizations,
    persons,
    scores,
    smart_inbox,
    tasks,
    unit_functions,
    unit_function_responsibles,
    vantguide_library,
    vision,
)


def initialize_app_state():
    validate_runtime_security()
    ensure_schema()
    db = connect()
    try:
        backfill_tenant_columns(db)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_app_state()
    yield


app = FastAPI(title="VantDomus Core API", version="v0.7.0", lifespan=lifespan)

def _production_like_env() -> bool:
    return os.getenv("APP_ENV", "local").strip().lower() in {"production", "prod", "staging"}


def _allowed_hosts() -> list[str]:
    configured = [host.strip() for host in os.getenv("VANTDOMUS_ALLOWED_HOSTS", "").split(",") if host.strip()]
    if configured:
        return configured
    return ["*"] if not _production_like_env() else []


if _allowed_hosts():
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts())

def _public_uploads_enabled() -> bool:
    if _production_like_env():
        return False
    configured = os.getenv("VANTDOMUS_ENABLE_PUBLIC_UPLOADS", "").strip().lower()
    return configured in {"1", "true", "yes"}


if _public_uploads_enabled():
    os.makedirs("uploads", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.middleware("http")
async def api_rate_limit(request, call_next):
    rate_limit_result = check_rate_limit(request)
    if hasattr(rate_limit_result, "status_code"):
        return rate_limit_result
    response = await call_next(request)
    if isinstance(rate_limit_result, dict):
        for key, value in rate_limit_result.items():
            response.headers.setdefault(key, value)
    return response


@app.get("/health")
def healthcheck():
    return {"ok": True, "service": "vantdomus-core", "version": app.version}


app.include_router(auth.router)
app.include_router(households.router)
app.include_router(persons.router)
app.include_router(health.router)
app.include_router(tasks.router)
app.include_router(finance.router)
app.include_router(scores.router)
app.include_router(assistant.router)
app.include_router(audit.router)
app.include_router(audio.router, prefix="/audio", tags=["audio"])
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(organizations.router)
app.include_router(demo.router)
app.include_router(gerencia.router)
app.include_router(ceo.router)
app.include_router(forensics.router, prefix="/forensics", tags=["forensics"])
app.include_router(logbook.router, prefix="/logbook", tags=["logbook"])
app.include_router(vision.router, prefix="/vision", tags=["vision"])
app.include_router(coupling.router, prefix="/coupling", tags=["coupling"])
app.include_router(unit_functions.router)
app.include_router(unit_function_responsibles.router)
app.include_router(vantguide_library.evidence_router)
app.include_router(vantguide_library.memory_router)
app.include_router(vantguide_library.profile_router)
app.include_router(smart_inbox.router)
