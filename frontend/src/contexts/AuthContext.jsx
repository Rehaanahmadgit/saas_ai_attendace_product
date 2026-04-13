import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, permissionsApiClient as permissionsApi, onboardingApi } from "@/lib/api";
import { getMemToken, setMemToken, clearMemToken } from "@/lib/token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [permissions, setPerms]       = useState(null);
  const [onboarding, setOnboarding]   = useState(null);
  const [loading, setLoading]         = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const [permRes, rolesRes] = await Promise.all([
        permissionsApi.me(),
        permissionsApi.roles(),
      ]);
      setPerms({ ...permRes.data, role_hierarchy: rolesRes.data });
    } catch {
      setPerms(null);
    }
  }, []);

  const fetchOnboarding = useCallback(async (role) => {
    // Only admins have onboarding requirements
    if (!["admin", "super_admin"].includes(role)) {
      setOnboarding({ completed: true });
      return;
    }
    try {
      const { data } = await onboardingApi.getStatus();
      setOnboarding(data);
    } catch {
      setOnboarding({ completed: true }); // assume done on error to avoid blocking
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) { setLoading(false); return; }

    authApi.refresh({ refresh_token: refresh })
      .then(({ data: refreshData }) => {
        setMemToken(refreshData.access_token);
        localStorage.setItem("refresh_token", refreshData.refresh_token);
        return authApi.me();
      })
      .then(({ data }) => {
        setUser(data);
        return Promise.all([fetchPermissions(), fetchOnboarding(data.role)]);
      })
      .catch(() => {
        localStorage.removeItem("refresh_token");
        clearMemToken();
      })
      .finally(() => setLoading(false));
  }, [fetchPermissions, fetchOnboarding]);

  const login = async (credentials) => {
    const { data } = await authApi.login(credentials);
    setMemToken(data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    setUser(data.user);
    try {
      await Promise.all([fetchPermissions(), fetchOnboarding(data.user.role)]);
    } catch { /* non-critical */ }
    return data;
  };

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    setMemToken(data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    setUser(data.user);
    setOnboarding({ completed: false, progress_pct: 0 });
    try {
      await fetchPermissions();
    } catch { /* non-critical */ }
    return data;
  };

  const logout = () => {
    clearMemToken();
    localStorage.removeItem("refresh_token");
    setUser(null);
    setPerms(null);
    setOnboarding(null);
  };

  const refreshUser = async () => {
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch { /* silently fail */ }
  };

  const refreshOnboarding = async () => {
    if (user?.role) await fetchOnboarding(user.role);
  };

  // ── Role helpers ───────────────────────────────────────────────────────────
  const isAdmin      = ["admin", "super_admin"].includes(user?.role);
  const isStaff      = ["staff", "admin", "super_admin"].includes(user?.role);
  const isSuperAdmin = user?.role === "super_admin";
  const orgPlan      = user?.org_plan ?? "free";
  const orgName      = user?.org_name ?? "";

  const assignableRoles = permissions?.assignable_roles ?? [];
  const roleLevel       = permissions?.level ?? 0;

  const hasPermission = (resource, action = "can_view") => {
    const perms = permissions?.permissions;
    if (!perms || typeof perms !== "object") return false;
    return perms[resource]?.[action] === true;
  };

  const hasMinRole = (minRole) => {
    if (!permissions) return false;
    const roleHierarchyMap = permissions?.role_hierarchy ?? {};
    const userLevel = roleHierarchyMap[user?.role] ?? permissions?.level ?? 0;
    const minLevel  = roleHierarchyMap[minRole] ?? 0;
    return userLevel >= minLevel;
  };

  // isOnboarded: true if the org setup wizard is completed
  // Uses the dedicated onboarding status — NOT user.settings.onboarded (which doesn't exist)
  const isOnboarded = onboarding?.completed === true;

  return (
    <AuthContext.Provider value={{
      user, loading, permissions, onboarding,
      login, register, logout, refreshUser, refreshOnboarding,
      isAdmin, isStaff, isSuperAdmin,
      orgPlan, orgName,
      assignableRoles, hasPermission, hasMinRole,
      roleLevel, isOnboarded,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
