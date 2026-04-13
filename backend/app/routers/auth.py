"""
routers/auth.py — Authentication router
Mounted at /api/auth

FIXES:
 - /login: removed duplicate `is_active` check (was checked twice)
 - /login: TokenResponse was called with `token_payload=` which is not a schema field
 - /refresh: `logger` was used without being imported — added import
 - /refresh: token_payload role was stored raw (may be enum) — normalised with _role_str
 - /register: now creates OnboardingStatus row automatically
 - /me: response now includes `org_type` and `settings` (frontend needs these for wizard)
 - ChangePasswordRequest.Config used old-style dict min_length which does nothing —
   validation is now done explicitly in the handler (already was, so config removed)
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import OrgUser, Organization, ActivityLog, OnboardingStatus
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, AuthUserOut, RefreshRequest
from app.dependencies import get_current_user
from app import auth as auth_utils

router = APIRouter(tags=["auth"])
logger = logging.getLogger("auth")
limiter = Limiter(key_func=get_remote_address)


def _role_str(user: OrgUser) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


# ── Schemas ────────────────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class OrgSettingsUpdate(BaseModel):
    settings: Optional[dict] = None
    org_type: Optional[str]  = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if not data.email or not data.password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email and password are required")

    email = auth_utils.normalize_email(data.email)
    user  = await db.scalar(select(OrgUser).where(OrgUser.email == email))

    if not user or not auth_utils.verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    # FIX: check is_active before any DB writes
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated")

    # Rehash if needed (bcrypt rounds upgrade)
    if auth_utils.needs_rehash(user.password_hash):
        user.password_hash = auth_utils.hash_password(data.password)
        db.add(user)

    user.last_login = datetime.now(timezone.utc)

    db.add(ActivityLog(
        user_id=user.id,
        organization_id=user.organization_id,
        action="login",
        resource="auth",
        details={"email": user.email},
        ip_address=request.client.host if request.client else "unknown",
    ))

    await db.commit()

    token_payload = {"sub": str(user.id), "org": user.organization_id, "role": _role_str(user)}
    return TokenResponse(
        access_token=auth_utils.create_token(token_payload),
        refresh_token=auth_utils.create_refresh_token(token_payload),
        user=AuthUserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh_token(data: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    try:
        payload = auth_utils.decode_refresh_token(data.refresh_token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Token sub missing")
    except Exception as exc:
        logger.warning("Refresh token decode failed: %s", exc)   # FIX: logger now defined
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please login again")

    user = await db.scalar(
        select(OrgUser).where(OrgUser.id == int(user_id), OrgUser.is_active == True)
    )
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or account deactivated")

    role_str = _role_str(user)   # FIX: normalise enum → str
    token_payload = {"sub": str(user.id), "org": user.organization_id, "role": role_str}

    return TokenResponse(
        access_token=auth_utils.create_token(token_payload),
        refresh_token=auth_utils.create_refresh_token(token_payload),
        user=AuthUserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(data: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """First-user registration — creates the organisation and a super_admin."""
    if not data.email or not data.password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email and password are required")

    email = auth_utils.normalize_email(data.email)
    if await db.scalar(select(OrgUser).where(OrgUser.email == email)):
        raise HTTPException(409, "Email already registered")

    org = Organization(name=data.organization_name, plan="free")
    db.add(org)
    await db.flush()   # get org.id

    user = OrgUser(
        organization_id=org.id,
        name=data.name,
        email=email,
        password_hash=auth_utils.hash_password(data.password),
        role="super_admin",
        user_type="staff",
    )
    db.add(user)
    await db.flush()   # get user.id

    # FIX: create OnboardingStatus so the setup wizard has a record to update
    db.add(OnboardingStatus(organization_id=org.id))

    await db.commit()
    await db.refresh(user)

    token_payload = {"sub": str(user.id), "org": user.organization_id, "role": _role_str(user)}
    return TokenResponse(
        access_token=auth_utils.create_token(token_payload),
        refresh_token=auth_utils.create_refresh_token(token_payload),
        user=AuthUserOut.model_validate(user),
    )


@router.get("/me")
async def me(current_user: OrgUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Returns the authenticated user enriched with org info."""
    org = await db.scalar(select(Organization).where(Organization.id == current_user.organization_id))
    user_data = AuthUserOut.model_validate(current_user).model_dump()
    user_data["org_name"]    = org.name     if org else ""
    user_data["org_plan"]    = org.plan     if org else "free"
    user_data["org_type"]    = org.org_type if org else "office"
    user_data["settings"]    = org.settings if org else {}
    return user_data


@router.post("/change-password", status_code=200)
async def change_password(
    data: ChangePasswordRequest,
    current_user: OrgUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not data.current_password or not data.new_password:
        raise HTTPException(400, "Current and new passwords are required")
    if not auth_utils.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")

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


@router.get("/org-settings")
async def get_org_settings(
    current_user: OrgUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = await db.scalar(select(Organization).where(Organization.id == current_user.organization_id))
    if not org:
        raise HTTPException(404, "Organization not found")
    return {"org_name": org.name, "org_type": org.org_type, "settings": org.settings or {}}


@router.patch("/org-settings")
async def update_org_settings(
    data: OrgSettingsUpdate,
    current_user: OrgUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Merges new settings and updates org_type. admin+ only."""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str not in ("admin", "super_admin"):
        raise HTTPException(403, "Only admins can update org settings")

    org = await db.scalar(select(Organization).where(Organization.id == current_user.organization_id))
    if not org:
        raise HTTPException(404, "Organization not found")

    if data.settings is not None:
        org.settings = {**(org.settings or {}), **data.settings}

    if data.org_type:
        org.org_type = data.org_type
        # Advance onboarding step
        onboard = await db.scalar(
            select(OnboardingStatus).where(OnboardingStatus.organization_id == current_user.organization_id)
        )
        if onboard and not onboard.org_type_set:
            onboard.org_type_set = True

    db.add(ActivityLog(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        action="org_settings_updated",
        resource="organization",
        details={
            "updated_settings": list(data.settings.keys()) if data.settings else [],
            "updated_type": bool(data.org_type),
        },
    ))
    await db.commit()
    await db.refresh(org)
    return {"ok": True, "org_name": org.name, "org_type": org.org_type, "settings": org.settings or {}}