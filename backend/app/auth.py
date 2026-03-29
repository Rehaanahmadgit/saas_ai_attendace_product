import os
from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret")
ALGORITHM = "HS256"
EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against its bcrypt hash.

    NOTE: hash_password stores bcrypt(raw_password), so we verify
    the raw password directly — no pre-hashing step.
    """
    return pwd_ctx.verify(plain, hashed)


def create_token(payload: dict) -> str:
    data = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)}
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
