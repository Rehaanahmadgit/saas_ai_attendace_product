from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models import OrgUser, Organization, ActivityLog
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, AuthUserOut
from app.dependencies import get_current_user
from app import auth as auth_utils

router = APIRouter(tags=["auth"])


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    class Config:
        model_config = {"min_length": 6}


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if not data.email or not data.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and password are required")

    email = auth_utils.normalize_email(data.email)
    user = await db.scalar(select(OrgUser).where(OrgUser.email == email))

    if not user or not auth_utils.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if auth_utils.needs_rehash(user.password_hash):
        user.password_hash = auth_utils.hash_password(data.password)
        db.add(user)
        await db.commit()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    # Update last login
    user.last_login = datetime.now(timezone.utc)

    # Log the login
    db.add(ActivityLog(
        user_id=user.id,
        organization_id=user.organization_id,
        action="login",
        resource="auth",
        details={"email": user.email},
        ip_address=request.client.host if request.client else "unknown",
    ))

    await db.commit()

    token = auth_utils.create_token({"sub": str(user.id), "org": user.organization_id})
    return TokenResponse(access_token=token, user=AuthUserOut.model_validate(user))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """First-user registration — creates the organization and a super_admin."""
    if not data.email or not data.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and password are required")

    email = auth_utils.normalize_email(data.email)

    if await db.scalar(select(OrgUser).where(OrgUser.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    org = Organization(name=data.organization_name, plan="free")
    db.add(org)
    await db.flush()

    user = OrgUser(
        organization_id=org.id,
        name=data.name,
        email=email,
        password_hash=auth_utils.hash_password(data.password),
        role="super_admin",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = auth_utils.create_token({"sub": str(user.id), "org": org.id})
    return TokenResponse(access_token=token, user=AuthUserOut.model_validate(user))


@router.get("/me")
async def me(current_user: OrgUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Returns the authenticated user with their org's plan info."""
    org = await db.scalar(select(Organization).where(Organization.id == current_user.organization_id))
    user_data = AuthUserOut.model_validate(current_user).model_dump()
    user_data["org_name"] = org.name if org else ""
    user_data["org_plan"] = org.plan if org else "free"
    return user_data


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    data: ChangePasswordRequest,
    current_user: OrgUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allows authenticated users to change their own password."""
    if not data.current_password or not data.new_password:
        raise HTTPException(status_code=400, detail="Current and new passwords are required")

    if not auth_utils.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    current_user.password_hash = auth_utils.hash_password(data.new_password)

    db.add(ActivityLog(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        action="password_changed",
        resource="auth",
        details={"email": current_user.email},
    ))

    await db.commit()
    return {"ok": True, "message": "Password updated successfully"}
