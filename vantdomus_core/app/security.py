from datetime import datetime, timedelta, timezone
from jose import jwt
import bcrypt
from .config import settings

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, pw_hash: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), pw_hash.encode("utf-8"))

def create_access_token(sub: str, email: str | None):
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=settings.ACCESS_TOKEN_EXPIRES_SECONDS)
    payload = {"sub": sub, "email": email, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)
    return token, settings.ACCESS_TOKEN_EXPIRES_SECONDS

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
