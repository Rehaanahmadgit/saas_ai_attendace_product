import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, User, Bell, Shield, Zap, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, Lock, Eye, EyeOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const SECTIONS = [
  { id: "profile",  label: "Profile",       icon: User,   desc: "Personal info & preferences" },
  { id: "notify",   label: "Notifications", icon: Bell,   desc: "Alert and digest settings" },
  { id: "security", label: "Security",      icon: Shield, desc: "Password & access control" },
  { id: "api",      label: "API & MCP",     icon: Zap,    desc: "Developer keys and endpoints" },
];

/* ─── PROFILE SECTION ──────────────────────────────────────────────────────── */
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

/* ─── API & MCP SECTION ────────────────────────────────────────────────────── */
function ApiSection() {
  const endpoints = [
    { method: "GET",   path: "/api/auth/me",                    desc: "Current authenticated user + org plan" },
    { method: "GET",   path: "/api/permissions/me",             desc: "RBAC permissions for current user" },
    { method: "GET",   path: "/api/permissions/roles",          desc: "Full role hierarchy definition" },
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

/* ─── MAIN SETTINGS PAGE ────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState("profile");

  const CONTENT = {
    profile:  <ProfileSection user={user} />,
    notify:   <NotifySection />,
    security: <SecuritySection />,
    api:      <ApiSection />,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-white/40" />
          Settings
        </h2>
        <p className="text-sm text-white/40 mt-1">Manage your account and workspace preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar nav */}
        <Card className="lg:col-span-1 p-3 h-fit">
          <nav className="space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                    active === s.id
                      ? "bg-violet-500/10 border border-violet-500/20 text-white"
                      : "text-white/50 hover:text-white hover:bg-white/[0.05] border border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{s.label}</p>
                    <p className="text-[11px] text-white/30 truncate hidden sm:block">{s.desc}</p>
                  </div>
                  {active === s.id && <ChevronRight className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
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
