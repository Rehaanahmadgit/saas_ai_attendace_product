import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, Loader2, UserCheck, UserX, Pencil, Trash2,
  Shield, User, Mail, Lock, Building2, ChevronRight, CheckCircle2,
  ArrowLeft, AlertTriangle,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { usersApi, structureApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useHierarchy } from "@/hooks/useHierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// Department list loaded from API (falls back to empty)


const ROLE_META = {
  user:        { label: "User",        desc: "Can mark own attendance & view dashboard",           color: "text-slate-300  bg-slate-500/10  border-slate-500/20"  },
  staff:       { label: "Staff",       desc: "Can mark attendance for others & view analytics",    color: "text-cyan-300   bg-cyan-500/10   border-cyan-500/20"    },
  admin:       { label: "Admin",       desc: "Full access except org-level super admin actions",   color: "text-blue-300   bg-blue-500/10   border-blue-500/20"    },
  super_admin: { label: "Super Admin", desc: "Unrestricted access including billing & org mgmt",   color: "text-violet-300 bg-violet-500/10 border-violet-500/20" },
};

// Helper to get readable role name for custom roles
function getRoleLabel(role) {
  if (!role) return "—";
  return ROLE_META[role]?.label || role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getRoleDesc(role) {
  if (!role) return "";
  return ROLE_META[role]?.desc || "Custom role";
}

function getRoleMeta(role) {
  return ROLE_META[role] || { 
    label: getRoleLabel(role), 
    desc: "Custom role",
    color: "text-gray-300 bg-gray-500/10 border-gray-500/20"
  };
}

/* ─── STEP INDICATORS ──────────────────────────────────────────────────────── */
function StepDot({ step, current }) {
  const done = step < current;
  const active = step === current;
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
      done ? "bg-emerald-500 text-white" : active ? "bg-violet-500 text-white" : "bg-white/10 text-white/30"
    }`}>
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : step + 1}
    </div>
  );
}

/* ─── ADD USER MODAL — 3-STEP ONBOARDING ──────────────────────────────────── */
function AddUserModal({ onSave, onClose, loading, assignableRoles, depts = [] }) {
  const { labels } = useHierarchy();
  const STEPS = [
    { title: "Personal Info",  desc: "Name and email address" },
    { title: "Role & Access",  desc: "Set permissions level" },
    { title: "Confirmation",   desc: "Review and create" },
  ];

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user", department: "" });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: "" })); };

  const availableRoles = assignableRoles.length ? assignableRoles : ["user", "staff"];

  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.name.trim()) e.name = "Name is required";
      if (!form.email) e.email = "Email is required";
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
      if (!form.password) e.password = "Password is required";
      else if (form.password.length < 6) e.password = "Min 6 characters";
    }
    if (s === 1) {
      if (!form.role) e.role = "Role is required";
    }
    return e;
  };

  const next = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setStep(s => s + 1);
  };

  const back = () => setStep(s => s - 1);

  const submit = () => {
    onSave({ ...form, department: form.department || undefined });
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="glass rounded-2xl w-full max-w-lg relative z-10 overflow-hidden"
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header with step indicators */}
        <div className="p-6 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Add Team Member</h3>
                <p className="text-[11px] text-white/30">Step {step + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step track */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <StepDot step={i} current={step} />
                <div className="flex-1 min-w-0 hidden sm:block">
                  <p className={`text-xs font-medium truncate transition-colors ${i <= step ? "text-white" : "text-white/30"}`}>{s.title}</p>
                  <p className="text-[10px] text-white/20 truncate">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-shrink-0 w-4 mx-1 rounded-full transition-colors ${i < step ? "bg-emerald-500" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* Step 0: Personal Info */}
            {step === 0 && (
              <motion.div key="step0" className="space-y-4"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Input placeholder="Jane Smith" value={form.name} onChange={set("name")} className="pl-9" />
                  </div>
                  {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Work email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Input type="email" placeholder="jane@company.com" value={form.email} onChange={set("email")} className="pl-9" />
                  </div>
                  {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Temporary password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Input type="password" placeholder="Min. 6 characters" value={form.password} onChange={set("password")} className="pl-9" />
                  </div>
                  {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
                  <p className="text-[11px] text-white/25">The user should change this after first login.</p>
                </div>

                <div className="space-y-1.5">
                  <Label>{labels.department} <span className="text-white/20">(optional)</span></Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Select value={form.department} onChange={set("department")} className="pl-9">
                      <option value="">Select {labels.department.toLowerCase()}…</option>
                      {depts.map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
                  </div>
                </div>

                <Button variant="gradient" size="xl" className="w-full group" onClick={next}>
                  Continue <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </motion.div>
            )}

            {/* Step 1: Role Selection */}
            {step === 1 && (
              <motion.div key="step1" className="space-y-4"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <p className="text-sm text-white/50 mb-4">
                  Select the access level for <span className="text-white font-medium">{form.name}</span>.
                </p>
                <div className="space-y-2">
                  {availableRoles.map((role) => {
                    const meta = getRoleMeta(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => { setForm(p => ({ ...p, role })); setErrors(p => ({ ...p, role: "" })); }}
                        className={`w-full p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 flex items-start gap-3 ${
                          form.role === role
                            ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/30"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold transition-all ${meta.color}`}>
                          {form.role === role ? "✓" : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{meta.label}</p>
                            <Badge variant={role}>{role.replace("_", " ")}</Badge>
                          </div>
                          <p className="text-xs text-white/40 mt-0.5">{meta.desc}</p>
                        </div>
                        {form.role === role && <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
                {errors.role && <p className="text-xs text-red-400">{errors.role}</p>}

                <div className="flex gap-3">
                  <Button variant="outline" size="xl" className="flex-1" onClick={back}>
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button variant="gradient" size="xl" className="flex-[2] group" onClick={next}>
                    Review <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Confirmation */}
            {step === 2 && (
              <motion.div key="step2" className="space-y-4"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <div className="glass rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Review details</p>
                  {[
                    { label: "Name", value: form.name },
                    { label: "Email", value: form.email },
                    { label: "Role", value: getRoleLabel(form.role) },
                    { label: "Department", value: form.department || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-white/40">{label}</span>
                      <span className="text-xs font-medium text-white">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80">
                    The user will be able to sign in immediately with the temporary password you set. Remind them to update it via Settings.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="xl" className="flex-1" onClick={back} disabled={loading}>
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button variant="gradient" size="xl" className="flex-[2]" onClick={submit} disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : <><CheckCircle2 className="w-4 h-4" />Create User</>}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── EDIT USER MODAL ─────────────────────────────────────────────────────── */
function EditUserModal({ user, onSave, onClose, loading, assignableRoles, depts = [] }) {
  const { labels } = useHierarchy();
  const availableRoles = assignableRoles.length ? assignableRoles : ["user", "staff"];
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    department: user.department || "",
    is_active: user.is_active,
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: "" })); };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="glass rounded-2xl p-6 w-full max-w-md relative z-10"
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Edit {user.name}</h3>
              <p className="text-xs text-white/30">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input placeholder="Full name" value={form.name} onChange={set("name")} />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onChange={set("role")}>
              {availableRoles.map(r => (
                <option key={r} value={r}>{getRoleLabel(r)}</option>
              ))}
            </Select>
            {form.role && <p className="text-xs text-white/30 mt-1">{getRoleDesc(form.role)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>{labels.department}</Label>
            <Select value={form.department} onChange={set("department")}>
              <option value="">No {labels.department.toLowerCase()}</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <div>
              <p className="text-sm font-medium text-white">Account Status</p>
              <p className="text-xs text-white/30 mt-0.5">
                {form.is_active ? "Active — user can sign in" : "Inactive — login blocked"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${form.is_active ? "bg-emerald-500" : "bg-white/10"}`}
            >
              <motion.span
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ x: form.is_active ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="gradient" className="flex-1" disabled={loading} onClick={() => onSave(form)}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : "Update User"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── MAIN USERS PAGE ──────────────────────────────────────────────────────── */
export default function Users() {
  const { user: me, isSuperAdmin, assignableRoles, permissions } = useAuth();
  const { can } = usePermission();
  const { labels } = useHierarchy();
  const [users, setUsers]     = useState([]);
  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [modal, setModal]     = useState(null); // null | "add" | {user obj}
  const [search, setSearch]   = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [toast, setToast]     = useState({ type: "", msg: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // user id pending deletion

  // Roles available to filter by (all roles)
  const ALL_ROLES = Object.keys(permissions?.role_hierarchy ?? {
    user: 1, staff: 2, admin: 3, super_admin: 4,
  });

  // Fetch departments from real API
  useEffect(() => {
    structureApi.listDepartments().then(({ data }) => {
      if (data && data.length > 0) {
        setDepts(data.map(d => d.name));
      }
    }).catch(() => {}); // fallback to defaults
  }, []);


  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (roleFilter) p.role = roleFilter;
      const { data } = await usersApi.list(p);
      setUsers(data);
    } finally { setLoading(false); }
  }, [roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const notify = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast({ type: "", msg: "" }), 4000);
  };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal === "add") await usersApi.create(form);
      else await usersApi.update(modal.id, form);
      setModal(null);
      fetchUsers();
      notify("success", modal === "add" ? "User created successfully!" : "User updated!");
    } catch (err) {
      notify("error", err.response?.data?.detail || "Operation failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    setConfirmDeleteId(u.id);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await usersApi.remove(confirmDeleteId);
      setUsers(prev => prev.filter(x => x.id !== confirmDeleteId));
      setConfirmDeleteId(null);
      notify("success", "User removed");
    } catch (err) {
      notify("error", err.response?.data?.detail || "Delete failed");
      setConfirmDeleteId(null);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function getInitials(name = "") {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }

  // Color per role for avatar ring
  const roleColors = {
    super_admin: "from-violet-500 to-purple-700",
    admin:       "from-blue-500 to-indigo-600",
    staff:       "from-cyan-500 to-teal-600",
    user:        "from-slate-500 to-slate-600",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>User Management</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {users.length} member{users.length !== 1 ? "s" : ""} in your organization
          </p>
        </div>
        {can("users", "can_create") && (
          <Button variant="gradient" onClick={() => setModal("add")} className="gap-2">
            <Plus className="w-4 h-4" /> Add User
          </Button>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast.msg && (
          <motion.div
            className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm ${
              toast.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400"
                : "border-red-500/20 bg-red-500/[0.08] text-red-400"
            }`}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search name or email…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-40">
              <option value="">All roles</option>
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{getRoleLabel(r)}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-5 h-44 animate-pulse" />
            ))
          : filtered.map((u, i) => (
              <motion.div
                key={u.id}
                className="glass rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-200 group"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${roleColors[u.role] || roleColors.user} flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ring-2 ring-white/5`}>
                      {getInitials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{u.name}</p>
                      <p className="text-xs truncate max-w-[150px]" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setModal(u)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors"
                      title="Edit user"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== me?.id && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge variant={u.role}>{u.role.replace("_", " ")}</Badge>
                  {u.department && (
                    <span className="text-xs text-white/35 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                      {u.department}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <span className="text-[11px] text-white/25">
                    Joined {format(new Date(u.created_at), "MMM d, yyyy")}
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        await usersApi.update(u.id, { is_active: !u.is_active });
                        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
                      } catch { notify("error", "Update failed"); }
                    }}
                    disabled={u.id === me?.id}
                    className={`flex items-center gap-1 text-[11px] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      u.is_active ? "text-emerald-400 hover:text-red-400" : "text-red-400 hover:text-emerald-400"
                    }`}
                  >
                    {u.is_active
                      ? <><UserCheck className="w-3 h-3" />Active</>
                      : <><UserX className="w-3 h-3" />Inactive</>
                    }
                  </button>
                </div>
              </motion.div>
            ))
        }
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No users found</p>
          <p className="text-white/20 text-xs mt-1">Try adjusting your search or role filter</p>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal === "add" && (
          <AddUserModal
            onSave={handleSave}
            onClose={() => setModal(null)}
            loading={saving}
            assignableRoles={assignableRoles}
            depts={depts}
          />
        )}
        {modal !== null && modal !== "add" && (
          <EditUserModal
            user={modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            loading={saving}
            assignableRoles={assignableRoles}
            depts={depts}
          />
        )}
        {confirmDeleteId && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
            <motion.div className="glass rounded-2xl p-6 w-full max-w-sm relative z-10"
              initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Remove User</h3>
                  <p className="text-xs text-white/40">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-white/70 mb-5">
                Are you sure you want to remove <span className="font-semibold text-white">{users.find(u => u.id === confirmDeleteId)?.name}</span> from your organization?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Removing…</> : <><Trash2 className="w-4 h-4" />Remove</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
