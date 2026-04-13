/**
 * usePermission.js
 * Check RBAC permissions from any component.
 *
 * Usage:
 *   const { can } = usePermission();
 *   if (can("students", "can_create")) { ... }
 *
 * Fetches full permission matrix once per session and caches in module scope.
 * No fallbacks — only DB-driven permissions.
 */
import { useAuth } from "@/contexts/AuthContext";

/**
 * usePermission.js
 * Check RBAC permissions from any component using the centralized state in AuthContext.
 */
export function usePermission() {
  const { user, permissions } = useAuth();
  
  /**
   * can("students", "can_view") → boolean
   * can("attendance", "can_create") → boolean
   */
  function can(resource, action = "can_view") {
    if (!user) return false;
    
    // 1. Super-admins are god-mode
    if (user.role === "super_admin") return true;

    // 2. Check permissions from AuthContext
    // permissions is { permissions: { resource: { can_view, can_create, ... } } }
    const perms = permissions?.permissions;
    if (!perms || typeof perms !== "object") return false;

    const resourcePerm = perms[resource];
    if (!resourcePerm) return false;

    return resourcePerm[action] === true;
  }

  return { can };
}