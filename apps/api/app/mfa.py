import base64
import hmac
import hashlib
import os
import secrets
import struct
import time
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from .config import settings


PROTECTED_TOTP_PREFIX = "fernet:v1:"


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _derive_fernet_key(secret_value: str) -> bytes:
    return base64.urlsafe_b64encode(hashlib.sha256(secret_value.encode("utf-8")).digest())


def _configured_mfa_secret_values() -> list[str]:
    rotated_keys = os.getenv("VANTDOMUS_MFA_SECRET_KEYS", "")
    values = [item.strip() for item in rotated_keys.split(",") if item.strip()]
    if values:
        return values
    return [os.getenv("VANTDOMUS_MFA_SECRET_KEY") or settings.JWT_SECRET]


def _mfa_fernets() -> list[Fernet]:
    return [Fernet(_derive_fernet_key(value)) for value in _configured_mfa_secret_values()]


def protect_totp_secret(secret: str) -> str:
    token = _mfa_fernets()[0].encrypt(secret.encode("utf-8")).decode("ascii")
    return f"{PROTECTED_TOTP_PREFIX}{token}"


def is_protected_totp_secret(secret: str | None) -> bool:
    return bool(secret and str(secret).startswith(PROTECTED_TOTP_PREFIX))


def reveal_totp_secret(stored_secret: str) -> str:
    if not is_protected_totp_secret(stored_secret):
        return stored_secret
    token = stored_secret[len(PROTECTED_TOTP_PREFIX) :]
    for fernet in _mfa_fernets():
        try:
            return fernet.decrypt(token.encode("ascii")).decode("utf-8")
        except InvalidToken:
            continue
    raise InvalidToken("MFA secret cannot be decrypted with configured keys")


def should_reprotect_totp_secret(stored_secret: str | None) -> bool:
    if not is_protected_totp_secret(stored_secret):
        return bool(stored_secret)
    token = stored_secret[len(PROTECTED_TOTP_PREFIX) :]
    try:
        _mfa_fernets()[0].decrypt(token.encode("ascii"))
        return False
    except InvalidToken:
        return True


def _decode_secret(secret: str) -> bytes:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    return base64.b32decode((secret + padding).upper())


def totp_code(secret: str, for_time: int | None = None, period: int = 30, digits: int = 6) -> str:
    timestamp = int(for_time if for_time is not None else time.time())
    counter = timestamp // period
    msg = struct.pack(">Q", counter)
    digest = hmac.new(_decode_secret(secret), msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10**digits)).zfill(digits)


def verify_totp(secret: str, code: str, window: int = 1, period: int = 30) -> bool:
    clean_code = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(clean_code) != 6:
        return False
    now = int(time.time())
    for offset in range(-window, window + 1):
        expected = totp_code(secret, now + (offset * period), period=period)
        if hmac.compare_digest(expected, clean_code):
            return True
    return False


def otpauth_url(secret: str, email: str, issuer: str = "VantDomus") -> str:
    label = quote(f"{issuer}:{email}")
    issuer_q = quote(issuer)
    return f"otpauth://totp/{label}?secret={secret}&issuer={issuer_q}&algorithm=SHA1&digits=6&period=30"
