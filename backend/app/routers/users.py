"""
routers/users.py — User management
Mounted at /api/users

FIXES:
 - POST /users now advances onboarding `first_user_invited` flag
 - DELETE /users: changed from hard-delete to soft-delete (is_active=False)
   Hard-deleting an OrgUser would cascade-delete all their attendance records,
   which destroys historical data. Soft-delete preserves data integrity.
 - List users: students (user_type=student) excluded from staff management list
   by default, since they are managed through /api/students instead.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.database import get_db
from app.models import OrgUser, OnboardingStatus
from app.schemas import UserCreate, UserUpdate, UserOut
from app.dependencies import (
    get_current_user, require_min_role, assert_can_assign_role,
    get_role_hierarchy, _role_str,
)
from app import auth as auth_utils

router = APIRouter(tags=["users"])

StaffOrAbove = Depends(require_min_role("staff"))
AdminOrAbove = Depends(require_min_role("admin"))


@router.get("", response_model=List[UserOut])
async def list_users(
    department: Optional[str]  = Query(None),
    role:       Optional[str]  = Query(None),
    is_active:  Optional[bool] = Query(None),
    user_type:  Optional[str]  = Query(None, description="staff | student — defaults to staff"),
    page:       int            = Query(1, ge=1),
    page_size:  int            = Query(50, ge=1, le=200),
    current_user: OrgUser      = StaffOrAbove,
    db: AsyncSession           = Depends(get_db),
):
    stmt = select(OrgUser).where(OrgUser.organization_id == current_user.organization_id)

    # Default: exclude student accounts from staff management list
    if user_type:
        stmt = stmt.where(OrgUser.user_type == user_type)
    else:
        stmt = stmt.where(OrgUser.user_type != "student")

    role_str = _role_str(current_user)
    if role_str not in ("admin", "super_admin"):
        stmt = stmt.where(OrgUser.department == current_user.department)

    if department:
        stmt = stmt.where(OrgUser.department == department)
    if role:
        stmt = stmt.where(OrgUser.role == role)
    if is_active is not None:
        stmt = stmt.where(OrgUser.is_active == is_active)

    stmt = stmt.order_by(OrgUser.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: OrgUser = StaffOrAbove,
    db: AsyncSession      = Depends(get_db),
):
    email = data.email.lower()
    if await db.scalar(select(OrgUser).where(OrgUser.email == email)):
        raise HTTPException(409, "Email already exists")

    await assert_can_assign_role(current_user, data.role, db)

    user = OrgUser(
        organization_id=current_user.organization_id,
        name=data.name,
        email=email,
        password_hash=auth_utils.hash_password(data.password),
        role=data.role,
        department=data.department,
        user_type="staff",
    )
    db.add(user)
    await db.flush()

    # Advance onboarding: first non-super_admin user invited
    onboard = await db.scalar(
        select(OnboardingStatus).where(
            OnboardingStatus.organization_id == current_user.organization_id
        )
    )
    if onboard and not onboard.first_user_invited:
        onboard.first_user_invited = True
        # Check if all steps done
        if all([
            onboard.org_type_set, onboard.department_added,
            onboard.class_added,  onboard.section_added,
            onboard.first_user_invited,
        ]):
            from datetime import datetime, timezone
            onboard.completed    = True
            onboard.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    current_user: OrgUser = StaffOrAbove,
    db: AsyncSession      = Depends(get_db),
):
    user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == user_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not user:
        raise HTTPException(404, "User not found")

    role_str = _role_str(current_user)
    if role_str not in ("admin", "super_admin") and user.department != current_user.department:
        raise HTTPException(403, "Forbidden: user is in another department")

    return UserOut.model_validate(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: OrgUser = StaffOrAbove,
    db: AsyncSession      = Depends(get_db),
):
    user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == user_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not user:
        raise HTTPException(404, "User not found")

    role_str = _role_str(current_user)
    if role_str not in ("admin", "super_admin") and user.department != current_user.department:
        raise HTTPException(403, "Cannot edit user in another department")

    if data.role:
        await assert_can_assign_role(current_user, data.role, db)

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: OrgUser = StaffOrAbove,
    db: AsyncSession      = Depends(get_db),
):
    """
    Soft-delete: sets is_active=False.
    FIX: original code used hard-delete which would CASCADE-delete all attendance
    records for this user, permanently destroying historical data.
    """
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot deactivate your own account")

    user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == user_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not user:
        raise HTTPException(404, "User not found")

    role_hierarchy = await get_role_hierarchy(current_user.organization_id, db)
    user_role_str    = _role_str(user)
    current_role_str = _role_str(current_user)
    if role_hierarchy.get(user_role_str, 0) >= role_hierarchy.get(current_role_str, 0):
        raise HTTPException(403, "Cannot deactivate a user with equal or higher role")

    user.is_active = False
    await db.commit()