import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Filter, Search, ChevronDown, Clock, CalendarDays, Loader2, X } from "lucide-react";
import { attendanceApi, usersApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const STATUS_OPTS = ["", "present", "late", "absent", "half_day"];

function MarkModal({ users, onMark, onClose, loading }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    user_id: user.id,
    status: "present",
    notes: "",
  });

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="glass rounded-2xl p-6 w-full max-w-md relative z-10"
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Mark Attendance</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {users.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm text-white/60">Employee</label>
              <Select value={form.user_id} onChange={set("user_id")}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm text-white/60">Status</label>
            <Select value={form.status} onChange={set("status")}>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/60">Notes (optional)</label>
            <Input placeholder="Any notes…" value={form.notes} onChange={set("notes")} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="gradient" className="flex-1" disabled={loading}
              onClick={() => onMark({ ...form, user_id: Number(form.user_id) })}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Marking…</> : "Mark Attendance"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Attendance() {
  const { user, isStaff } = useAuth();
  const [records, setRecords]     = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [marking, setMarking]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [search, setSearch]       = useState("");
  const [filters, setFilters]     = useState({ status: "", start_date: "", end_date: "" });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status)     params.status = filters.status;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date)   params.end_date = filters.end_date;
      const { data } = await attendanceApi.list(params);
      setRecords(data);
    } catch { /* handled by interceptor */ }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (isStaff) {
      usersApi.list().then(({ data }) => setUsers(data)).catch(() => {});
    } else {
      setUsers([{ id: user.id, name: user.name }]);
    }
  }, [isStaff, user]);

  const handleMark = async (formData) => {
    setMarking(true);
    setError(""); setSuccess("");
    try {
      await attendanceApi.mark(formData);
      setSuccess("Attendance marked successfully!");
      setShowModal(false);
      fetchRecords();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to mark attendance");
    } finally {
      setMarking(false);
    }
  };

  const filtered = records.filter(r =>
    r.user_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.department || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Attendance</h2>
          <p className="text-sm text-white/40">{filtered.length} records found</p>
        </div>
        <Button variant="gradient" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Mark Attendance
        </Button>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-3 rounded-lg border border-red-500/20 bg-red-500/[0.08] text-sm text-red-400">
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] text-sm text-emerald-400">
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input placeholder="Search by name or department…"
                className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className="w-40">
              <option value="">All statuses</option>
              {["present","late","absent","half_day"].map(s => (
                <option key={s} value={s}>{s.replace("_"," ")}</option>
              ))}
            </Select>
            <Input type="date" className="w-40" value={filters.start_date}
              onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} />
            <Input type="date" className="w-40" value={filters.end_date}
              onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} />
            <Button variant="outline" size="default"
              onClick={() => setFilters({ status: "", start_date: "", end_date: "" })}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Employee","Date","Check In","Check Out","Duration","Status"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[1,2,3,4,5,6].map(j => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-white/[0.05] rounded animate-pulse" style={{ width: `${60 + j*10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
                : filtered.length === 0
                  ? <tr><td colSpan={6} className="text-center py-12 text-white/30">No attendance records found</td></tr>
                  : filtered.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-medium text-white">{r.user_name}</p>
                          {r.department && <p className="text-xs text-white/35">{r.department}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-white/70">
                        {format(new Date(r.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-5 py-3.5 text-white/70">
                        {r.check_in ? format(new Date(r.check_in), "h:mm a") : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-white/70">
                        {r.check_out ? format(new Date(r.check_out), "h:mm a") : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-white/70">
                        {r.duration_hours ? `${r.duration_hours}h` : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={r.status}>{r.status.replace("_"," ")}</Badge>
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mark Modal */}
      <AnimatePresence>
        {showModal && (
          <MarkModal
            users={users}
            onMark={handleMark}
            onClose={() => setShowModal(false)}
            loading={marking}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
