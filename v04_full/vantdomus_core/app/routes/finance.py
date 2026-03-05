import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_db, get_current_user, require_household_role

router = APIRouter(prefix="/finance", tags=["Finance"])

def now():
    return datetime.now(timezone.utc).isoformat()

@router.post("/expenses")
def add_expense(household_id: str, amount: float, currency: str="USD", category: str="general",
                merchant: str|None=None, expense_date: str|None=None, notes: str|None=None, person_id: str|None=None,
                user=Depends(get_current_user), db=Depends(get_db)):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")
    require_household_role(db, user["user_id"], household_id, "member")
    eid = str(uuid.uuid4())
    created = now()
    expense_at = created if not expense_date else f"{expense_date}T00:00:00+00:00"
    db.execute("""
      INSERT INTO expenses (id,household_id,amount,currency,category,merchant,expense_at,notes,person_id,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (eid, household_id, float(amount), currency, category, merchant, expense_at, notes, person_id, created))
    db.commit()
    return {"id": eid}

@router.get("/expenses")
def list_expenses(household_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    require_household_role(db, user["user_id"], household_id, "viewer")
    rows = db.execute("""
      SELECT id,amount,currency,category,merchant,expense_at,notes,person_id,created_at
      FROM expenses
      WHERE household_id=?
      ORDER BY expense_at DESC, created_at DESC
      LIMIT 200
    """, (household_id,)).fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r["id"], "amount": float(r["amount"]), "currency": r["currency"], "category": r["category"],
            "merchant": r["merchant"], "expense_at": r["expense_at"], "notes": r["notes"],
            "person_id": r["person_id"], "created_at": r["created_at"],
        })
    return {"items": items}
