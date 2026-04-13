from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Role, RolePermission, ActivityLog
from app.dependencies import DEFAULT_ROLE_HIERARCHY, DEFAULT_PERMISSIONS

async def seed_org_defaults(org_id: int, user_id: int, db: AsyncSession) -> dict:
    """
    Seeds default roles and permissions for a new organization.
    """
    roles_added = 0
    perms_added = 0

    # Seed default roles
    for name, level in DEFAULT_ROLE_HIERARCHY.items():
        existing = await db.scalar(
            select(Role).where(Role.organization_id == org_id, Role.name == name)
        )
        if not existing:
            db.add(Role(
                organization_id=org_id,
                name=name,
                label=name.replace("_", " ").title(),
                level=level,
                description=f"Default role: {name}",
            ))
            roles_added += 1

    await db.flush()

    # Seed default role permissions
    for resource, role_map in DEFAULT_PERMISSIONS.items():
        for role_name, perms in role_map.items():
            existing = await db.scalar(
                select(RolePermission).where(
                    RolePermission.organization_id == org_id,
                    RolePermission.role == role_name,
                    RolePermission.resource == resource,
                )
            )
            if not existing:
                db.add(RolePermission(
                    organization_id=org_id,
                    role=role_name,
                    resource=resource,
                    can_view=perms["can_view"],
                    can_create=perms["can_create"],
                    can_edit=perms["can_edit"],
                    can_delete=perms["can_delete"],
                    scope=perms["scope"],
                ))
                perms_added += 1

    db.add(ActivityLog(
        user_id=user_id,
        organization_id=org_id,
        action="seed_defaults_auto",
        resource="rbac",
        details={"roles_added": roles_added, "permissions_added": perms_added},
    ))

    return {"roles_added": roles_added, "perms_added": perms_added}
