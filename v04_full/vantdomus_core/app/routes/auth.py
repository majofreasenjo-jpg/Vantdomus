import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from ..deps import get_db
from ..security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

def now():
    return datetime.now(timezone.utc).isoformat()

@router.post("/register")
def register(email: str, password: str, db=Depends(get_db)):
    row = db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone()
    if row:
        raise HTTPException(status_code=400, detail="Email exists")
    uid = str(uuid.uuid4())
    db.execute("INSERT INTO users (id,email,password_hash,is_active,created_at) VALUES (?,?,?,?,?)",
               (uid, email, hash_password(password), 1, now()))
    db.commit()
    return {"user_id": uid}

@router.post("/login")
def login(email: str, password: str, db=Depends(get_db)):
    row = db.execute("SELECT id, password_hash FROM users WHERE email=?", (email,)).fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token, exp = create_access_token(sub=row["id"], email=email)
    return {"access_token": token, "token_type": "bearer", "expires_in": exp}
