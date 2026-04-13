import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, User, Bell, Shield, Zap, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, Lock, Eye, EyeOff,
  Sun, Moon, Monitor,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi, permissionsApiClient as permissionsApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe } from "lucide-react";

const SECTIONS = [
  { id: "profile",  label: "Profile",         icon: User,      desc: "Personal info & preferences" },
  { id: "org",      label: "Organization",     icon: Building2, desc: "Hierarchy names & org type" },
  { id: "roles",    label: "Roles",            icon: Shield,    desc: "Role/hierarchy permissions" },
  { id: "notify",   label: "Notifications",    icon: Bell,      desc: "Alert and digest settings" },
  { id: "security", label: "Security",         icon: Lock,      desc: "Password & access control" },
  { id: "appearance",label: "Appearance",      icon: Sun,       desc: "Theme & display settings" },
  { id: "api",      label: "API & MCP",        icon: Zap,       desc: "Developer keys and endpoints" },
];

function ProfileSection({ user }) {
  const [saved, setSaved] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const roleDesc = {
    super_admin: "Full unrestricted access to all features and org settings",
    admin:       "Manage users, view insights and analytics, mark attendance",
    staff:       "Mark attendance for others and view analytics",
    user:        "Mark own attendance and view personal dashboard",
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4 p-4 glass rounded-xl">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
          {(user?.name || "U").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white">{user?.name}</p>
          <p className="text-sm text-white/40 truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant={user?.role}>{user?.role?.replace("_", " ")}</Badge>
            {user?.org_name && (
              <span className="text-xs text-white/25">· {user.org_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Role description */}
      {user?.role && (
        <div className="p-3 rounded-lg bg-violet-500/[0.06] border border-violet-500/15">
          <p className="text-xs text-violet-300 font-medium mb-0.5">Your access level</p>
          <p className="text-xs text-white/40">{roleDesc[user.role] || "Standard access"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Display name</Label>
          <Input defaultValue={user?.name} placeholder="Your name" />
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Input defaultValue={user?.department || ""} placeholder="e.g. Engineering" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="gradient">Save changes</Button>
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-sm text-emerald-400"
            >
              <CheckCircle2 className="w-4 h-4" /> Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

/* ─── ORGANIZATION SECTION — Custom hierarchy names ────────────────────────── */
const DEFAULT_HIERARCHY_NAMES = {
  department: "Department",
  class:      "Class / Group",
  section:    "Section",
  subject:    "Subject",
};

const ORG_TYPES = [
  { value: "school",  label: "School",  desc: "Classes, Sections, Subjects" },
  { value: "office",  label: "Office",  desc: "Teams, Sub-teams, Projects" },
  { value: "college", label: "College", desc: "Departments, Batches, Courses" },
];

function OrgSection() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [form, setForm] = useState({ ...DEFAULT_HIERARCHY_NAMES });
  const [orgType, setOrgType] = useState("office");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    authApi.getOrgSettings()
      .then(({ data }) => {
        const s = data.settings || {};
        setOrgType(data.org_type || "office");
        setForm({
          department: s.label_department || DEFAULT_HIERARCHY_NAMES.department,
          class:      s.label_class      || DEFAULT_HIERARCHY_NAMES.class,
          section:    s.label_section    || DEFAULT_HIERARCHY_NAMES.section,
          subject:    s.label_subject    || DEFAULT_HIERARCHY_NAMES.subject,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await authApi.updateOrgSettings({
        org_type: orgType,
        settings: {
          label_department: form.department,
          label_class:      form.class,
          label_section:    form.section,
          label_subject:    form.subject,
        },
      });
      setSuccess("Organization settings saved!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin && !isSuperAdmin) {
    return <div className="p-4 rounded-xl border border-white/[0.08] text-sm text-white/40">Only admins can configure organization settings.</div>;
  }

  const FIELDS = [
    { key: "department", label: "Level 1 — Department label",  placeholder: "e.g. Department, Faculty, Team" },
    { key: "class",      label: "Level 2 — Class / Group label", placeholder: "e.g. Class, Grade, Project" },
    { key: "section",    label: "Level 3 — Section label",      placeholder: "e.g. Section, Batch, Sub-team" },
    { key: "subject",    label: "Level 4 — Subject label",      placeholder: "e.g. Subject, Course, Module" },
  ];

  return (
    <div className="space-y-5">
      <div className="p-4 glass rounded-xl border-l-2 border-violet-500/40">
        <p className="text-sm text-violet-300 font-medium flex items-center gap-2">
          <Globe className="w-4 h-4" /> Custom Hierarchy Names
        </p>
        <p className="text-xs text-white/40 mt-1">
          Rename the hierarchy levels to match your organization's terminology. These names appear throughout the app.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-red-500/20 bg-red-500/[0.08] text-sm text-red-400"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] text-sm text-emerald-400"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <div className="pt-2 space-y-2">
            <Label>Organization type</Label>
            <div className="grid grid-cols-3 gap-2">
              {ORG_TYPES.map(t => (
                <div
                  key={t.value}
                  onClick={() => setOrgType(t.value)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    orgType === t.value
                      ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/30"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <p className="text-sm font-medium text-white">{t.label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{t.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/25">Org type affects default feature labelling (read-only via API, update via settings above).</p>
          </div>

          <Button type="submit" variant="gradient" disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : "Save hierarchy names"}
          </Button>
        </form>
      )}
    </div>
  );
}

/* ─── NOTIFICATIONS SECTION ────────────────────────────────────────────────── */
function NotifySection() {
  const [opts, setOpts] = useState({
    low_attendance: true, weekly_digest: true, late_arrivals: false, dept_alerts: true,
  });
  const toggle = (k) => setOpts(p => ({ ...p, [k]: !p[k] }));

  const items = [
    { key: "low_attendance", label: "Low attendance alerts",   desc: "Get notified when attendance drops below 75%" },
    { key: "weekly_digest",  label: "Weekly digest email",     desc: "Summary of attendance trends every Monday" },
    { key: "late_arrivals",  label: "Late-arrival alerts",     desc: "Alert when users arrive more than 30 min late" },
    { key: "dept_alerts",    label: "Department-level alerts", desc: "Notify when a department dips below threshold" },
  ];

  return (
    <div className="space-y-3">
      {items.map(({ key, label, desc }) => (
        <div key={key} className="flex items-center justify-between p-4 glass rounded-xl">
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-white/40 mt-0.5">{desc}</p>
          </div>
          <button
            onClick={() => toggle(key)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${opts[key] ? "bg-violet-500" : "bg-white/10"}`}
          >
            <motion.span
              className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow"
              animate={{ x: opts[key] ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── SECURITY SECTION — LIVE change-password ──────────────────────────────── */
function SecuritySection() {
  const [form, setForm]       = useState({ current: "", next: "", confirm: "" });
  const [showCurr, setShowCurr] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");

  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setError(""); setSuccess(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.current) { setError("Current password is required"); return; }
    if (form.next.length < 6) { setError("New password must be at least 6 characters"); return; }
    if (form.next !== form.confirm) { setError("Passwords don't match"); return; }

    setLoading(true);
    try {
      await authApi.changePassword({ current_password: form.current, new_password: form.next });
      setSuccess("Password changed successfully!");
      setForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-4 glass rounded-xl border-l-2 border-amber-500/40">
        <p className="text-sm text-amber-400 font-medium">Change your password</p>
        <p className="text-xs text-white/40 mt-0.5">Choose a strong password with at least 6 characters.</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2.5 p-3 rounded-lg border border-red-500/20 bg-red-500/[0.08] text-sm text-red-400"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] text-sm text-emerald-400"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Current password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <Input
              type={showCurr ? "text" : "password"}
              placeholder="••••••••"
              value={form.current}
              onChange={set("current")}
              className="pl-9 pr-10"
            />
            <button type="button" onClick={() => setShowCurr(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer">
              {showCurr ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <Input
              type={showNext ? "text" : "password"}
              placeholder="Min. 6 characters"
              value={form.next}
              onChange={set("next")}
              className="pl-9 pr-10"
            />
            <button type="button" onClick={() => setShowNext(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer">
              {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Confirm new password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <Input
              type="password"
              placeholder="Repeat new password"
              value={form.confirm}
              onChange={set("confirm")}
              className="pl-9"
            />
          </div>
        </div>

        <Button type="submit" variant="gradient" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : "Update password"}
        </Button>
      </form>
    </div>
  );
}

/* ─── ROLES MANAGEMENT SECTION ────────────────────────────────────────────────────── */
function RoleSection() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", label: "", level: 1, description: "" });
  const [saving, setSaving] = useState(false);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data } = await permissionsApi.roles();
      setRoles(data.roles || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isSuperAdmin) fetchRoles(); else setLoading(false);
  }, [isAdmin, isSuperAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Role name is required"); return; }
    setSaving(true);
    try {
      await permissionsApi.createRole({
        ...form,
        name: form.name.trim().toLowerCase().replace(/\s+/g, "_"),
      });
      setForm({ name: "", label: "", level: 1, description: "" });
      fetchRoles();
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role) => {
    if (!confirm(`Delete role '${role.name}'?`)) return;
    try {
      await permissionsApi.deleteRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete role");
    }
  };

  if (!isAdmin && !isSuperAdmin) {
    return <div className="p-4 rounded-xl border border-white/[0.08] text-sm text-white/40">Only admins can view role management.</div>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 rounded-lg text-sm text-red-300 bg-red-500/10 border border-red-500/20">{error}</div>}
      <form className="grid grid-cols-1 sm:grid-cols-4 gap-3" onSubmit={handleCreate}>
        <input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Name (staff)"
          className="bg-white/5 border border-white/[0.12] rounded-md text-sm text-white p-2"
        />
        <input
          value={form.label}
          onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          placeholder="Label (Staff)"
          className="bg-white/5 border border-white/[0.12] rounded-md text-sm text-white p-2"
        />
        <input
          value={form.level}
          type="number"
          min={1}
          max={99}
          onChange={(e) => setForm((p) => ({ ...p, level: Number(e.target.value) }))}
          placeholder="Level"
          className="bg-white/5 border border-white/[0.12] rounded-md text-sm text-white p-2"
        />
        <button className="bg-violet-500/70 hover:bg-violet-500 text-white rounded-md p-2 text-sm" disabled={saving}>
          {saving ? "Saving…" : "Create Role"}
        </button>
      </form>
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-white/40">Loading roles…</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-white/40">No roles yet.</p>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.08] bg-white/5">
              <div>
                <p className="text-sm text-white font-semibold">{role.label || role.name}</p>
                <p className="text-xs text-white/40">{role.name} - Level {role.level}</p>
              </div>
              <button className="text-red-300 hover:text-red-100 text-xs" onClick={() => deleteRole(role)}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── API & MCP SECTION ────────────────────────────────────────────────────── */
function ApiSection() {
  const endpoints = [
    { method: "GET",   path: "/api/auth/me",                    desc: "Current authenticated user + org plan" },
    { method: "GET",   path: "/api/permissions/me",             desc: "RBAC permissions for current user" },
    { method: "GET",   path: "/api/permissions/roles",          desc: "List roles by organization" },
    { method: "POST",  path: "/api/permissions/roles",          desc: "Create custom role" },
    { method: "PUT",   path: "/api/permissions/roles/{id}",     desc: "Update role metadata/level" },
    { method: "DELETE",path: "/api/permissions/roles/{id}",     desc: "Delete custom role" },
    { method: "GET",   path: "/api/permissions/role-permissions", desc: "List granular role resource permission rules" },
    { method: "POST",  path: "/api/permissions/role-permissions", desc: "Create role permission rule" },
    { method: "PUT",   path: "/api/permissions/role-permissions/{id}", desc: "Update role permission rule" },
    { method: "DELETE",path: "/api/permissions/role-permissions/{id}", desc: "Delete role permission rule" },
    { method: "GET",   path: "/api/analytics/kpis",             desc: "KPI metrics for dashboard" },
    { method: "GET",   path: "/api/analytics/trends",           desc: "Attendance trends (supports ?days=)" },
    { method: "GET",   path: "/api/analytics/departments",      desc: "Department breakdown" },
    { method: "GET",   path: "/api/analytics/user-performance", desc: "Per-user attendance stats" },
    { method: "GET",   path: "/api/insights/",                  desc: "All AI-generated insights" },
    { method: "POST",  path: "/api/insights/generate",          desc: "Re-run insight analysis" },
    { method: "GET",   path: "/api/insights/summary",           desc: "Natural-language summary (MCP ready)" },
    { method: "GET",   path: "/api/attendance/",                desc: "Attendance records (filterable)" },
    { method: "POST",  path: "/api/attendance/mark",            desc: "Mark a user's attendance" },
    { method: "GET",   path: "/api/attendance/today/summary",   desc: "Today's live snapshot" },
    { method: "GET",   path: "/api/logs/",                      desc: "Activity audit log" },
    { method: "POST",  path: "/api/auth/change-password",       desc: "Change authenticated user password" },
  ];

  const methodColor = {
    GET:   "bg-blue-500/10 text-blue-400",
    POST:  "bg-emerald-500/10 text-emerald-400",
    PATCH: "bg-amber-500/10 text-amber-400",
    PUT:   "bg-violet-500/10 text-violet-400",
  };

  return (
    <div className="space-y-4">
      <div className="p-4 glass rounded-xl border-l-2 border-cyan-500/40">
        <p className="text-sm text-cyan-400 font-medium flex items-center gap-2">
          <Zap className="w-4 h-4" /> MCP-Ready API
        </p>
        <p className="text-xs text-white/40 mt-1">
          All endpoints return structured JSON consumable by AI agents and MCP tools.
          Authenticate with <code className="text-violet-400">Authorization: Bearer &lt;token&gt;</code>.
        </p>
      </div>
      <div className="space-y-1.5">
        {endpoints.map(ep => (
          <div key={ep.path} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono flex-shrink-0 ${methodColor[ep.method] || methodColor.GET}`}>
              {ep.method}
            </span>
            <code className="text-xs text-violet-300 flex-1 truncate">{ep.path}</code>
            <p className="text-xs text-white/30 hidden sm:block flex-shrink-0 max-w-[220px] truncate">{ep.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── APPEARANCE SECTION ────────────────────────────────────────────────────── */
function AppearanceSection() {
  const { theme, toggleTheme } = useTheme();

  const themes = [
    { id: "dark",  label: "Dark",  desc: "Easy on the eyes, great for night use", icon: Moon },
    { id: "light", label: "Light", desc: "Clean and bright for daytime work",     icon: Sun  },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>Color Theme</p>
        <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
          Choose how Nexus looks. Your preference is saved in your browser.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {themes.map(t => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => !isActive && toggleTheme()}
                className="p-4 rounded-xl border text-left transition-all"
                style={{
                  borderColor: isActive ? "rgba(139,92,246,0.4)" : "var(--surface-border)",
                  backgroundColor: isActive ? "var(--nav-active-bg)" : "var(--surface-card)",
                  boxShadow: isActive ? "0 0 0 1px rgba(139,92,246,0.3)" : "none",
                }}
              >
                <Icon className={`w-5 h-5 mb-2 ${isActive ? "text-violet-400" : ""}`}
                  style={{ color: isActive ? undefined : "var(--text-muted)" }}
                />
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN SETTINGS PAGE ────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState("profile");

  const CONTENT = {
    profile:    <ProfileSection user={user} />,
    org:        <OrgSection />,
    roles:      <RoleSection />,
    notify:     <NotifySection />,
    security:   <SecuritySection />,
    appearance: <AppearanceSection />,
    api:        <ApiSection />,
  };


  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Settings className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          Settings
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage your account and workspace preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar nav */}
        <Card className="lg:col-span-1 p-3 h-fit">
          <nav className="space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer border"
                  style={{
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    backgroundColor: isActive ? "var(--nav-active-bg)" : "transparent",
                    borderColor: isActive ? "var(--nav-active-border)" : "transparent",
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{s.label}</p>
                    <p className="text-[11px] truncate hidden sm:block" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Content area */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{SECTIONS.find(s => s.id === active)?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {CONTENT[active]}
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
