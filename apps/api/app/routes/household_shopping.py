"""
U1-LOCAL — Compras del Hogar + Carro tentativo.

Lista familiar de productos por comprar con estados (needed|in_cart|purchased|
unavailable|cancelled). El "carro tentativo" es una vista derivada por
status=in_cart. **No** hay checkout, ni APIs externas, ni precios reales.
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

router = APIRouter(prefix="/household_shopping", tags=["HouseholdShopping"])

ALLOWED_CATEGORIES = {
    "grocery", "pharmacy", "cleaning", "personal_care",
    "pet", "baby", "hardware", "school", "other",
}
ALLOWED_STORE_TYPES = {
    "supermarket", "pharmacy", "convenience", "hardware", "online", "other",
}
ALLOWED_PRIORITIES = {"low", "normal", "high", "urgent"}
ALLOWED_STATUSES = {"needed", "in_cart", "purchased", "unavailable", "cancelled"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> dict:
    d = dict(row)
    try:
        d["metadata"] = json.loads(d.get("metadata") or "{}")
    except (TypeError, ValueError):
        d["metadata"] = {}
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


class ItemCreate(BaseModel):
    item_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: str = "other"
    priority: str = "normal"
    store_type: str = "other"
    preferred_store: Optional[str] = None
    estimated_price: Optional[float] = None
    currency: str = "CLP"
    external_url: Optional[str] = None
    assigned_to_person_id: Optional[str] = None
    notes: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class ItemPatch(BaseModel):
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    store_type: Optional[str] = None
    preferred_store: Optional[str] = None
    estimated_price: Optional[float] = None
    currency: Optional[str] = None
    external_url: Optional[str] = None
    assigned_to_person_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # acepta también transición vía PATCH


def _validate(category=None, priority=None, store_type=None, status=None):
    if category is not None and category not in ALLOWED_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Allowed: {sorted(ALLOWED_CATEGORIES)}")
    if priority is not None and priority not in ALLOWED_PRIORITIES:
        raise HTTPException(400, f"Invalid priority. Allowed: {sorted(ALLOWED_PRIORITIES)}")
    if store_type is not None and store_type not in ALLOWED_STORE_TYPES:
        raise HTTPException(400, f"Invalid store_type. Allowed: {sorted(ALLOWED_STORE_TYPES)}")
    if status is not None and status not in ALLOWED_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {sorted(ALLOWED_STATUSES)}")


@router.get("/{household_id}/summary")
def shopping_summary_endpoint(
    household_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    CP1c-FUNC-MIN-3.3a — Resumen CANÓNICO de Compras (única fuente de verdad).
    Home, Domi y módulo Compras deben mostrar estos números.
    Criterio: por_comprar = needed + in_cart · comprado = purchased · excluido = cancelled.
    """
    from ..shopping_contract import shopping_summary
    require_household_role(db, user["user_id"], household_id, "viewer")
    return shopping_summary(db, household_id)


@router.get("/{household_id}/items")
def list_items(
    household_id: str,
    status: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "viewer")
    if status:
        _validate(status=status)
        rows = db.execute(
            "SELECT * FROM household_shopping_items WHERE household_id=? AND status=? "
            "ORDER BY created_at DESC LIMIT 500",
            (household_id, status),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM household_shopping_items WHERE household_id=? "
            "ORDER BY (CASE status WHEN 'needed' THEN 0 WHEN 'in_cart' THEN 1 ELSE 2 END), "
            "created_at DESC LIMIT 500",
            (household_id,),
        ).fetchall()
    return {"items": [_row_to_dict(r) for r in rows]}


@router.post("/{household_id}/items")
def create_item(
    household_id: str,
    body: ItemCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    _validate(body.category, body.priority, body.store_type)
    org = get_household_organization_id(db, household_id)
    pid = _current_person_id(db, user["user_id"], household_id)
    now = _now()
    item_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO household_shopping_items ("
        "id, household_id, organization_id, requested_by_user_id, requested_by_person_id, "
        "assigned_to_person_id, item_name, quantity, unit, category, priority, "
        "store_type, preferred_store, estimated_price, currency, external_url, "
        "status, notes, metadata, created_at, updated_at"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            item_id, household_id, org, user["user_id"], pid,
            body.assigned_to_person_id, body.item_name, body.quantity, body.unit,
            body.category, body.priority, body.store_type, body.preferred_store,
            body.estimated_price, body.currency, body.external_url,
            "needed", body.notes, json.dumps(body.metadata or {}, ensure_ascii=False),
            now, now,
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM household_shopping_items WHERE id=?", (item_id,)).fetchone()
    return _row_to_dict(row)


@router.patch("/{household_id}/items/{item_id}")
def patch_item(
    household_id: str,
    item_id: str,
    body: ItemPatch,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_household_role(db, user["user_id"], household_id, "member")
    _validate(body.category, body.priority, body.store_type, body.status)
    row = db.execute(
        "SELECT id FROM household_shopping_items WHERE id=? AND household_id=?",
        (item_id, household_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Item not found")
    sets, params = [], []
    for k in ("item_name", "quantity", "unit", "category", "priority",
              "store_type", "preferred_store", "estimated_price", "currency",
              "external_url", "assigned_to_person_id", "notes", "status"):
        v = getattr(body, k)
        if v is not None:
            sets.append(f"{k}=?"); params.append(v)
    if not sets:
        raise HTTPException(400, "No fields to update")
    sets.append("updated_at=?"); params.append(_now()); params.append(item_id)
    db.execute(f"UPDATE household_shopping_items SET {', '.join(sets)} WHERE id=?", tuple(params))
    db.commit()
    r2 = db.execute("SELECT * FROM household_shopping_items WHERE id=?", (item_id,)).fetchone()
    return _row_to_dict(r2)


def _transition(item_id: str, household_id: str, user, db, new_status: str, audit_action: str, extra_sets: dict = None):
    require_household_role(db, user["user_id"], household_id, "member")
    extra = extra_sets or {}
    cols = ["status=?", "updated_at=?"]
    vals = [new_status, _now()]
    for k, v in extra.items():
        cols.append(f"{k}=?"); vals.append(v)
    vals.extend([item_id, household_id])
    cur = db.execute(
        f"UPDATE household_shopping_items SET {', '.join(cols)} WHERE id=? AND household_id=?",
        tuple(vals),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Item not found")
    write_audit_log(
        db, action=audit_action, resource_type="household_shopping_item",
        resource_id=item_id, household_id=household_id, user_id=user["user_id"],
        metadata={"new_status": new_status},
    )
    db.commit()
    return {"ok": True, "status": new_status}


@router.post("/{household_id}/items/{item_id}/mark-in-cart")
def mark_in_cart(household_id: str, item_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    return _transition(item_id, household_id, user, db, "in_cart", "shopping.in_cart")


@router.post("/{household_id}/items/{item_id}/mark-purchased")
def mark_purchased(household_id: str, item_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    return _transition(item_id, household_id, user, db, "purchased", "shopping.purchased",
                       {"purchased_at": _now(), "purchased_by_user_id": user["user_id"]})


@router.post("/{household_id}/items/{item_id}/cancel")
def cancel_item(household_id: str, item_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    return _transition(item_id, household_id, user, db, "cancelled", "shopping.cancelled")


@router.get("/{household_id}/cart")
def view_cart(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    """Carro tentativo: items in_cart agrupados por store_type, con total estimado.
    NO realiza compra real. Es solo organización."""
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute(
        "SELECT * FROM household_shopping_items WHERE household_id=? AND status='in_cart' "
        "ORDER BY store_type, created_at",
        (household_id,),
    ).fetchall()
    items = [_row_to_dict(r) for r in rows]
    groups: dict[str, list] = {}
    total = 0.0
    for it in items:
        groups.setdefault(it["store_type"], []).append(it)
        if it.get("estimated_price"):
            try:
                total += float(it["estimated_price"]) * (float(it.get("quantity") or 1) or 1)
            except (TypeError, ValueError):
                pass
    return {
        "groups": [{"store_type": k, "items": v} for k, v in groups.items()],
        "total_estimated": round(total, 2),
        "currency": items[0]["currency"] if items else "CLP",
        "disclaimer": "Por ahora, la compra se realiza fuera de VantDomus. Esta lista ayuda a organizar el hogar.",
    }
