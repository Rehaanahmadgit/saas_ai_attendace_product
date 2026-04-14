import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Plus, Search, X, Edit2, Trash2, AlertCircle, Loader2,
} from "lucide-react";
import { studentsApi, structureApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

// ── Shared input styles ───────────────────────────────────────────────────────
const inputClass =
  "w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";
const inputStyle = {
  backgroundColor: "var(--surface-card)",
  borderColor:     "var(--surface-border)",
  color:           "var(--text-primary)",
};

// ── Modal shell ───────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, maxWidth = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`relative w-full ${maxWidth} rounded-2xl border p-6 z-10 max-h-[90vh] overflow-y-auto`}
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map(e => e.msg || e).join("; ") : JSON.stringify(msg)}
    </div>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────
function CreateStudentModal({ sections, onClose, onCreated }) {
  const [form, setForm] = useState({
    section_id: "", name: "", email: "", password: "",
    enrollment_no: "", roll_no: "", gender: "",
    guardian_name: "", guardian_phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.section_id || !form.name || !form.email || !form.password || !form.enrollment_no) {
      setError("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      await studentsApi.create({ ...form, section_id: Number(form.section_id) });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Add Student" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Section <span className="text-red-400">*</span>
          </label>
          <select value={form.section_id} onChange={set("section_id")} className={inputClass} style={inputStyle} required>
            <option value="">Select section…</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>Section {s.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Full Name <span className="text-red-400">*</span>
            </label>
            <input value={form.name} onChange={set("name")} placeholder="Student name" className={inputClass} style={inputStyle} required />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Enrollment No. <span className="text-red-400">*</span>
            </label>
            <input value={form.enrollment_no} onChange={set("enrollment_no")} placeholder="ENR001" className={inputClass} style={inputStyle} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email <span className="text-red-400">*</span>
            </label>
            <input type="email" value={form.email} onChange={set("email")} placeholder="student@school.edu" className={inputClass} style={inputStyle} required />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Password <span className="text-red-400">*</span>
            </label>
            <input type="password" value={form.password} onChange={set("password")} placeholder="Min. 6 characters" className={inputClass} style={inputStyle} required minLength={6} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Roll No.</label>
            <input value={form.roll_no} onChange={set("roll_no")} placeholder="01" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Gender</label>
            <select value={form.gender} onChange={set("gender")} className={inputClass} style={inputStyle}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Guardian Name</label>
            <input value={form.guardian_name} onChange={set("guardian_name")} placeholder="Parent/Guardian" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Guardian Phone</label>
            <input value={form.guardian_phone} onChange={set("guardian_phone")} placeholder="+91 XXXXX XXXXX" className={inputClass} style={inputStyle} />
          </div>
        </div>

        <ErrorBanner msg={error} />

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm border transition-colors"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</> : "Add Student"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditStudentModal({ student, sections, onClose, onUpdated }) {
  // student here is a StudentListItem: { student_id, user_id, name, email, roll_no, enrollment_no, section_id }
  const [form, setForm] = useState({
    name:          student.name          || "",
    enrollment_no: student.enrollment_no || "",
    roll_no:       student.roll_no       || "",
    section_id:    student.section_id    ?? "",
    gender:        "",
    guardian_name:  "",
    guardian_phone: "",
  });
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(true);
  const [error, setError]         = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Fetch full student record to pre-fill optional fields
  useEffect(() => {
    studentsApi.get(student.student_id)
      .then(({ data }) => {
        setForm(f => ({
          ...f,
          gender:         data.gender         || "",
          guardian_name:  data.guardian_name  || "",
          guardian_phone: data.guardian_phone || "",
        }));
      })
      .catch(() => { /* non-critical — fields will just be empty */ })
      .finally(() => setFetching(false));
  }, [student.student_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.enrollment_no || !form.section_id) {
      setError("Name, enrollment number, and section are required");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name:          form.name,
        enrollment_no: form.enrollment_no,
        roll_no:       form.roll_no       || null,
        section_id:    Number(form.section_id),
        gender:        form.gender        || null,
        guardian_name: form.guardian_name  || null,
        guardian_phone:form.guardian_phone || null,
      };
      await studentsApi.update(student.student_id, payload);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Edit Student" onClose={onClose}>
      {fetching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Read-only email */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email (read-only)</label>
            <input
              value={student.email}
              readOnly
              className={inputClass}
              style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Section <span className="text-red-400">*</span>
            </label>
            <select value={form.section_id} onChange={set("section_id")} className={inputClass} style={inputStyle} required>
              <option value="">Select section…</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>Section {s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Full Name <span className="text-red-400">*</span>
              </label>
              <input value={form.name} onChange={set("name")} placeholder="Student name" className={inputClass} style={inputStyle} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Enrollment No. <span className="text-red-400">*</span>
              </label>
              <input value={form.enrollment_no} onChange={set("enrollment_no")} placeholder="ENR001" className={inputClass} style={inputStyle} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Roll No.</label>
              <input value={form.roll_no} onChange={set("roll_no")} placeholder="01" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Gender</label>
              <select value={form.gender} onChange={set("gender")} className={inputClass} style={inputStyle}>
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Guardian Name</label>
              <input value={form.guardian_name} onChange={set("guardian_name")} placeholder="Parent/Guardian" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Guardian Phone</label>
              <input value={form.guardian_phone} onChange={set("guardian_phone")} placeholder="+91 XXXXX XXXXX" className={inputClass} style={inputStyle} />
            </div>
          </div>

          <ErrorBanner msg={error} />

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-sm border transition-colors"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ student, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await studentsApi.remove(student.student_id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to deactivate student");
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Deactivate Student" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Are you sure you want to deactivate{" "}
          <strong style={{ color: "var(--text-primary)" }}>{student.name}</strong>?
          Their login and attendance records will be preserved but they will no longer appear in active lists.
        </p>

        <ErrorBanner msg={error} />

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm border transition-colors"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Deactivating…</> : "Deactivate"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Student row ───────────────────────────────────────────────────────────────
function StudentRow({ student, onEdit, onDelete, canEdit }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-t transition-colors hover:bg-surface-hover"
      style={{ borderTopColor: "var(--surface-border)" }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
            {(student.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{student.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{student.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
          {student.enrollment_no}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {student.roll_no || "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Section {student.section_id}
        </span>
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(student)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
              title="Edit student"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(student)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Deactivate student"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      )}
    </motion.tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Students() {
  const { isAdmin, hasPermission } = useAuth();

  const [students, setStudents]         = useState([]);
  const [sections, setSections]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [pageError, setPageError]       = useState(null);

  // Modal state: null | { mode: "create" | "edit" | "delete", student?: ... }
  const [modal, setModal] = useState(null);

  const canCreate = isAdmin || hasPermission("students", "can_create");
  const canEdit   = isAdmin || hasPermission("students", "can_edit");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params = {};
      if (sectionFilter) params.section_id = sectionFilter;
      const { data } = await studentsApi.list(params);
      setStudents(data);
    } catch {
      setPageError("Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [sectionFilter]);

  useEffect(() => {
    loadStudents();
    structureApi.listSections().then(({ data }) => setSections(data)).catch(() => {});
  }, [loadStudents]);

  const filtered = students.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.enrollment_no?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit   = (student) => setModal({ mode: "edit",   student });
  const openDelete = (student) => setModal({ mode: "delete", student });
  const closeModal = ()        => setModal(null);

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
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Students</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {loading ? "Loading…" : `${students.length} student${students.length !== 1 ? "s" : ""} registered`}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="!py-4 !px-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, enrollment no…"
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                style={inputStyle}
              />
            </div>
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              style={inputStyle}
            >
              <option value="">All Sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>Section {s.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Page-level error */}
      {pageError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {pageError}
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderBottomColor: "var(--surface-border)" }}>
                {["Student", "Enrollment No.", "Roll No.", "Section", ...(canEdit ? ["Actions"] : [])].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="border-t" style={{ borderTopColor: "var(--surface-border)" }}>
                    {[1, 2, 3, 4].map(j => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-16 text-center">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p style={{ color: "var(--text-secondary)" }}>
                      {search ? "No students match your search" : "No students registered yet"}
                    </p>
                    {canCreate && !search && (
                      <button
                        onClick={() => setModal({ mode: "create" })}
                        className="mt-3 text-sm text-violet-400 hover:text-violet-300"
                      >
                        Add your first student →
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(student => (
                  <StudentRow
                    key={student.student_id}
                    student={student}
                    canEdit={canEdit}
                    onEdit={openEdit}
                    onDelete={openDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <AnimatePresence>
        {modal?.mode === "create" && (
          <CreateStudentModal
            key="create"
            sections={sections}
            onClose={closeModal}
            onCreated={loadStudents}
          />
        )}
        {modal?.mode === "edit" && (
          <EditStudentModal
            key="edit"
            student={modal.student}
            sections={sections}
            onClose={closeModal}
            onUpdated={loadStudents}
          />
        )}
        {modal?.mode === "delete" && (
          <DeleteConfirmModal
            key="delete"
            student={modal.student}
            onClose={closeModal}
            onDeleted={loadStudents}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
