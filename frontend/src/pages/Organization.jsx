import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Pencil, Trash2, CheckCircle2, AlertCircle,
  Loader2, ChevronRight, X, Users, BookOpen, LayoutGrid, ArrowLeft,
} from "lucide-react";
import { structureApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useHierarchy } from "@/hooks/useHierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast.msg) return null;
  return (
    <motion.div
      className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm ${
        toast.type === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/20 bg-red-500/10 text-red-400"
      }`}
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
    >
      {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {toast.msg}
    </motion.div>
  );
}

function useToast() {
  const [toast, setToast] = useState({ type: "", msg: "" });
  const notify = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast({ type: "", msg: "" }), 3500);
  };
  return { toast, notify };
}

function ItemCard({ title, subtitle, code, onEdit, onDelete, onClick, canEdit, children }) {
  return (
    <motion.div
      className="group relative rounded-2xl p-5 border cursor-pointer transition-all hover:border-violet-500/20"
      style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--surface-border)" }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{title}</h3>
          {code && (
            <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded border"
              style={{ color: "var(--text-muted)", borderColor: "var(--surface-border)" }}>
              {code}
            </span>
          )}
          {subtitle && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onEdit?.(); }}
              className="p-1.5 rounded-lg hover:bg-violet-500/10 hover:text-violet-400 transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete?.(); }}
              className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      {children}
      {onClick && (
        <div className="flex items-center justify-end mt-2">
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity"
            style={{ color: "var(--text-muted)" }} />
        </div>
      )}
    </motion.div>
  );
}

function FormModal({ title, fields, onClose, onSave, saving, error }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map(f => [f.key, f.default ?? ""]))
  );

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";
  const inputStyle = {
    backgroundColor: "var(--surface-card)",
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl border p-6 z-10"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {f.type === "select" ? (
                <select
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inputClass} style={inputStyle} required={f.required}
                >
                  <option value="">Select…</option>
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || "text"} value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className={inputClass} style={inputStyle}
                  required={f.required}
                />
              )}
            </div>
          ))}
          {error && (
            <div className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />{error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-sm border transition-colors"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Organization() {
  const { isAdmin } = useAuth();
  const { labels } = useHierarchy();
  const { toast, notify } = useToast();

  // Drill-down state
  const [view, setView] = useState("departments"); // "departments" | "classes" | "sections"
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const [departments, setDepts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // null | {type, data}
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canEdit = isAdmin;

  // ── Data fetching ────────────────────────────────────────────────────────────

  const loadDepts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await structureApi.listDepartments({ is_active: true });
      setDepts(data);
    } catch { notify("error", "Failed to load departments"); }
    finally { setLoading(false); }
  }, []);

  const loadClasses = useCallback(async (deptId) => {
    setLoading(true);
    try {
      const { data } = await structureApi.listClasses({ department_id: deptId, is_active: true });
      setClasses(data);
    } catch { notify("error", "Failed to load classes"); }
    finally { setLoading(false); }
  }, []);

  const loadSections = useCallback(async (classId) => {
    setLoading(true);
    try {
      const { data } = await structureApi.listSections({ class_id: classId, is_active: true });
      setSections(data);
    } catch { notify("error", "Failed to load sections"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDepts(); }, [loadDepts]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const drillToDept = (dept) => {
    setSelectedDept(dept);
    setView("classes");
    loadClasses(dept.id);
  };

  const drillToClass = (cls) => {
    setSelectedClass(cls);
    setView("sections");
    loadSections(cls.id);
  };

  const goBack = () => {
    if (view === "sections") { setView("classes"); setSelectedClass(null); }
    else if (view === "classes") { setView("departments"); setSelectedDept(null); }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const handleSave = async (form) => {
    setSaving(true);
    setError("");
    try {
      const editing = modal?.data;
      if (view === "departments") {
        if (editing) await structureApi.updateDepartment(editing.id, { name: form.name, code: form.code.toUpperCase() });
        else await structureApi.createDepartment({ name: form.name, code: form.code.toUpperCase(), description: form.description });
        notify("success", editing ? "Department updated" : "Department created");
        setModal(null);
        loadDepts();
      } else if (view === "classes") {
        if (editing) await structureApi.updateClass(editing.id, { name: form.name });
        else await structureApi.createClass({ department_id: selectedDept.id, name: form.name, academic_year: form.academic_year });
        notify("success", editing ? "Class updated" : "Class created");
        setModal(null);
        loadClasses(selectedDept.id);
      } else if (view === "sections") {
        if (editing) await structureApi.updateSection(editing.id, { name: form.name, room_no: form.room_no });
        else await structureApi.createSection({ class_id: selectedClass.id, name: form.name, room_no: form.room_no });
        notify("success", editing ? "Section updated" : "Section created");
        setModal(null);
        loadSections(selectedClass.id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this item?")) return;
    try {
      if (view === "departments") await structureApi.deleteDepartment(id);
      else if (view === "classes") await structureApi.deleteClass(id);
      else await structureApi.deleteSection(id);
      notify("success", "Removed successfully");
      if (view === "departments") loadDepts();
      else if (view === "classes") loadClasses(selectedDept.id);
      else loadSections(selectedClass.id);
    } catch (err) {
      notify("error", err.response?.data?.detail || "Delete failed");
    }
  };

  const openModal = (data = null) => {
    setError("");
    setModal({ data });
  };

  // ── Modal field definitions ───────────────────────────────────────────────────

  const getFields = () => {
    if (view === "departments") return [
      { key: "name", label: "Name", placeholder: "e.g. Science Department", required: true, default: modal?.data?.name || "" },
      { key: "code", label: "Code", placeholder: "e.g. SCI", required: true, default: modal?.data?.code || "" },
      { key: "description", label: "Description", placeholder: "Optional description", default: "" },
    ];
    if (view === "classes") return [
      { key: "name", label: "Class Name", placeholder: "e.g. Grade 10 / Class A", required: true, default: modal?.data?.name || "" },
      { key: "academic_year", label: "Academic Year", placeholder: "e.g. 2024-25", default: "" },
    ];
    return [
      { key: "name", label: "Section Name", placeholder: "e.g. A / Morning Shift", required: true, default: modal?.data?.name || "" },
      { key: "room_no", label: "Room No.", placeholder: "e.g. 101", default: modal?.data?.room_no || "" },
    ];
  };

  const getModalTitle = () => {
    const op = modal?.data ? "Edit" : "Add";
    if (view === "departments") return `${op} ${labels.department || "Department"}`;
    if (view === "classes") return `${op} ${labels.class_label || "Class"}`;
    return `${op} ${labels.section || "Section"}`;
  };

  const currentItems = view === "departments" ? departments : view === "classes" ? classes : sections;
  const addLabel = view === "departments" ? labels.department || "Department" : view === "classes" ? (labels.class_label || "Class") : (labels.section || "Section");

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Only admins can manage organization structure.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {view !== "departments" && (
            <button
              onClick={goBack}
              className="p-2 rounded-lg border transition-colors hover:border-violet-500/30"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-muted)" }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Organization Structure
            </h2>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              <span className={view === "departments" ? "text-violet-400" : "cursor-pointer hover:text-violet-400"}
                onClick={() => { setView("departments"); setSelectedDept(null); setSelectedClass(null); }}>
                Departments
              </span>
              {selectedDept && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className={view === "classes" ? "text-violet-400" : "cursor-pointer hover:text-violet-400"}
                    onClick={() => { setView("classes"); setSelectedClass(null); loadClasses(selectedDept.id); }}>
                    {selectedDept.name}
                  </span>
                </>
              )}
              {selectedClass && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-violet-400">{selectedClass.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add {addLabel}
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast.msg && <Toast toast={toast} />}
      </AnimatePresence>

      {/* Stats bar */}
      {view === "departments" && departments.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Departments", value: departments.length, icon: Building2, color: "violet" },
            { label: "Active", value: departments.filter(d => d.is_active).length, icon: CheckCircle2, color: "emerald" },
            { label: "Total Classes", value: "—", icon: LayoutGrid, color: "blue" },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="!py-4 !px-4">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
                <p className="text-2xl font-bold mt-1 text-violet-400">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--surface-card)" }} />
          ))}
        </div>
      ) : currentItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed"
          style={{ borderColor: "var(--surface-border)" }}>
          <Building2 className="w-10 h-10 mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
            No {addLabel.toLowerCase()}s yet
          </p>
          <button onClick={() => openModal()}
            className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
            Create the first {addLabel.toLowerCase()} →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentItems.map((item, i) => (
            <ItemCard
              key={item.id}
              title={item.name}
              code={item.code}
              subtitle={
                item.student_count !== undefined ? `${item.student_count} students` :
                item.grade_level ? `Grade ${item.grade_level}` :
                item.academic_year ? `AY: ${item.academic_year}` :
                item.room_no ? `Room ${item.room_no}` : undefined
              }
              canEdit={canEdit}
              onEdit={() => openModal(item)}
              onDelete={() => handleDelete(item.id)}
              onClick={view !== "sections" ? () => {
                if (view === "departments") drillToDept(item);
                else if (view === "classes") drillToClass(item);
              } : undefined}
            >
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                {view !== "sections" && (
                  <span className="flex items-center gap-1 text-violet-400/60">
                    View {view === "departments" ? "classes" : "sections"}
                    <ChevronRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </ItemCard>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal !== null && (
          <FormModal
            title={getModalTitle()}
            fields={getFields()}
            onClose={() => setModal(null)}
            onSave={handleSave}
            saving={saving}
            error={error}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
