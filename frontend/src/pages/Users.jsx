import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, X, Loader2, UserCheck, UserX, Pencil, Trash2, Shield } from "lucide-react";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const ROLES = ["user", "staff", "admin", "super_admin"];
const DEPTS = ["Engineering", "Sales", "HR", "Operations", "Marketing", "Finance"];

function UserModal({ initial, onSave, onClose, loading }) {
  const [form, setForm] = useState(initial || { name: "", email: "", password: "", role: "user", department: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const isEdit = !!initial;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="glass rounded-2xl p-6 w-full max-w-md relative z-10"
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">{isEdit ? "Edit User" : "Add New User"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input placeholder="Jane Smith" value={form.name} onChange={set("name")} />
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="jane@acme.com" value={form.email} onChange={set("email")} />
            </div>
          )}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" placeholder="min 6 characters" value={form.password} onChange={set("password")} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onChange={set("role")}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace("_"," ")}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department} onChange={set("department")}>
                <option value="">Select…</option>
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="gradient" className="flex-1" disabled={loading} onClick={() => onSave(form)}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : (isEdit ? "Update" : "Create User")}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Users() {
  const { user: me, isSuperAdmin } = useAuth();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [modal, setModal]     = useState(null); // null | "add" | {user obj}
  const [search, setSearch]   = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [toast, setToast]     = useState({ type: "", msg: "" });

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
      notify("success", modal === "add" ? "User created!" : "User updated!");
    } catch (err) {
      notify("error", err.response?.data?.detail || "Operation failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Remove ${u.name}? This cannot be undone.`)) return;
    try {
      await usersApi.remove(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      notify("success", "User removed");
    } catch (err) {
      notify("error", err.response?.data?.detail || "Delete failed");
    }
  };

  const handleToggle = async (u) => {
    try {
      await usersApi.update(u.id, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
    } catch { notify("error", "Update failed"); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function getInitials(name = "") {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">User Management</h2>
          <p className="text-sm text-white/40">{users.length} members in your organization</p>
        </div>
        <Button variant="gradient" onClick={() => setModal("add")}>
          <Plus className="w-4 h-4" />Add User
        </Button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast.msg && (
          <motion.div
            className={`p-3 rounded-lg border text-sm ${toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400" : "border-red-500/20 bg-red-500/[0.08] text-red-400"}`}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
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
              <Input placeholder="Search name or email…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-40">
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.replace("_"," ")}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 h-40 animate-pulse" />
          ))
          : filtered.map((u, i) => (
            <motion.div
              key={u.id}
              className="glass rounded-2xl p-5 hover:border-white/[0.12] transition-colors"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {getInitials(u.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{u.name}</p>
                    <p className="text-xs text-white/40 truncate max-w-[150px]">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setModal(u)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {u.id !== me?.id && (
                    <button onClick={() => handleDelete(u)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge variant={u.role}>{u.role.replace("_", " ")}</Badge>
                {u.department && <span className="text-xs text-white/35">{u.department}</span>}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/25">
                  Joined {format(new Date(u.created_at), "MMM d, yyyy")}
                </span>
                <button
                  onClick={() => handleToggle(u)}
                  className={`flex items-center gap-1 text-[11px] cursor-pointer transition-colors ${u.is_active ? "text-emerald-400 hover:text-red-400" : "text-red-400 hover:text-emerald-400"}`}
                >
                  {u.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                  {u.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </motion.div>
          ))
        }
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-white/30 text-sm">No users found</div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal !== null && (
          <UserModal
            initial={modal === "add" ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
