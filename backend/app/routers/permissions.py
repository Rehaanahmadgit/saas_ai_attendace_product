"""
RBAC Permissions Router
Exposes the role hierarchy and current user permissions for frontend consumption.
"""
from fastapi import APIRouter, Depends

from app.models import OrgUser
from app.dependencies import get_current_user

router = APIRouter(tags=["permissions"])

AnyRole = Depends(get_current_user)

ROLE_HIERARCHY = {
    "super_admin": 4,
    "admin": 3,
    "staff": 2,
    "user": 1,
}

# Define what each role can do
ROLE_PERMISSIONS = {
    "super_admin": [
        "view_dashboard",
        "view_attendance",
        "mark_own_attendance",
        "mark_others_attendance",
        "view_analytics",
        "view_insights",
        "generate_insights",
        "view_users",
        "create_users",
        "edit_users",
        "delete_users",
        "assign_any_role",
        "view_logs",
        "manage_settings",
    ],
    "admin": [
        "view_dashboard",
        "view_attendance",
        "mark_own_attendance",
        "mark_others_attendance",
        "view_analytics",
        "view_insights",
        "generate_insights",
        "view_users",
        "create_users",
        "edit_users",
        "delete_users",
        "assign_role_up_to_staff",
        "view_logs",
        "manage_settings",
    ],
    "staff": [
        "view_dashboard",
        "view_attendance",
        "mark_own_attendance",
        "mark_others_attendance",
        "view_analytics",
        "manage_settings",
    ],
    "user": [
        "view_dashboard",
        "view_attendance",
        "mark_own_attendance",
        "manage_settings",
    ],
}


@router.get("/me")
async def get_my_permissions(current_user: OrgUser = AnyRole):
    """Returns the current user's RBAC permissions and accessible roles."""
    role = current_user.role
    perms = ROLE_PERMISSIONS.get(role, [])
    level = ROLE_HIERARCHY.get(role, 0)

    # Roles that the current user is allowed to assign to others
    assignable_roles = [
        r for r, lvl in ROLE_HIERARCHY.items()
        if lvl < level  # can only assign roles below your own level
    ]
    # super_admin can assign admin too
    if role == "super_admin":
        assignable_roles = ["user", "staff", "admin"]

    return {
        "role": role,
        "level": level,
        "permissions": perms,
        "assignable_roles": assignable_roles,
        "can_manage_users": "view_users" in perms,
        "can_view_analytics": "view_analytics" in perms,
        "can_view_insights": "view_insights" in perms,
        "can_view_logs": "view_logs" in perms,
    }


@router.get("/roles")
async def list_roles(current_user: OrgUser = AnyRole):
    """Returns the full role hierarchy definition."""
    return {
        "roles": [
            {
                "name": "super_admin",
                "label": "Super Admin",
                "level": 4,
                "description": "Full system access including organization management",
                "color": "violet",
            },
            {
                "name": "admin",
                "label": "Admin",
                "level": 3,
                "description": "Manage users, view insights and analytics",
                "color": "blue",
            },
            {
                "name": "staff",
                "label": "Staff",
                "level": 2,
                "description": "Mark attendance for others and view analytics",
                "color": "cyan",
            },
            {
                "name": "user",
                "label": "User",
                "level": 1,
                "description": "Mark own attendance and view dashboard",
                "color": "slate",
            },
        ]
    }
