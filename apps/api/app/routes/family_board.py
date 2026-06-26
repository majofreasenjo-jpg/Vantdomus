"""
U1-LOCAL — Avisos del Hogar (Family Board).

Muro familiar para avisos, mensajes, alertas y recordatorios. Visibilidad por
roles/personas; pinned y resolved para gestión rápida. Auditado.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..audit import write_audit_log
from ..deps import get_current_user, get_db, require_household_role
from ..tenancy import get_household_organization_id

router = APIRouter(prefix="/family_board", tags=["FamilyBoard"])

ALLOWED_TYPES = {
    "notice", "alert", "reminder", "message", "emergency_note",
    "logistics", "shopping", "health", "school", "finance", "document",
}
ALLOWED_PRIORITIES = {"low", "normal", "high", "urgent"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _loads(v):
    if not v:
        return None
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return None


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["pinned"] = bool(d.get("pinned"))
    d["visible_to_roles"] = _loads(d.get("visible_to_roles"))
    d["visible_to_person_ids"] = _loads(d.get("visible_to_person_ids"))
    d["metadata"] = _loads(d.get("metadata")) or {}
    return d


def _current_person_id(db, user_id: str, household_id: str) -> Optional[str]:
    try:
        r = db.execute(
            "SELECT id FROM persons WHERE household_id=? AND user_id=?",
            (household_id, user_id),
        ).fetchone()
        return r["id"] if r else None
    except Exception:
        return None


class PostCreate(BaseModel):
    title: str
    body: Optional[str] = None
    post_type: str = "notice"
    priority: str = "normal"
    pinned: bool = False
    visible_to_roles: Optional[list[str]] = None
    visible_to_person_ids: Optional[list[str]] = None
    expires_at: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class PostPatch(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    post_type: Optional[str] = None
    priority: Optional[str] = None
    pinned: Optional[bool] = None
    visible_to_roles: Optional[list[str]] = None
    visible_to_person_ids: Optional[list[str]] = None
    expires_at: Optional[str] = None


def _validate(create: bool, post_type: Optional[str], priority: Optional[str]):
    if post_type is not None and post_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Invalid post_type. Allowed: {sorted(ALLOWED_TYPES)}")
    if priority is not None and priority not in ALLOWED_PRIORITIES:
        raise HTTPException(400, f"Invalid priority. Allowed: {sorted(ALLOWED_PRIORITIES)}")


@router.get("/{household_id}")
def list_posts(
    household_id: str,
    include_archived: bool = False,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    role = require_household_role(db, user["user_id"], household_id, "viewer")
    where = "household_id=?"
    params: list = [household_id]
    if not include_archived:
        where += " AND archived_at IS NULL"
    rows = db.execute(
        f"SELECT * FROM family_board_posts WHERE {where} "
        "ORDER BY pinned DESC, created_at DESC LIMIT 300",
        tuple(params),
    ).fetchall()
    items = [_row_to_dict(r) for r in rows]
    if role not in ("owner", "admin"):
        my_pid = _current_person_id(db, user["user_id"], household_id)
        out = []
        for p in items:
            ptos = p.get("visible_to_person_ids") or []
            roles = p.get("visible_to_roles") or []
            if ptos and (my_pid not in ptos):
                continue
            if roles and (role not in roles):
                continue
            out.append(p)
        items = out
    return {"items": items}


@router.post("/{household_id}")
def create_post(
    household_id: str,
    body: PostCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    _validate(True, body.post_type, body.priority)
    org = get_household_organization_id(db, household_id)
    pid = _current_person_id(db, user["user_id"], household_id)
    now = _now()
    post_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO family_board_posts ("
        "id, household_id, organization_id, author_user_id, author_person_id, "
        "post_type, title, body, priority, pinned, "
        "visible_to_roles, visible_to_person_ids, expires_at, metadata, created_at, updated_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            post_id, household_id, org, user["user_id"], pid,
            body.post_type, body.title, body.body, body.priority,
            1 if body.pinned else 0,
            json.dumps(body.visible_to_roles) if body.visible_to_roles is not None else None,
            json.dumps(body.visible_to_person_ids) if body.visible_to_person_ids is not None else None,
            body.expires_at, json.dumps(body.metadata or {}, ensure_ascii=False),
            now, now,
        ),
    )
    write_audit_log(
        db, action="family_board.create", resource_type="family_board_post",
        resource_id=post_id, household_id=household_id, user_id=user["user_id"],
        metadata={"post_type": body.post_type, "priority": body.priority},
    )
    db.commit()
    row = db.execute("SELECT * FROM family_board_posts WHERE id=?", (post_id,)).fetchone()
    return _row_to_dict(row)


@router.patch("/{household_id}/{post_id}")
def patch_post(
    household_id: str,
    post_id: str,
    body: PostPatch,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    _validate(False, body.post_type, body.priority)
    row = db.execute(
        "SELECT * FROM family_board_posts WHERE id=? AND household_id=?",
        (post_id, household_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Post not found")
    sets, params = [], []
    for k in ("title", "body", "post_type", "priority", "expires_at"):
        v = getattr(body, k)
        if v is not None:
            sets.append(f"{k}=?"); params.append(v)
    if body.pinned is not None:
        sets.append("pinned=?"); params.append(1 if body.pinned else 0)
    if body.visible_to_roles is not None:
        sets.append("visible_to_roles=?"); params.append(json.dumps(body.visible_to_roles))
    if body.visible_to_person_ids is not None:
        sets.append("visible_to_person_ids=?"); params.append(json.dumps(body.visible_to_person_ids))
    if not sets:
        raise HTTPException(400, "No fields to update")
    sets.append("updated_at=?"); params.append(_now()); params.append(post_id)
    db.execute(f"UPDATE family_board_posts SET {', '.join(sets)} WHERE id=?", tuple(params))
    db.commit()
    row = db.execute("SELECT * FROM family_board_posts WHERE id=?", (post_id,)).fetchone()
    return _row_to_dict(row)


@router.post("/{household_id}/{post_id}/resolve")
def resolve_post(household_id: str, post_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    db.execute(
        "UPDATE family_board_posts SET resolved_at=?, resolved_by_user_id=?, updated_at=? "
        "WHERE id=? AND household_id=?",
        (_now(), user["user_id"], _now(), post_id, household_id),
    )
    db.commit()
    return {"ok": True, "status": "resolved"}


@router.post("/{household_id}/{post_id}/archive")
def archive_post(household_id: str, post_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "admin")
    db.execute(
        "UPDATE family_board_posts SET archived_at=?, updated_at=? WHERE id=? AND household_id=?",
        (_now(), _now(), post_id, household_id),
    )
    db.commit()
    return {"ok": True, "status": "archived"}


# ---------------------------------------------------------------------------
# Comentarios por aviso (U2-UX B2): hilo simple para coordinar sin WhatsApp.
# ---------------------------------------------------------------------------
class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=600)
    reaction: Optional[str] = None


def _person_for_user(db, household_id: str, user_id: str) -> Optional[str]:
    try:
        r = db.execute("SELECT id FROM persons WHERE household_id=? AND user_id=?", (household_id, user_id)).fetchone()
        return r["id"] if r else None
    except Exception:
        return None


@router.get("/{household_id}/{post_id}/comments")
def list_comments(household_id: str, post_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute(
        "SELECT c.id, c.body, c.reaction, c.created_at, c.author_person_id, p.display_name "
        "FROM family_post_comments c LEFT JOIN persons p ON p.id=c.author_person_id "
        "WHERE c.household_id=? AND c.post_id=? ORDER BY c.created_at ASC",
        (household_id, post_id),
    ).fetchall()
    return {"items": [
        {"id": r["id"], "body": r["body"], "reaction": r["reaction"], "created_at": r["created_at"],
         "author_person_id": r["author_person_id"], "author_name": r["display_name"]}
        for r in rows
    ]}


@router.post("/{household_id}/{post_id}/comments")
def add_comment(household_id: str, post_id: str, body: CommentCreate, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "member")
    post = db.execute("SELECT id FROM family_board_posts WHERE id=? AND household_id=?", (post_id, household_id)).fetchone()
    if not post:
        raise HTTPException(status_code=404, detail="Aviso no encontrado")
    cid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO family_post_comments (id, household_id, post_id, author_user_id, author_person_id, body, reaction, created_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (cid, household_id, post_id, user["user_id"], _person_for_user(db, household_id, user["user_id"]),
         body.body.strip(), (body.reaction or None), _now()),
    )
    write_audit_log(db, action="family_board.comment", resource_type="family_post_comment",
                    resource_id=cid, household_id=household_id, user_id=user["user_id"], metadata={"post_id": post_id})
    db.commit()
    return {"ok": True, "id": cid}
