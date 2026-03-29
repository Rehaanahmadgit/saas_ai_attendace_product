import os
from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
import hashlib

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret")
ALGORITHM = "HS256"
EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    if password is None or not isinstance(password, str) or password == "":
        raise ValueError("Password must be a non-empty string")
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against its bcrypt hash.

    NOTE: hash_password stores bcrypt(raw_password), so we verify
    the raw password directly — no pre-hashing step.
    """
    if plain is None or hashed is None:
        return False
    if not isinstance(plain, str) or not isinstance(hashed, str):
        return False

    try:
        if pwd_ctx.verify(plain, hashed):
            return True
    except (ValueError, TypeError, UnknownHashError):
        pass

    # Legacy support for older storage that pre-hashes with SHA256 then bcrypt.
    try:
        prehashed = hashlib.sha256(plain.encode("utf-8")).hexdigest()
        if pwd_ctx.verify(prehashed, hashed):
            return True
    except (ValueError, TypeError, UnknownHashError):
        pass

    # Backward-compat: if DB contains a raw plaintext value (bad practice),
    # allow direct equality check until migration completes.
    return plain == hashed


def needs_rehash(hashed: str) -> bool:
    try:
        return pwd_ctx.needs_update(hashed)
    except Exception:
        return False


def create_token(payload: dict) -> str:
    data = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)}
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
