from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from app.database import get_db
from app.models import OrgUser
from app import auth as auth_utils

bearer = HTTPBearer()

ROLE_HIERARCHY = {
    "super_admin": 4,
    "admin": 3,
    "staff": 2,
    "user": 1,
}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> OrgUser:
    """Decode JWT and load the full user from DB."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth_utils.decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = await db.scalar(
        select(OrgUser).where(OrgUser.id == int(user_id), OrgUser.is_active == True)
    )
    if not user:
        raise credentials_exc
    return user


def require_roles(*roles: str):
    """Factory: only allow users whose role is in the given list."""

    async def checker(current_user: OrgUser = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to: {', '.join(roles)}",
            )
        return current_user

    return checker


def require_min_role(min_role: str):
    """Factory: allow users whose role hierarchy level >= min_role."""

    async def checker(current_user: OrgUser = Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        required_level = ROLE_HIERARCHY.get(min_role, 99)
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least {min_role} access",
            )
        return current_user

    return checker


# Convenient pre-built guards
AdminOrAbove = Depends(require_min_role("admin"))
StaffOrAbove = Depends(require_min_role("staff"))
AnyRole = Depends(get_current_user)
