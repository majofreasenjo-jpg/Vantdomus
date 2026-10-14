"""Owner Beta private memory HTTP contract — opt-in, PostgreSQL-only, fail closed.

R38 introduces a narrow, synthetic-tested HTTP path from a JWT-verified user
to a signed, unprivileged PostgreSQL RLS context. It is OFF by default and
explicitly prohibited in production until the full 57-table rollout, audit,
account lifecycle and device acceptance gates have been certified.

Do not expose general SQL or allow client-provided consent, scope, owner,
household, organization or sensitivity fields.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field

from ..config import settings
from ..db import PostgresConnectionWrapper
from ..deps import get_current_user, get_db

router = APIRouter(prefix="/owner-beta/memory", tags=["Owner Beta Memory"])


class PrivateMemoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    person_id: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1, max_length=1200)


def _require_owner_memory_enabled(db, user: dict) -> str:
    # Three independent opt-ins; never permit production through this
    # experimental route, even when an operator sets the flags by mistake.
    if (
        settings.APP_ENV.strip().lower() in {"production", "prod"}
        or os.getenv("APP_ENV", "").strip().lower() in {"production", "prod"}
        or os.getenv("DOMI_ENABLE_OWNER_PG_MEMORY", "") != "1"
        or os.getenv("DOMI_ENABLE_SIGNED_RLS_RUNTIME", "") != "1"
        or os.getenv("DOMI_ENABLE_PG_AUTH_LOGIN", "") != "1"
        or not isinstance(db, PostgresConnectionWrapper)
        or not getattr(db._auth_context, "_signed_rls", False)
    ):
        raise HTTPException(status_code=503, detail="Private Owner memory unavailable")
    identity = getattr(db._auth_context, "_identity", None)
    subject = user.get("user_id")
    if (
        not isinstance(subject, str) or not subject
        or not db._auth_context.authenticated
        or not identity or identity[0] != subject
        or identity[1] != user.get("jti")
    ):
        raise HTTPException(status_code=401, detail="Verified session required")
    return subject


@router.get("/private")
def list_private_memories(
    response: Response,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = _require_owner_memory_enabled(db, user)
    # Every row is additionally subject to FORCE RLS with verified JTI.
    rows = db.execute(
        "SELECT id,content,created_at FROM public.memory_items "
        "WHERE created_by_user_id=? AND visibility_scope='private_self' "
        "AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 30",
        (user_id,),
    ).fetchall()
    response.headers["Cache-Control"] = "no-store"
    return {
        "items": [
            {"id":row["id"], "content":row["content"], "created_at":row["created_at"]}
            for row in rows
        ]
    }


@router.post("/private", status_code=201)
def add_private_memory(
    body: PrivateMemoryCreate,
    response: Response,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = _require_owner_memory_enabled(db, user)
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Empty memory not allowed")
    # The client may choose a person_id, never a household/owner/consent.
    # This server-side lookup and FORCE RLS independently enforce ownership.
    person = db.execute(
        "SELECT id,household_id,organization_id FROM public.persons "
        "WHERE id=? AND user_id=?",
        (body.person_id, user_id),
    ).fetchone()
    if not person:
        raise HTTPException(status_code=404, detail="Person not available")

    memory_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    consent = json.dumps(
        {"visible_to":["self"],"shareable_with_doctor":False},
        separators=(",",":"),
    )
    # All authority/consent fields are server controlled. Column GRANT and RLS
    # independently enforce that private data cannot be reclassified.
    db.execute(
        "INSERT INTO public.memory_items "
        "(id,person_id,household_id,organization_id,memory_type,content,"
        "importance,consent_scope,visibility_scope,created_by_user_id,created_at,updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            memory_id,person["id"],person["household_id"],person["organization_id"],
            "preference",content,0.5,consent,"private_self",user_id,
            timestamp,timestamp,
        ),
    )
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return {"id":memory_id, "created_at":timestamp}
