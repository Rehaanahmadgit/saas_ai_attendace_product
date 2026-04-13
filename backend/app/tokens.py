"""
tokens.py — JWT token utilities
Separate secrets for access and refresh tokens to prevent token confusion attacks.
"""
import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

SECRET_KEY         = os.getenv("JWT_SECRET_KEY", "fallback-access-secret-change-in-production")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", SECRET_KEY + "-refresh")
ALGORITHM          = "HS256"
EXPIRE_HOURS       = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))


def decode_token(token: str) -> dict:
    """Decode and verify a JWT access token."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") not in (None, "access"):
        raise JWTError("Not an access token")
    return payload


def create_token(payload: dict) -> str:
    """Create a JWT access token (expires in EXPIRE_HOURS)."""
    data = {
        **payload,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS),
    }
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(payload: dict) -> str:
    """Create a JWT refresh token (expires in 7 days). Signed with a different key."""
    data = {
        **payload,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(data, REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def decode_refresh_token(token: str) -> dict:
    """Decode and verify a refresh token."""
    payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "refresh":
        raise JWTError("Not a refresh token")
    return payload
