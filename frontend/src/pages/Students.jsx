import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Plus, Search, X, ChevronDown, Users,
  BookOpen, Hash, Mail, Phone, Edit2, Trash2, AlertCircle,
} from "lucide-react";
import { studentsApi, structureApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS = {
  true:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  false: "text-red-400 bg-red-500/10 border-red-500/20",
};

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

function CreateStudentModal({ sections, onClose, onCreated }) {
  const [form, setForm] = useState({
    section_id: "", name: "", email: "", password: "",
    enrollment_no: "", roll_no: "", gender: "",
    guardian_name: "", guardian_phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";
  const inputStyle = {
    backgroundColor: "var(--surface-card)",
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
  };

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
        className="relative w-full max-w-lg rounded-2xl border p-6 z-10 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add Student</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Section <span className="text-red-400">*</span>
            </label>
            <select
              value={form.section_id}
              onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              required
            >
              <option value="">Select section…</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name} (Section ID: {s.id})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Student name" className={inputClass} style={inputStyle} required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Enrollment No. <span className="text-red-400">*</span>
              </label>
              <input
                value={form.enrollment_no} onChange={e => setForm(f => ({ ...f, enrollment_no: e.target.value }))}
                placeholder="ENR001" className={inputClass} style={inputStyle} required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="student@school.edu" className={inputClass} style={inputStyle} required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min. 6 characters" className={inputClass} style={inputStyle} required minLength={6}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Roll No.</label>
              <input
                value={form.roll_no} onChange={e => setForm(f => ({ ...f, roll_no: e.target.value }))}
                placeholder="01" className={inputClass} style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Gender</label>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className={inputClass} style={inputStyle}>
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
              <input
                value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))}
                placeholder="Parent/Guardian" className={inputClass} style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Guardian Phone</label>
              <input
                value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))}
                placeholder="+91 XXXXX XXXXX" className={inputClass} style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-sm border transition-colors"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors">
              {loading ? "Adding…" : "Add Student"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function Students() {
  const { isAdmin, isStaff, hasPermission } = useAuth();
  const [students, setStudents]     = useState([]);
  const [sections, setSections]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError]           = useState(null);

  const canCreate = isAdmin || hasPermission("students", "can_create");
  const canEdit   = isAdmin || hasPermission("students", "can_edit");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (sectionFilter) params.section_id = sectionFilter;
      const { data } = await studentsApi.list(params);
      setStudents(data);
    } catch {
      setError("Failed to load students");
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
            onClick={() => setShowCreate(true)}
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
                style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              />
            </div>
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
            >
              <option value="">All Sections</option>
              {sections.map(s => <option key={s.id} value={s.id}>Section {s.name} (ID: {s.id})</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderBottomColor: "var(--surface-border)" }}>
                {["Student", "Enrollment No.", "Roll No.", "Section", canEdit && "Actions"].filter(Boolean).map(h => (
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
                        onClick={() => setShowCreate(true)}
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
                    key={student.student_id || student.user_id}
                    student={student}
                    canEdit={canEdit}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateStudentModal
            sections={sections}
            onClose={() => setShowCreate(false)}
            onCreated={loadStudents}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
