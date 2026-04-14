/**
 * AttendanceWizard.jsx
 * Step-by-step attendance marking:
 * 1. Select Department
 * 2. Select Class
 * 3. Select Section + (optional) Subject
 * 4. Mark each student present/late/absent
 * 5. Submit bulk
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Check, Loader2,
  Users, BookOpen, Building2, GraduationCap, X
} from "lucide-react";
import { structureApi, attendanceApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const STATUS_CONFIG = {
  present: { label: "P", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", full: "Present" },
  late: { label: "L", color: "bg-amber-500/20  text-amber-400  border-amber-500/30", full: "Late" },
  absent: { label: "A", color: "bg-red-500/20    text-red-400    border-red-500/30", full: "Absent" },
  half_day: { label: "H", color: "bg-blue-500/20   text-blue-400   border-blue-500/30", full: "Half Day" },
};

import { useHierarchy } from "@/hooks/useHierarchy";

export default function AttendanceWizard({ onComplete, onClose }) {
  const { user, isStaff } = useAuth();
  const { labels } = useHierarchy();
  // True only for the "staff" role — admins/super_admins can see all sections
  const isStaffOnly = user?.role === "staff";

  const STEPS = [
    { id: "dept", label: labels.department, icon: Building2 },
    { id: "class", label: labels.class, icon: GraduationCap },
    { id: "section", label: labels.section, icon: BookOpen },
    { id: "mark", label: "Mark", icon: Users },
  ];

  const [step, setStep] = useState(0);
  const [depts, setDepts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);  // [{student_id, name, roll_no, attendance}]

  const [selDept, setSelDept] = useState(null);
  const [selClass, setSelClass] = useState(null);
  const [selSection, setSelSection] = useState(null);
  const [selSubject, setSelSubject] = useState(null);
  const [markDate, setMarkDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // attendance state: { [user_id]: status }
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 0: load departments
  useEffect(() => {
    structureApi.listDepartments({ is_active: true })
      .then(({ data }) => setDepts(data))
      .catch(() => { });
  }, []);

  // Step 1: load classes when dept selected
  useEffect(() => {
    if (!selDept) return;
    setLoading(true);
    setClasses([]); setSelClass(null);
    structureApi.listClasses({ department_id: selDept.id, is_active: true })
      .then(({ data }) => setClasses(data))
      .finally(() => setLoading(false));
  }, [selDept]);

  // Step 2: load sections when class selected
  // Staff users only see sections they are assigned to (my_sections=true)
  useEffect(() => {
    if (!selClass) return;
    setLoading(true);
    setSections([]); setSelSection(null);
    const params = { class_id: selClass.id, is_active: true };
    if (isStaffOnly) params.my_sections = true;
    structureApi.listSections(params)
      .then(({ data }) => setSections(data))
      .finally(() => setLoading(false));
  }, [selClass, isStaffOnly]);

  // Step 2 also: load subjects for the department
  useEffect(() => {
    if (!selDept) return;
    structureApi.listSubjects({ department_id: selDept.id, is_active: true })
      .then(({ data }) => setSubjects(data))
      .catch(() => setSubjects([]));
  }, [selDept]);

  // Step 3: load students with today's attendance when section selected
  useEffect(() => {
    if (!selSection) return;
    loadStudents();
  }, [selSection, markDate, selSubject]);

  async function loadStudents() {
    if (!selSection) return;
    setLoading(true);
    try {
      const params = {};
      if (markDate) params.date = markDate;
      if (selSubject) params.subject_id = selSubject.id;
      const { data } = await attendanceApi.sectionStudents(selSection.id, params);
      setStudents(data);
      // Pre-fill already marked attendance
      const pre = {};
      data.forEach(s => {
        if (s.attendance?.marked) pre[s.user_id] = s.attendance.status || "present";
        else pre[s.user_id] = "present"; // default
      });
      setAttendance(pre);
    } catch {
      setError("Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  function setStatus(userId, status) {
    setAttendance(p => ({ ...p, [userId]: status }));
  }

  function markAll(status) {
    const all = {};
    students.forEach(s => { all[s.user_id] = status; });
    setAttendance(all);
  }

  async function submitAttendance() {
    if (!selSection) return;
    setSubmitting(true);
    setError("");
    try {
      const records = students.map(s => ({
        user_id: s.user_id,
        status: attendance[s.user_id] || "absent",
        notes: null,
      }));
      await attendanceApi.bulkMark({
        section_id: selSection.id,
        date: markDate || null,
        subject_id: selSubject?.id ?? null,
        records,
      });
      onComplete?.();
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 409) {
        setError("Attendance already recorded for one or more students today. Reload and try again.");
      } else if (status === 403) {
        setError(typeof detail === "string" ? detail : "You don't have permission to mark attendance for this section.");
      } else if (status === 422) {
        // Pydantic validation error — show a friendly fallback instead of raw field errors
        setError("Submission failed due to a validation error. Please refresh and try again.");
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Failed to submit attendance. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const markedCount = Object.values(attendance).filter(s => s !== null).length;
  const presentCount = Object.values(attendance).filter(s => s === "present").length;
  const absentCount = Object.values(attendance).filter(s => s === "absent").length;
  const lateCount = Object.values(attendance).filter(s => s === "late").length;

  return (
    <div
      style={{ minHeight: 520 }}
      className="flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Mark Attendance</h3>
          <p className="text-xs text-white/40 mt-0.5">
            {selDept ? `${selDept.name}` : ""}
            {selClass ? ` › ${selClass.name}` : ""}
            {selSection ? ` › Section ${selSection.name}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => done && setStep(i)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer
                  ${current ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" :
                    done ? "text-white/60 hover:text-white" :
                      "text-white/25 cursor-not-allowed"}`}
                disabled={!done}
              >
                {done
                  ? <Check className="w-3 h-3 text-emerald-400" />
                  : <Icon className="w-3 h-3" />
                }
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-white/20 mx-1 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {/* ── Step 0: Department ── */}
          {step === 0 && (
            <motion.div key="dept"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="space-y-2"
            >
              <p className="text-xs text-white/40 mb-3">Select a department</p>
              {depts.length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm">
                  No departments found. Create one in Settings first.
                </div>
              )}
              {depts.map(d => (
                <button key={d.id} onClick={() => { setSelDept(d); setStep(1); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/40 hover:bg-violet-500/[0.05] transition-all text-left cursor-pointer group">
                  <div>
                    <p className="text-sm font-medium text-white">{d.name}</p>
                    <p className="text-xs text-white/40">{d.code}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-400 transition-colors" />
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Step 1: Class ── */}
          {step === 1 && (
            <motion.div key="class"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="space-y-2"
            >
              <p className="text-xs text-white/40 mb-3">
                Select a class in <strong className="text-white/60">{selDept?.name}</strong>
              </p>
              {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>}
              {!loading && classes.length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm">No classes in this department.</div>
              )}
              {!loading && classes.map(c => (
                <button key={c.id} onClick={() => { setSelClass(c); setStep(2); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/40 hover:bg-violet-500/[0.05] transition-all text-left cursor-pointer group">
                  <div>
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    {c.academic_year && <p className="text-xs text-white/40">{c.academic_year}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-400 transition-colors" />
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Step 2: Section + optional subject + date ── */}
          {step === 2 && (
            <motion.div key="section"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="space-y-4"
            >
              <p className="text-xs text-white/40">
                Select section in <strong className="text-white/60">{selClass?.name}</strong>
              </p>

              {/* Date picker */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-white/40 whitespace-nowrap">Date</label>
                <input
                  type="date"
                  value={markDate}
                  onChange={e => setMarkDate(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:border-violet-500/50"
                />
              </div>

              {/* Subject (optional) */}
              {subjects.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-1.5">Subject (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelSubject(null)}
                      className={`px-3 py-1 rounded-full text-xs border transition-all cursor-pointer
                        ${!selSubject ? "bg-violet-500/20 text-violet-300 border-violet-500/30" : "text-white/40 border-white/10 hover:border-white/20"}`}
                    >
                      All subjects
                    </button>
                    {subjects.map(s => (
                      <button key={s.id}
                        onClick={() => setSelSubject(prev => prev?.id === s.id ? null : s)}
                        className={`px-3 py-1 rounded-full text-xs border transition-all cursor-pointer
                          ${selSubject?.id === s.id ? "bg-violet-500/20 text-violet-300 border-violet-500/30" : "text-white/40 border-white/10 hover:border-white/20"}`}
                      >
                        {s.code} — {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {loading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>}
                {!loading && sections.length === 0 && (
                  <div className="text-center py-8 text-white/30 text-sm">
                    {isStaffOnly
                      ? "No sections assigned to you in this class. Ask an admin to assign you."
                      : "No sections in this class."}
                  </div>
                )}
                {!loading && sections.map(sec => (
                  <button key={sec.id}
                    onClick={() => { setSelSection(sec); setStep(3); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/40 hover:bg-violet-500/[0.05] transition-all text-left cursor-pointer group">
                    <div>
                      <p className="text-sm font-medium text-white">Section {sec.name}</p>
                      <p className="text-xs text-white/40">
                        {sec.student_count} students
                        {sec.room_no ? ` · Room ${sec.room_no}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-400 transition-colors" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Mark students ── */}
          {step === 3 && (
            <motion.div key="mark"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="flex flex-col gap-4"
            >
              {/* Context bar */}
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-xs text-white/40">
                  <span>Present: <strong className="text-emerald-400">{presentCount}</strong></span>
                  <span>Late: <strong className="text-amber-400">{lateCount}</strong></span>
                  <span>Absent: <strong className="text-red-400">{absentCount}</strong></span>
                </div>
                <div className="flex gap-1.5">
                  {["present", "late", "absent"].map(s => (
                    <button key={s} onClick={() => markAll(s)}
                      className={`px-2 py-1 rounded text-[10px] border cursor-pointer transition-all ${STATUS_CONFIG[s].color}`}>
                      All {STATUS_CONFIG[s].full}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student list */}
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                </div>
              )}
              {!loading && (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {students.map((s, i) => {
                    const currentStatus = attendance[s.user_id];
                    const alreadyMarked = s.attendance?.marked === true;
                    return (
                      <motion.div key={s.student_id || s.user_id || i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-colors
                          ${alreadyMarked ? "bg-white/[0.02] border-white/[0.04] opacity-60" : "bg-white/[0.03] border-white/[0.06]"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs text-white/50 font-mono">
                            {s.roll_no || (i + 1)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white leading-none">{s.name}</p>
                            {alreadyMarked && (
                              <p className="text-[10px] text-white/30 mt-0.5">Already marked</p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                            <button
                              key={status}
                              disabled={alreadyMarked}
                              onClick={() => setStatus(s.user_id, status)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all cursor-pointer
                                ${currentStatus === status
                                  ? cfg.color
                                  : "text-white/20 border-white/[0.06] hover:border-white/20 hover:text-white/40"}
                                ${alreadyMarked ? "cursor-not-allowed" : ""}`}
                            >
                              {cfg.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.06]">
        <Button variant="outline" size="sm"
          onClick={() => step > 0 ? setStep(s => s - 1) : onClose?.()}
          className="flex items-center gap-1.5"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step === 3 ? (
          <Button variant="gradient" size="sm" onClick={submitAttendance} disabled={submitting || students.length === 0}
            className="flex items-center gap-1.5">
            {submitting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Submitting…</>
              : <><Check className="w-3.5 h-3.5" />Submit ({students.filter(s => !s.attendance?.marked).length} students)</>
            }
          </Button>
        ) : (
          <p className="text-xs text-white/30">
            {step === 0 && `Select a ${labels.department.toLowerCase()} to continue`}
            {step === 1 && `Select a ${labels.class.toLowerCase()}`}
            {step === 2 && `Select a ${labels.section.toLowerCase()}`}
          </p>
        )}
      </div>
    </div>
  );
}