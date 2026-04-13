"""
auth.py — Password utilities and token re-exports.

Security notes:
  - bcrypt hashing only (rounds ≥ 12 via passlib defaults)
  - No plaintext fallback — any legacy plaintext passwords must be migrated
  - SHA-256 pre-hash legacy path supported for migration period only
"""
import os
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from app.tokens import create_token, create_refresh_token, decode_token, decode_refresh_token

# bcrypt with work factor 12 (passlib default when scheme="bcrypt")
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    if not password or not isinstance(password, str):
        raise ValueError("Password must be a non-empty string")
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plain-text password against its bcrypt hash.
    Supports both direct bcrypt and the legacy SHA-256 pre-hash path.
    Does NOT support raw plaintext storage — that is a security bug, not a feature.
    """
    if not plain or not hashed:
        return False
    if not isinstance(plain, str) or not isinstance(hashed, str):
        return False

    # Primary path: raw password → bcrypt
    try:
        if pwd_ctx.verify(plain, hashed):
            return True
    except (ValueError, TypeError, UnknownHashError):
        pass

    # Legacy path: SHA-256(password) → bcrypt
    # Only active if LEGACY_SHA256_PASSWORDS=1 env var is set.
    # Remove this block once all legacy passwords are re-hashed.
    if os.getenv("LEGACY_SHA256_PASSWORDS") == "1":
        import hashlib
        try:
            prehashed = hashlib.sha256(plain.encode("utf-8")).hexdigest()
            if pwd_ctx.verify(prehashed, hashed):
                return True
        except (ValueError, TypeError, UnknownHashError):
            pass

    return False


def needs_rehash(hashed: str) -> bool:
    """Returns True if the hash should be upgraded (e.g. bcrypt rounds increased)."""
    try:
        return pwd_ctx.needs_update(hashed)
    except Exception:
        return False
