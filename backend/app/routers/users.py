from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.database import get_db
from app.models import OrgUser
from app.schemas import UserCreate, UserUpdate, UserOut
from app.dependencies import get_current_user, require_min_role
from app import auth as auth_utils

router = APIRouter(tags=["users"])

AdminOrAbove = Depends(require_min_role("admin"))


@router.get("/", response_model=List[UserOut])
@router.get("", response_model=List[UserOut])
async def list_users(
    department: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(OrgUser).where(OrgUser.organization_id == current_user.organization_id)
    if department:
        stmt = stmt.where(OrgUser.department == department)
    if role:
        stmt = stmt.where(OrgUser.role == role)
    if is_active is not None:
        stmt = stmt.where(OrgUser.is_active == is_active)
    stmt = stmt.order_by(OrgUser.name)

    result = await db.execute(stmt)
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    email = data.email.lower()
    if await db.scalar(select(OrgUser).where(OrgUser.email == email)):
        raise HTTPException(status_code=409, detail="Email already exists")

    # RBAC: enforce role assignment restrictions
    ROLE_HIERARCHY = {"super_admin": 4, "admin": 3, "staff": 2, "user": 1}
    requester_level = ROLE_HIERARCHY.get(current_user.role, 0)
    target_level    = ROLE_HIERARCHY.get(data.role, 0)

    if target_level >= requester_level:
        raise HTTPException(
            status_code=403,
            detail=f"Cannot assign role '{data.role}' — you can only assign roles below your own level",
        )

    user = OrgUser(
        organization_id=current_user.organization_id,
        name=data.name,
        email=email,
        password_hash=auth_utils.hash_password(data.password),
        role=data.role,
        department=data.department,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut)
@router.get("/{user_id}/", response_model=UserOut)
async def get_user(
    user_id: int,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == user_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.put("/{user_id}", response_model=UserOut)
@router.put("/{user_id}/", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == user_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # RBAC: enforce role update restrictions
    ROLE_HIERARCHY = {"super_admin": 4, "admin": 3, "staff": 2, "user": 1}
    requester_level = ROLE_HIERARCHY.get(current_user.role, 0)

    if data.role:
        target_level = ROLE_HIERARCHY.get(data.role, 0)
        if target_level >= requester_level:
            raise HTTPException(
                status_code=403,
                detail=f"Cannot assign role '{data.role}' — you can only assign roles below your own level",
            )

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{user_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == user_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent non-super_admins from deleting super_admins
    ROLE_HIERARCHY = {"super_admin": 4, "admin": 3, "staff": 2, "user": 1}
    if ROLE_HIERARCHY.get(user.role, 0) >= ROLE_HIERARCHY.get(current_user.role, 0):
        raise HTTPException(status_code=403, detail="Cannot delete a user with equal or higher role")

    await db.delete(user)
    await db.commit()
