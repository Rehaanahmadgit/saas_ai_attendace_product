import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, Loader2, CheckCircle2,
  ListFilter, Users, User, ChevronDown,
} from "lucide-react";
import { attendanceApi, usersApi, structureApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { Button }      from "@/components/ui/button";
import { Input }       from "@/components/ui/input";
import { Select }      from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge }       from "@/components/ui/badge";
import AttendanceWizard from "@/components/attendance/AttendanceWizard";
import { useHierarchy } from "@/hooks/useHierarchy";
import { format }      from "date-fns";

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  present:  "emerald",
  late:     "amber",
  absent:   "red",
  half_day: "blue",
};
const STATUS_ACTIVE_CLASSES = {
  present:  "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  late:     "bg-amber-500/20  text-amber-400   border-amber-500/40",
  absent:   "bg-red-500/20    text-red-400     border-red-500/40",
  half_day: "bg-blue-500/20   text-blue-400    border-blue-500/40",
};
// ── Self-mark modal (for students / basic users) ──────────────────────────────
function SelfMarkModal({ onMark, onClose, loading }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ status: "present", notes: "" });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <ModalShell onClose={onClose} title="Mark My Attendance">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center">
            <User className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-white/40">{user.email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-white/50">Status</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: "present",  label: "Present" },
              { v: "late",     label: "Late" },
              { v: "absent",   label: "Absent" },
              { v: "half_day", label: "Half Day" },
            ].map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setForm(p => ({ ...p, status: v }))}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  form.status === v
                    ? STATUS_ACTIVE_CLASSES[v]
                    : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-white/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-white/50">Notes (optional)</label>
          <Input placeholder="Any notes…" value={form.notes} onChange={set("notes")} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="gradient"
            className="flex-1"
            disabled={loading}
            onClick={() => onMark({ status: form.status, notes: form.notes })}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Marking…</>
              : "Mark Attendance"
            }
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Wizard modal shell (for staff/admin — opens AttendanceWizard) ─────────────
function WizardModal({ onClose, onComplete }) {
  return (
    <ModalShell onClose={onClose} title={null} wide>
      <AttendanceWizard onClose={onClose} onComplete={onComplete} />
    </ModalShell>
  );
}

// ── Reusable modal shell ──────────────────────────────────────────────────────
function ModalShell({ children, onClose, title, wide = false }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        className={`glass rounded-2xl p-6 relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"}`}
        initial={{ scale: 0.96, y: 14 }}
        animate={{ scale: 1,    y: 0  }}
        exit={{   scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { user, isStaff, isAdmin } = useAuth();
  const { can } = usePermission();
  const { labels } = useHierarchy();

  const [records,       setRecords]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [marking,       setMarking]       = useState(false);
  const [modal,         setModal]         = useState(null); // null | "self" | "wizard"
  const [toast,         setToast]         = useState({ type: "", msg: "" });
  const [search,        setSearch]        = useState("");
  const [sectionMap,    setSectionMap]    = useState({}); // id → name mapping
  const [todaySummary,  setTodaySummary]  = useState(null);
  const [summaryLoading,setSummaryLoading]= useState(true);
  const [filters,       setFilters]       = useState({
    status:     "",
    start_date: "",
    end_date:   "",
    section_id: "",
  });

  // ── Permission-based access ──────────────────────────────────
  const canMarkForOthers = can("attendance", "can_create");
  const canUseWizard = canMarkForOthers && (isStaff || isAdmin);

  const notify = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast({ type: "", msg: "" }), 4000);
  };

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params = filters.section_id ? { section_id: filters.section_id } : undefined;
      const { data } = await attendanceApi.today(params);
      setTodaySummary(data);
    } catch {
      setTodaySummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [filters.section_id]);

  // ── Fetch attendance records ─────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status)     params.status     = filters.status;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date)   params.end_date   = filters.end_date;
      if (filters.section_id) params.section_id = filters.section_id;
      const { data } = await attendanceApi.list(params);
      setRecords(data);
    } catch { /* axios interceptor handles 401 */ }
    finally  { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── Load sections mapping (staff/admin only) ─────────────────────────────
  useEffect(() => {
    if (!(isStaff || isAdmin)) return;
    (async () => {
      try {
        const { data } = await structureApi.listSections();
        const map = {};
        (data || []).forEach(s => { map[s.id] = s.name; });
        setSectionMap(map);
      } catch { /* ignore errors */ }
    })();
  }, [isStaff, isAdmin]);

  // ── Self-mark handler (student / user role) ──────────────────────────────
  const handleSelfMark = async (formData) => {
    setMarking(true);
    try {
      await attendanceApi.mark(formData);  // backend uses current user from auth token
      setModal(null);
      notify("success", "Attendance marked!");
      fetchRecords();
      fetchSummary();
    } catch (err) {
      notify("error", err.response?.data?.detail || "Failed to mark attendance");
    } finally {
      setMarking(false);
    }
  };

  // ── Wizard complete handler ──────────────────────────────────────────────
  const handleWizardComplete = () => {
    setModal(null);
    notify("success", "Attendance submitted for the section!");
    fetchRecords();
    fetchSummary();
  };

  // ── Client-side search filter ────────────────────────────────────────────
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (
      r.user_name.toLowerCase().includes(q) ||
      (r.department || "").toLowerCase().includes(q)
    );
  });

  // ── Summary counts from filtered records ─────────────────────────────────
  const counts = filtered.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-5"
    >

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Attendance</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {loading ? "Loading…" : `${filtered.length} records`}
          </p>
        </div>

        {/* Mark button — wizard for staff+, self-mark for students */}
        {can("attendance", "can_create") ? (
          canUseWizard ? (
            <Button variant="gradient" onClick={() => setModal("wizard")}>
              <Users className="w-4 h-4" />
              Mark Section
            </Button>
          ) : (
            <Button variant="gradient" onClick={() => setModal("self")}>
              <Plus className="w-4 h-4" />
              Mark My Attendance
            </Button>
          )
        ) : null}
      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast.msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-2 p-3 rounded-lg border text-sm
              ${toast.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400"
                : "border-red-500/20    bg-red-500/[0.08]    text-red-400"
              }`}
          >
            {toast.type === "success" && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Summary pills ── */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "present",  label: "Present",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
            { key: "late",     label: "Late",      color: "text-amber-400   bg-amber-500/10   border-amber-500/20"   },
            { key: "absent",   label: "Absent",    color: "text-red-400     bg-red-500/10     border-red-500/20"     },
            { key: "half_day", label: "Half Day",  color: "text-blue-400    bg-blue-500/10    border-blue-500/20"    },
          ].map(({ key, label, color }) => counts[key] ? (
            <span
              key={key}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}
            >
              {label}: {counts[key]}
            </span>
          ) : null)}
        </div>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder={`Search by name or ${labels.department.toLowerCase()}…`}
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={filters.status}
              onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              className="w-40"
            >
              <option value="">All statuses</option>
              {["present", "late", "absent", "half_day"].map(s => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </Select>

            <Select
              value={filters.section_id}
              onChange={e => setFilters(p => ({ ...p, section_id: e.target.value }))}
              className="w-40"
            >
              <option value="">All sections</option>
              {Object.entries(sectionMap).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>

            <Input
              type="date"
              className="w-40"
              value={filters.start_date}
              onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))}
            />
            <Input
              type="date"
              className="w-40"
              value={filters.end_date}
              onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))}
            />

            <Button
              variant="outline"
              onClick={() => setFilters({ status: "", start_date: "", end_date: "", section_id: "" })}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Records table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Member", "Date", "Check In", "Check Out", "Duration", "Section", "Status"].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[1, 2, 3, 4, 5, 6, 7].map(j => (
                      <td key={j} className="px-5 py-4">
                        <div
                          className="h-4 bg-white/[0.05] rounded animate-pulse"
                          style={{ width: `${50 + j * 8}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-white/30">
                        No attendance records found
                      </td>
                    </tr>
                  )
                  : filtered.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-white leading-none">{r.user_name}</p>
                        {r.department && (
                          <p className="text-xs text-white/35 mt-0.5">{r.department}</p>
                        )}
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
                      <td className="px-5 py-3.5 text-white/50 text-xs">
                        {r.section_id ? (sectionMap[r.section_id] || `Section ${r.section_id}`) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={STATUS_COLORS[r.status] || "default"}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal === "self" && (
          <SelfMarkModal
            onMark={handleSelfMark}
            onClose={() => setModal(null)}
            loading={marking}
          />
        )}
        {modal === "wizard" && (
          <WizardModal
            onClose={() => setModal(null)}
            onComplete={handleWizardComplete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}