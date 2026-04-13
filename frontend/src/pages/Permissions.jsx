import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Check, X, RefreshCw, Info, ChevronDown } from "lucide-react";
import { permissionsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ACTIONS = ["can_view", "can_create", "can_edit", "can_delete"];
const ACTION_LABELS = { can_view: "View", can_create: "Create", can_edit: "Edit", can_delete: "Delete" };
const SCOPE_OPTIONS = ["org", "section", "self"];

const RESOURCE_LABELS = {
  attendance:       "Attendance",
  students:         "Students",
  departments:      "Departments",
  classes:          "Classes",
  sections:         "Sections",
  analytics:        "Analytics",
  insights:         "AI Insights",
  users:            "Users",
  subjects:         "Subjects",
  role_permissions: "Permissions",
};

function PermCell({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
        disabled ? "opacity-30 cursor-not-allowed" :
        value
          ? "bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30"
          : "bg-surface-hover text-theme-muted border border-surface hover:border-violet-500/20"
      }`}
      title={value ? "Allowed — click to revoke" : "Denied — click to allow"}
    >
      {value ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
    </button>
  );
}

function ScopeSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value}
      onChange={e => !disabled && onChange(e.target.value)}
      disabled={disabled}
      className="text-xs rounded-lg px-2 py-1 border transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-30"
      style={{
        backgroundColor: "var(--surface-card)",
        borderColor: "var(--surface-border)",
        color: "var(--text-secondary)",
      }}
    >
      {SCOPE_OPTIONS.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

export default function Permissions() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [collapsedRoles, setCollapsedRoles] = useState({});

  const canEdit = isSuperAdmin;

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await permissionsApi.me && permissionsApi.roles
        ? await fetch("/api/permissions/matrix").then(r => r.json()).then(d => ({ data: d }))
        : { data: null };
      setMatrix(data);
    } catch {
      setError("Failed to load permissions matrix");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use fetch directly for the matrix endpoint since permissionsApi doesn't have it
      const token = sessionStorage.getItem?.("__mem_token") || "";
      const res = await fetch("/api/permissions/matrix", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMatrix(data);
    } catch {
      setError("Failed to load permissions. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (role, resource, action, newValue) => {
    if (!canEdit) return;
    const key = `${role}-${resource}-${action}`;
    setSaving(s => ({ ...s, [key]: true }));

    // Optimistically update local state
    setMatrix(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        roles: prev.roles.map(r => {
          if (r.role !== role) return r;
          return {
            ...r,
            resources: {
              ...r.resources,
              [resource]: {
                ...r.resources[resource],
                [action]: newValue,
              },
            },
          };
        }),
      };
    });

    try {
      const currentRow = matrix?.roles.find(r => r.role === role);
      const currentRes = currentRow?.resources[resource] || {};
      await permissionsApi.updateRolePermission
        ? null // handled below
        : null;

      // Upsert via the API
      const payload = {
        role,
        resource,
        can_view:   action === "can_view"   ? newValue : currentRes.can_view   ?? false,
        can_create: action === "can_create" ? newValue : currentRes.can_create ?? false,
        can_edit:   action === "can_edit"   ? newValue : currentRes.can_edit   ?? false,
        can_delete: action === "can_delete" ? newValue : currentRes.can_delete ?? false,
        scope:      currentRes.scope ?? "org",
      };

      await permissionsApi.createRolePermission(payload).catch(async (err) => {
        // 409 = already exists, use update
        if (err.response?.status === 409) {
          const rows = await permissionsApi.listRolePermissions().then(r => r.data.role_permissions);
          const existing = rows.find(p => p.role === role && p.resource === resource);
          if (existing) {
            await permissionsApi.updateRolePermission(existing.id, payload);
          }
        } else {
          throw err;
        }
      });

      setSuccess(`Updated ${ACTION_LABELS[action]} for ${role} on ${resource}`);
      setTimeout(() => setSuccess(null), 2500);
    } catch {
      // Revert optimistic update on failure
      await loadMatrix();
      setError("Failed to save permission change");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  const handleScopeChange = async (role, resource, newScope) => {
    if (!canEdit) return;
    try {
      const currentRow = matrix?.roles.find(r => r.role === role);
      const currentRes = currentRow?.resources[resource] || {};

      const payload = {
        role, resource,
        can_view:   currentRes.can_view   ?? false,
        can_create: currentRes.can_create ?? false,
        can_edit:   currentRes.can_edit   ?? false,
        can_delete: currentRes.can_delete ?? false,
        scope:      newScope,
      };

      await permissionsApi.createRolePermission(payload).catch(async (err) => {
        if (err.response?.status === 409) {
          const rows = await permissionsApi.listRolePermissions().then(r => r.data.role_permissions);
          const existing = rows.find(p => p.role === role && p.resource === resource);
          if (existing) await permissionsApi.updateRolePermission(existing.id, payload);
        } else throw err;
      });

      setMatrix(prev => prev ? {
        ...prev,
        roles: prev.roles.map(r => r.role !== role ? r : {
          ...r,
          resources: { ...r.resources, [resource]: { ...r.resources[resource], scope: newScope } },
        }),
      } : prev);
    } catch {
      setError("Failed to update scope");
    }
  };

  const toggleRole = (roleName) => {
    setCollapsedRoles(s => ({ ...s, [roleName]: !s[roleName] }));
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-violet-400/30 mx-auto mb-3" />
          <p style={{ color: "var(--text-secondary)" }}>Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Permissions & RBAC
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {canEdit
              ? "Click any cell to toggle permissions for your organisation."
              : "View-only — only Super Admins can modify permissions."}
          </p>
        </div>
        <button
          onClick={loadMatrix}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors hover:border-violet-500/30 disabled:opacity-50"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Status messages */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
        >
          <Check className="w-4 h-4" />
          {success}
        </motion.div>
      )}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
        >
          <X className="w-4 h-4" />
          {error}
        </motion.div>
      )}

      {/* Info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
        style={{ backgroundColor: "var(--nav-active-bg)", borderColor: "var(--nav-active-border)", color: "var(--text-secondary)" }}
      >
        <Info className="w-4 h-4 mt-0.5 text-violet-400 flex-shrink-0" />
        <div>
          <strong style={{ color: "var(--text-primary)" }}>How RBAC works:</strong>{" "}
          Each role has permissions per resource. Custom overrides take priority over defaults.
          Scope controls what data a role can access: <code className="text-violet-400">org</code> = all,{" "}
          <code className="text-violet-400">section</code> = assigned section only,{" "}
          <code className="text-violet-400">self</code> = own records only.
        </div>
      </div>

      {/* Matrix */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--surface-card)" }} />
          ))}
        </div>
      ) : matrix ? (
        <div className="space-y-4">
          {matrix.roles.map((roleRow, ri) => (
            <Card key={roleRow.role}>
              {/* Role header */}
              <button
                className="w-full px-6 py-4 flex items-center gap-3 cursor-pointer"
                onClick={() => toggleRole(roleRow.role)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {roleRow.label}
                      </span>
                      <Badge variant={roleRow.role}>{roleRow.role}</Badge>
                      {matrix.is_default && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          defaults
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Level {roleRow.level} · {Object.values(roleRow.resources).filter(r => r.can_view).length} resources visible
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform flex-shrink-0 ${collapsedRoles[roleRow.role] ? "" : "rotate-180"}`}
                  style={{ color: "var(--text-muted)" }}
                />
              </button>

              {/* Permissions table */}
              {!collapsedRoles[roleRow.role] && (
                <div className="px-4 pb-4 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-2 font-medium text-xs w-36"
                          style={{ color: "var(--text-muted)" }}>
                          Resource
                        </th>
                        {ACTIONS.map(a => (
                          <th key={a} className="text-center py-2 px-2 font-medium text-xs"
                            style={{ color: "var(--text-muted)" }}>
                            {ACTION_LABELS[a]}
                          </th>
                        ))}
                        <th className="text-center py-2 px-2 font-medium text-xs"
                          style={{ color: "var(--text-muted)" }}>
                          Scope
                        </th>
                        <th className="text-center py-2 px-2 font-medium text-xs"
                          style={{ color: "var(--text-muted)" }}>
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.resources.map((resource, idx) => {
                        const res = roleRow.resources[resource] || {};
                        const isCustom = res.source === "custom";
                        return (
                          <tr
                            key={resource}
                            className="border-t transition-colors"
                            style={{
                              borderTopColor: "var(--surface-border)",
                              backgroundColor: idx % 2 === 0 ? "transparent" : "var(--surface-hover)",
                            }}
                          >
                            <td className="py-2.5 px-2">
                              <span className="font-medium text-xs" style={{ color: "var(--text-primary)" }}>
                                {RESOURCE_LABELS[resource] || resource}
                              </span>
                            </td>
                            {ACTIONS.map(action => {
                              const key = `${roleRow.role}-${resource}-${action}`;
                              return (
                                <td key={action} className="py-2.5 px-2 text-center">
                                  <div className="flex justify-center">
                                    <PermCell
                                      value={res[action] ?? false}
                                      onChange={v => handleToggle(roleRow.role, resource, action, v)}
                                      disabled={!canEdit || saving[key]}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                            <td className="py-2.5 px-2 text-center">
                              <ScopeSelect
                                value={res.scope ?? "org"}
                                onChange={v => handleScopeChange(roleRow.role, resource, v)}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                isCustom
                                  ? "text-violet-400 bg-violet-500/10 border-violet-500/20"
                                  : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                              }`}>
                                {isCustom ? "custom" : "default"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Shield className="w-12 h-12 text-violet-400/30 mx-auto mb-3" />
          <p style={{ color: "var(--text-secondary)" }}>No permissions data found</p>
          <button onClick={loadMatrix} className="mt-3 text-sm text-violet-400 hover:text-violet-300">
            Try again
          </button>
        </div>
      )}
    </motion.div>
  );
}
