import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, permissionsApi } from "@/lib/api";

const AuthContext = createContext(null);

const ROLE_HIERARCHY = { super_admin: 4, admin: 3, staff: 2, user: 1 };

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [permissions, setPerms] = useState(null);
  const [loading, setLoading]   = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data } = await permissionsApi.me();
      setPerms(data);
    } catch {
      setPerms(null);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }

    authApi.me()
      .then(({ data }) => {
        setUser(data);
        return permissionsApi.me();
      })
      .then(({ data }) => setPerms(data))
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const { data } = await authApi.login(credentials);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    // Fetch permissions after login
    try {
      const permRes = await permissionsApi.me();
      setPerms(permRes.data);
    } catch { /* non-critical */ }
    return data;
  };

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    try {
      const permRes = await permissionsApi.me();
      setPerms(permRes.data);
    } catch { /* non-critical */ }
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setPerms(null);
  };

  // Refresh user data (e.g. after profile update)
  const refreshUser = async () => {
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch { /* silently fail */ }
  };

  // ── Role helpers ───────────────────────────────────────────────────────────
  const isAdmin         = ["admin", "super_admin"].includes(user?.role);
  const isStaff         = ["staff", "admin", "super_admin"].includes(user?.role);
  const isSuperAdmin    = user?.role === "super_admin";
  const orgPlan         = user?.org_plan ?? "free";
  const orgName         = user?.org_name ?? "";

  // Get the roles that the current user can assign
  const assignableRoles = permissions?.assignable_roles ?? [];

  // Check if user has a specific permission
  const hasPermission = (perm) => permissions?.permissions?.includes(perm) ?? false;

  // Check if user has minimum role level
  const hasMinRole = (minRole) => {
    const userLevel = ROLE_HIERARCHY[user?.role] || 0;
    const minLevel  = ROLE_HIERARCHY[minRole] || 0;
    return userLevel >= minLevel;
  };

  return (
    <AuthContext.Provider value={{
      user, loading, permissions,
      login, register, logout, refreshUser,
      isAdmin, isStaff, isSuperAdmin,
      orgPlan, orgName,
      assignableRoles, hasPermission, hasMinRole,
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
