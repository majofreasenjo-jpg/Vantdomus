from fastapi import FastAPI
from .db import ensure_schema
from .routes import auth, households, persons, health, tasks, finance, scores, assistant, demo, alerts, notifications

app = FastAPI(title="VantDomus Core API", version="v0.6.0")

@app.on_event("startup")
def _startup():
    ensure_schema()

@app.get("/health")
def healthcheck():
    return {"ok": True}

app.include_router(auth.router)
app.include_router(households.router)
app.include_router(persons.router)
app.include_router(health.router)
app.include_router(tasks.router)
app.include_router(finance.router)
app.include_router(scores.router)
app.include_router(assistant.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(demo.router)
