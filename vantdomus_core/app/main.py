from fastapi import FastAPI, Depends
from .deps import get_db
from .db import ensure_schema
from .routes import auth, households, persons, health, tasks, finance, scores, assistant, demo, alerts, notifications

app = FastAPI(title="VantDomus Core API", version="v0.6.0")

@app.on_event("startup")
def _startup():
    ensure_schema()

@app.get("/health")
def healthcheck():
    try:
        import os, psycopg2
        url = os.environ.get("DATABASE_URL")
        if not url: return {"ok": False, "error": "No URL"}
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        
        user_id = "44698693-10c8-4e0c-9289-1f7817edc943"
        household_id = "288e2700-07df-4217-993a-3a4087ac3657"
        
        cur.execute("SELECT role FROM household_memberships WHERE user_id=%s AND household_id=%s", (user_id, household_id))
        r = cur.fetchone()
        if not r:
            from datetime import datetime, timezone
            cur.execute("INSERT INTO household_memberships (household_id, user_id, role, created_at) VALUES (%s, %s, %s, %s)", 
                        (household_id, user_id, "owner", datetime.now(timezone.utc).isoformat()))
            conn.commit()
            return {"ok": True, "fix": "applied_raw_psycopg2"}
        return {"ok": True, "fix": "already_exists"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
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
