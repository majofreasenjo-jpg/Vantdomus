"""DOMI R106 affective-consent HTTP laboratory.

A separate, explicitly gated router. Never enabled in family-pilot, family-live,
staging or production. Bearer session is verified by get_current_user; no
client-supplied requester identity, role, guardian or person id is accepted.

This is a laboratory API only. Not attached to /assistant/chat or an AI model.
"""
from __future__ import annotations

import os
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from app.assistant import affective_memory_bridge as bridge
from app.deps import get_current_user, get_db, require_household_role

router = APIRouter(prefix="/assistant/affect-lab", tags=["Assistant Affect Lab"])


class _StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConfirmSourceBody(_StrictBody):
    household_id: str
    memory_id: str
    explicitly_confirmed: StrictBool


class RatifyAffectBody(_StrictBody):
    household_id: str
    memory_id: str
    context_key: str
    valence: float = Field(ge=-1, le=1, allow_inf_nan=False)
    activation: float = Field(ge=0, le=1, allow_inf_nan=False)
    relevance: float = Field(ge=0, le=1, allow_inf_nan=False)
    consent_for_affect: StrictBool


class RevokeAffectBody(_StrictBody):
    household_id: str
    link_id: str


def _lab_gate(db, household_id: str, user_id: str):
    # No path to production, even if a flag is accidentally set there.
    env = os.getenv("APP_ENV", "").strip().lower()
    enabled = os.getenv("DOMI_AFFECT_R106_HTTP_LAB_ENABLED", "").strip().lower()
    if env not in {"test", "local", "dev", "development"} or enabled not in {"1", "true"}:
        raise HTTPException(status_code=404, detail="Not found")
    # R107: the laboratory must never become a back door to Postgres/Neon.
    # The runtime PG role has no audited authority to ratify consent in SQL,
    # and can be connected even with APP_ENV=local. Only disposable SQLite.
    if not isinstance(db, sqlite3.Connection):
        raise HTTPException(status_code=404, detail="Not found")
    # Membership is checked independently of client-provided fields.
    require_household_role(db, user_id, household_id, "member")
    # No minors, unclassified persons, or multiple identity bindings.
    rows = db.execute(
        """SELECT p.id, p.age_band
           FROM persons p
           WHERE p.household_id=? AND p.user_id=? LIMIT 2""",
        (household_id, user_id),
    ).fetchall()
    if len(rows) != 1 or rows[0]["age_band"] != "adult":
        raise HTTPException(status_code=403, detail="Adult identity required")
    return rows[0]["id"]


def _failure(exc: Exception):
    if isinstance(exc, PermissionError):
        # Do not expose whether someone else's memory exists.
        raise HTTPException(status_code=404, detail="Record unavailable") from None
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=422, detail="Invalid affective consent input") from None
    raise exc


@router.post("/source/confirm")
def confirm_source(
    body: ConfirmSourceBody,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    _lab_gate(db, body.household_id, user["user_id"])
    try:
        ok = bridge.confirm_personal_memory_source(
            db, household_id=body.household_id, user_id=user["user_id"],
            memory_id=body.memory_id, explicitly_confirmed=body.explicitly_confirmed,
        )
    except (PermissionError, ValueError) as exc:
        _failure(exc)
    if not ok:
        raise HTTPException(status_code=404, detail="Record unavailable")
    db.commit()
    return {"ok": True, "status": "source_confirmed"}


@router.post("/ratify")
def ratify(
    body: RatifyAffectBody,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    _lab_gate(db, body.household_id, user["user_id"])
    try:
        link_id = bridge.ratify_affective_link(
            db, household_id=body.household_id, user_id=user["user_id"],
            memory_id=body.memory_id, context_key=body.context_key,
            valence=body.valence, activation=body.activation,
            relevance=body.relevance,
            consent_for_affect=body.consent_for_affect,
        )
    except (PermissionError, ValueError) as exc:
        _failure(exc)
    except Exception as exc:
        # A duplicate active consent is not a second confirmation.
        # Return an intentionally nonspecific result without source content.
        if type(exc).__name__ in {"IntegrityError", "UniqueViolation"}:
            raise HTTPException(status_code=409, detail="Existing active consent") from None
        raise
    db.commit()
    return {"ok": True, "id": link_id, "status": "active"}


@router.get("/own")
def list_own(
    household_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    _lab_gate(db, household_id, user["user_id"])
    try:
        items = bridge.list_personal_affective_links(
            db, household_id=household_id, user_id=user["user_id"],
        )
    except (PermissionError, ValueError) as exc:
        _failure(exc)
    return {"ok": True, "items": items}


@router.post("/revoke")
def revoke(
    body: RevokeAffectBody,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    _lab_gate(db, body.household_id, user["user_id"])
    try:
        ok = bridge.revoke_affective_link(
            db, household_id=body.household_id, user_id=user["user_id"],
            link_id=body.link_id,
        )
    except (PermissionError, ValueError) as exc:
        _failure(exc)
    if not ok:
        raise HTTPException(status_code=404, detail="Record unavailable")
    db.commit()
    return {"ok": True, "status": "revoked"}
