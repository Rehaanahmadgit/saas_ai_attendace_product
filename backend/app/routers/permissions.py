"""
permissions.py — RBAC Permissions & Role Management
Mounted at /api/permissions

Endpoints:
  GET    /api/permissions/me                   → current user's permissions
  GET    /api/permissions/matrix               → full RBAC matrix (admin+)
  GET    /api/permissions/roles                → list roles (admin+)
  POST   /api/permissions/roles                → create custom role (admin+)
  PUT    /api/permissions/roles/{id}           → update role (admin+)
  DELETE /api/permissions/roles/{id}           → delete custom role (admin+)
  GET    /api/permissions/role-permissions     → list permission rows (admin+)
  POST   /api/permissions/role-permissions     → create permission row (admin+)
  PUT    /api/permissions/role-permissions/{id} → full replace (admin+)
  PATCH  /api/permissions/role-permissions/{id} → partial update (admin+)
  DELETE /api/permissions/role-permissions/{id} → delete row (admin+)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import OrgUser, RolePermission, Role
from app.schemas import (
    RoleCreate, RoleOut, RoleUpdate,
    RolePermissionCreate, RolePermissionUpdate, RolePermissionOut,
    PermissionMatrixResponse, PermissionMatrixRow,
)
from app.dependencies import (
    get_current_user, get_role_hierarchy,
    get_assignable_roles, DEFAULT_PERMISSIONS, DEFAULT_ROLE_HIERARCHY, ALL_RESOURCES,
)
from app.database import get_db

router = APIRouter(tags=["permissions"])

AnyRole = Depends(get_current_user)


def _role_str(user: OrgUser) -> str:
    r = user.role
    return r.value if hasattr(r, "value") else str(r)


def _require_admin(current_user: OrgUser):
    if _role_str(current_user) not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")


# ── My permissions ─────────────────────────────────────────────────────────────

@router.get("/me")
async def get_my_permissions(
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Returns the current user's effective RBAC permissions (DB rows merged with defaults)."""
    role = _role_str(current_user)
    role_hierarchy = await get_role_hierarchy(current_user.organization_id, db)

    # Fetch DB overrides
    rows = await db.execute(
        select(RolePermission).where(
            RolePermission.organization_id == current_user.organization_id,
            RolePermission.role == role,
        )
    )
    db_perms = {
        perm.resource: {
            "can_view":   perm.can_view,
            "can_create": perm.can_create,
            "can_edit":   perm.can_edit,
            "can_delete": perm.can_delete,
            "scope":      perm.scope,
            "source":     "custom",
        }
        for perm in rows.scalars().all()
    }

    # Merge with defaults (DB takes priority)
    merged = {}
    for resource in ALL_RESOURCES:
        if resource in db_perms:
            merged[resource] = db_perms[resource]
        else:
            default = DEFAULT_PERMISSIONS.get(resource, {}).get(role)
            if default:
                merged[resource] = {**default, "source": "default"}
            else:
                merged[resource] = {
                    "can_view": False, "can_create": False,
                    "can_edit": False, "can_delete": False,
                    "scope": "self", "source": "none",
                }

    assignable_roles = await get_assignable_roles(current_user, db)

    return {
        "role": role,
        "level": role_hierarchy.get(role, 0),
        "permissions": merged,
        "assignable_roles": assignable_roles,
        # Convenience booleans for frontend
        "can_manage_users":    merged.get("users", {}).get("can_view", False),
        "can_view_analytics":  merged.get("analytics", {}).get("can_view", False),
        "can_view_insights":   merged.get("insights", {}).get("can_view", False),
        "can_view_logs":       merged.get("role_permissions", {}).get("can_view", False),
    }


# ── Full RBAC matrix ──────────────────────────────────────────────────────────

@router.get("/matrix", response_model=PermissionMatrixResponse)
async def get_permission_matrix(
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the full permission matrix for the organisation.
    Each row = one role; columns = resources.
    Super-admin and admin can see all roles; others see their own row only.

    Designed to power the Permissions Management page.
    """
    _require_admin(current_user)
    org_id = current_user.organization_id
    role_hierarchy = await get_role_hierarchy(org_id, db)

    # Fetch all roles for this org
    db_roles_result = await db.execute(
        select(Role).where(Role.organization_id == org_id).order_by(Role.level.desc())
    )
    db_roles = db_roles_result.scalars().all()

    # If no custom roles seeded yet, build from defaults
    if not db_roles:
        role_defs = [
            {"name": k, "label": k.replace("_", " ").title(), "level": v}
            for k, v in sorted(DEFAULT_ROLE_HIERARCHY.items(), key=lambda x: -x[1])
        ]
        is_default = True
    else:
        role_defs = [{"name": r.name, "label": r.label or r.name.title(), "level": r.level} for r in db_roles]
        is_default = False

    # Fetch all DB permission overrides for the org
    db_perms_result = await db.execute(
        select(RolePermission).where(RolePermission.organization_id == org_id)
    )
    db_perms: dict[tuple, RolePermission] = {
        (p.role, p.resource): p for p in db_perms_result.scalars().all()
    }

    matrix_rows = []
    for rd in role_defs:
        role_name = rd["name"]
        resources_map = {}
        for resource in ALL_RESOURCES:
            key = (role_name, resource)
            if key in db_perms:
                p = db_perms[key]
                resources_map[resource] = {
                    "can_view": p.can_view,
                    "can_create": p.can_create,
                    "can_edit": p.can_edit,
                    "can_delete": p.can_delete,
                    "scope": p.scope,
                    "source": "custom",
                }
            else:
                default = DEFAULT_PERMISSIONS.get(resource, {}).get(role_name)
                if default:
                    resources_map[resource] = {**default, "source": "default"}
                else:
                    resources_map[resource] = {
                        "can_view": False, "can_create": False,
                        "can_edit": False, "can_delete": False,
                        "scope": "self", "source": "none",
                    }

        matrix_rows.append(PermissionMatrixRow(
            role=role_name,
            label=rd["label"],
            level=rd["level"],
            resources=resources_map,
        ))

    return PermissionMatrixResponse(
        roles=matrix_rows,
        resources=ALL_RESOURCES,
        is_default=is_default,
    )


# ── Roles CRUD ────────────────────────────────────────────────────────────────

@router.get("/roles")
async def list_roles(
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Returns the full role hierarchy for the organisation."""
    rows = await db.execute(
        select(Role)
        .where(Role.organization_id == current_user.organization_id)
        .order_by(Role.level.desc())
    )
    roles = rows.scalars().all()

    # If no DB roles exist yet, return the defaults
    if not roles:
        return {
            "roles": [
                {"id": None, "name": k, "label": k.replace("_", " ").title(),
                 "level": v, "description": f"Default role", "source": "default"}
                for k, v in sorted(DEFAULT_ROLE_HIERARCHY.items(), key=lambda x: -x[1])
            ],
            "is_default": True,
        }

    return {
        "roles": [RoleOut.model_validate(r) for r in roles],
        "is_default": False,
    }


@router.post("/roles", status_code=201)
async def create_role(
    data: RoleCreate,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Create a custom role for the organisation."""
    _require_admin(current_user)

    existing = await db.scalar(
        select(Role).where(
            Role.organization_id == current_user.organization_id,
            Role.name == data.name,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Role '{data.name}' already exists")

    role = Role(
        organization_id=current_user.organization_id,
        name=data.name,
        label=data.label or data.name.replace("_", " ").title(),
        level=data.level,
        description=data.description,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return RoleOut.model_validate(role)


@router.put("/roles/{role_id}")
async def update_role(
    role_id: int,
    data: RoleUpdate,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    role = await db.scalar(
        select(Role).where(
            Role.id == role_id,
            Role.organization_id == current_user.organization_id,
        )
    )
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if data.label is not None:
        role.label = data.label
    if data.level is not None:
        role.level = data.level
    if data.description is not None:
        role.description = data.description

    await db.commit()
    await db.refresh(role)
    return RoleOut.model_validate(role)


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(
    role_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    role = await db.scalar(
        select(Role).where(
            Role.id == role_id,
            Role.organization_id == current_user.organization_id,
        )
    )
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Prevent deleting built-in roles
    if role.name in ("super_admin", "admin", "staff", "user"):
        raise HTTPException(status_code=400, detail=f"Cannot delete built-in role '{role.name}'")

    await db.delete(role)
    await db.commit()


# ── RolePermission CRUD ───────────────────────────────────────────────────────

@router.get("/role-permissions")
async def list_role_permissions(
    role: str | None = None,
    resource: str | None = None,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """List DB-stored permission rows for the organisation, optionally filtered."""
    _require_admin(current_user)

    stmt = select(RolePermission).where(RolePermission.organization_id == current_user.organization_id)
    if role:
        stmt = stmt.where(RolePermission.role == role)
    if resource:
        stmt = stmt.where(RolePermission.resource == resource)

    rows = (await db.execute(stmt)).scalars().all()
    return {"role_permissions": [RolePermissionOut.model_validate(p) for p in rows]}


@router.post("/role-permissions", status_code=201)
async def create_role_permission(
    data: RolePermissionCreate,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Create a permission row. Raises 409 if one already exists for role+resource."""
    _require_admin(current_user)

    existing = await db.scalar(
        select(RolePermission).where(
            RolePermission.organization_id == current_user.organization_id,
            RolePermission.role == data.role,
            RolePermission.resource == data.resource,
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Permission rule for role='{data.role}' resource='{data.resource}' already exists. Use PUT to update.",
        )

    perm = RolePermission(
        organization_id=current_user.organization_id,
        role=data.role,
        resource=data.resource,
        can_view=data.can_view,
        can_create=data.can_create,
        can_edit=data.can_edit,
        can_delete=data.can_delete,
        scope=data.scope,
    )
    db.add(perm)
    await db.commit()
    await db.refresh(perm)
    return RolePermissionOut.model_validate(perm)


@router.put("/role-permissions/{perm_id}")
async def replace_role_permission(
    perm_id: int,
    data: RolePermissionCreate,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Full replace of a permission row."""
    _require_admin(current_user)

    perm = await db.scalar(
        select(RolePermission).where(
            RolePermission.id == perm_id,
            RolePermission.organization_id == current_user.organization_id,
        )
    )
    if not perm:
        raise HTTPException(status_code=404, detail="Permission rule not found")

    perm.role = data.role
    perm.resource = data.resource
    perm.can_view = data.can_view
    perm.can_create = data.can_create
    perm.can_edit = data.can_edit
    perm.can_delete = data.can_delete
    perm.scope = data.scope

    await db.commit()
    await db.refresh(perm)
    return RolePermissionOut.model_validate(perm)


@router.patch("/role-permissions/{perm_id}")
async def patch_role_permission(
    perm_id: int,
    data: RolePermissionUpdate,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Partial update — only send the fields you want to change."""
    _require_admin(current_user)

    perm = await db.scalar(
        select(RolePermission).where(
            RolePermission.id == perm_id,
            RolePermission.organization_id == current_user.organization_id,
        )
    )
    if not perm:
        raise HTTPException(status_code=404, detail="Permission rule not found")

    if data.can_view is not None:
        perm.can_view = data.can_view
    if data.can_create is not None:
        perm.can_create = data.can_create
    if data.can_edit is not None:
        perm.can_edit = data.can_edit
    if data.can_delete is not None:
        perm.can_delete = data.can_delete
    if data.scope is not None:
        perm.scope = data.scope

    await db.commit()
    await db.refresh(perm)
    return RolePermissionOut.model_validate(perm)


@router.delete("/role-permissions/{perm_id}", status_code=204)
async def delete_role_permission(
    perm_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    perm = await db.scalar(
        select(RolePermission).where(
            RolePermission.id == perm_id,
            RolePermission.organization_id == current_user.organization_id,
        )
    )
    if not perm:
        raise HTTPException(status_code=404, detail="Permission rule not found")

    await db.delete(perm)
    await db.commit()


# ── Upsert convenience endpoint ───────────────────────────────────────────────

@router.put("/role-permissions/upsert")
async def upsert_role_permission(
    data: RolePermissionCreate,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """
    Create or update a permission row in one call.
    Useful for the matrix editor — send any cell change directly.
    """
    _require_admin(current_user)

    existing = await db.scalar(
        select(RolePermission).where(
            RolePermission.organization_id == current_user.organization_id,
            RolePermission.role == data.role,
            RolePermission.resource == data.resource,
        )
    )

    if existing:
        existing.can_view = data.can_view
        existing.can_create = data.can_create
        existing.can_edit = data.can_edit
        existing.can_delete = data.can_delete
        existing.scope = data.scope
        perm = existing
    else:
        perm = RolePermission(
            organization_id=current_user.organization_id,
            role=data.role,
            resource=data.resource,
            can_view=data.can_view,
            can_create=data.can_create,
            can_edit=data.can_edit,
            can_delete=data.can_delete,
            scope=data.scope,
        )
        db.add(perm)

    await db.commit()
    await db.refresh(perm)
    return RolePermissionOut.model_validate(perm)
