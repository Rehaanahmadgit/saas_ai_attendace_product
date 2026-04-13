"""
dependencies.py — JWT auth + hierarchical RBAC + scope isolation
Fixes: 307 redirect bug (redirect_slashes=False in main.py),
       403 on valid tokens (scope isolation added properly)
"""
import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from functools import lru_cache
from typing import Optional

from app.database import get_db
from app.models import OrgUser, RolePermission, Role
from app.tokens import decode_token, SECRET_KEY, ALGORITHM

# JWT constants (imported from tokens.py)
# SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret")
# ALGORITHM = "HS256"

bearer = HTTPBearer(auto_error=False)   # auto_error=False → we send clean 401, not 403


# ── Shared utilities ──────────────────────────────────────────────────────────

def _role_str(user) -> str:
    """Safely extract role as plain string from OrgUser (handles Enum or str)."""
    r = user.role
    return r.value if hasattr(r, "value") else str(r)


# ── All resources tracked in RBAC ────────────────────────────────────────────

ALL_RESOURCES = [
    "attendance", "students", "departments", "classes", "sections",
    "analytics", "insights", "users", "subjects", "role_permissions",
]


# ── Role hierarchy ────────────────────────────────────────────────────────────

DEFAULT_ROLE_HIERARCHY = {
    "super_admin": 4,
    "admin":       3,
    "staff":       2,   # teacher / staff
    "user":        1,   # student / basic
}


async def get_role_hierarchy(organization_id: int, db: AsyncSession) -> dict[str, int]:
    rows = await db.execute(select(Role).where(Role.organization_id == organization_id))
    roles = rows.scalars().all()
    if not roles:
        return DEFAULT_ROLE_HIERARCHY
    return {r.name: r.level for r in roles}


async def get_assignable_roles(current_user: OrgUser, db: AsyncSession) -> list[str]:
    role_hierarchy = await get_role_hierarchy(current_user.organization_id, db)
    current_level = role_hierarchy.get(current_user.role, 0)
    assignable = [name for name, lvl in role_hierarchy.items() if lvl < current_level]
    if current_user.role == "super_admin" and "admin" not in assignable:
        assignable.append("admin")
    return sorted(set(assignable), key=lambda r: role_hierarchy.get(r, 0), reverse=True)


async def assert_can_assign_role(current_user: OrgUser, target_role: str, db: AsyncSession):
    role_hierarchy = await get_role_hierarchy(current_user.organization_id, db)
    requester_level = role_hierarchy.get(current_user.role, 0)
    target_level = role_hierarchy.get(target_role, 0)
    if target_level >= requester_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot assign role '{target_role}' — you can only assign roles below your own level",
        )


# ── Default permissions (used when no custom row in role_permissions table) ───
# Format: resource → role → PermissionSet dict
DEFAULT_PERMISSIONS: dict[str, dict[str, dict]] = {
    "attendance": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "staff":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False,"scope": "section"},
        "user":        {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "students": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "staff":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "section"},
        "user":        {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "departments": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "staff":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "org"},
        "user":        {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "classes": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "staff":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "org"},
        "user":        {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "sections": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "staff":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "section"},
        "user":        {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "analytics": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "org"},
        "staff":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "section"},
        "user":        {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "insights": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": False,"can_delete": False,"scope": "org"},
        "staff":       {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
        "user":        {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "users": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "staff":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "section"},
        "user":        {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "subjects": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "staff":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "org"},
        "user":        {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
    "role_permissions": {
        "super_admin": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True, "scope": "org"},
        "admin":       {"can_view": True, "can_create": False,"can_edit": False,"can_delete": False,"scope": "org"},
        "staff":       {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
        "user":        {"can_view": False,"can_create": False,"can_edit": False,"can_delete": False,"scope": "self"},
    },
}


# ── Core auth dependency ──────────────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> OrgUser:
    """Decode JWT → load OrgUser. Returns clean 401 (not 403) on failure."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required — provide Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload  = decode_token(credentials.credentials)
        user_id  = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == int(user_id),
            OrgUser.is_active == True,
        )
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )
    return user


# ── Role hierarchy guards ─────────────────────────────────────────────────────

def require_roles(*roles: str):
    async def checker(current_user: OrgUser = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to: {', '.join(roles)}",
            )
        return current_user
    return checker


def require_min_role(min_role: str):
    async def checker(
        current_user: OrgUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        role_hierarchy = await get_role_hierarchy(current_user.organization_id, db)
        user_level = role_hierarchy.get(current_user.role, 0)
        required_level = role_hierarchy.get(min_role, 99)
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least '{min_role}' role",
            )
        return current_user
    return checker


# ── RBAC permission guard ─────────────────────────────────────────────────────

def require_permission(resource: str, action: str = "can_view"):
    """
    Check DB-configured permissions first, fall back to DEFAULT_PERMISSIONS.
    action: can_view | can_create | can_edit | can_delete
    """
    async def checker(
        current_user: OrgUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        # 1. Check custom DB permissions for this org+role+resource
        custom = await db.scalar(
            select(RolePermission).where(
                RolePermission.organization_id == current_user.organization_id,
                RolePermission.role == current_user.role,
                RolePermission.resource == resource,
            )
        )

        if custom:
            allowed = getattr(custom, action, False)
        else:
            # Fall back to defaults
            res_defaults = DEFAULT_PERMISSIONS.get(resource, {})
            role_defaults = res_defaults.get(current_user.role, {})
            allowed = role_defaults.get(action, False)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have '{action}' permission on '{resource}'",
            )
        return current_user
    return checker


async def get_permission_scope(
    resource: str,
    current_user: OrgUser,
    db: AsyncSession,
) -> str:
    """Returns scope: 'org' | 'section' | 'self'"""
    custom = await db.scalar(
        select(RolePermission).where(
            RolePermission.organization_id == current_user.organization_id,
            RolePermission.role == current_user.role,
            RolePermission.resource == resource,
        )
    )
    if custom:
        return custom.scope
    res_defaults = DEFAULT_PERMISSIONS.get(resource, {})
    role_defaults = res_defaults.get(current_user.role, {})
    return role_defaults.get("scope", "self")


# ── Scope filter enforcement ──────────────────────────────────────────────────

async def enforce_scope_filter(
    resource: str,
    current_user,
    db: AsyncSession,
    target_user_id: Optional[int] = None,
):
    """
    Enforces scope-based access control for a given resource + user.
    Raises 403 if the requesting user lacks scope to access the target.

    Scopes:
      "org"     → can access any record in their org (admin/super_admin)
      "section" → staff can only access records in their assigned sections
      "self"    → users can only access their own record
    """
    from app.models import SectionTeacher  # avoid circular import at module level

    scope = await get_permission_scope(resource, current_user, db)
    user_role = _role_str(current_user)

    # org scope: no restriction beyond org membership (already enforced by query filters)
    if scope == "org":
        return

    # self scope: can only access own record
    if scope == "self":
        if target_user_id and target_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own records",
            )
        return

    # section scope: staff can access records of students in their sections
    if scope == "section":
        # Admins and above bypass section scope
        if user_role in ("admin", "super_admin"):
            return
        # If no specific target, allow (list will be filtered per query)
        if not target_user_id or target_user_id == current_user.id:
            return
        # Check if target user is in a section the current user teaches
        assigned_sections = await db.execute(
            select(SectionTeacher.section_id).where(
                SectionTeacher.user_id == current_user.id,
            )
        )
        section_ids = [r[0] for r in assigned_sections.all()]

        if not section_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to any section",
            )

        from app.models import Student
        student_in_section = await db.scalar(
            select(Student).where(
                Student.user_id == target_user_id,
                Student.section_id.in_(section_ids),
                Student.is_active == True,
            )
        )
        if not student_in_section:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Target user is not in any of your assigned sections",
            )


# ── Convenient pre-built guards ───────────────────────────────────────────────

AdminOrAbove   = Depends(require_min_role("admin"))
StaffOrAbove   = Depends(require_min_role("staff"))
AnyRole        = Depends(get_current_user)
SuperAdminOnly = Depends(require_roles("super_admin"))