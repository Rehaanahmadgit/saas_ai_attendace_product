import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_LABELS = {
  school:  { department: "Department", class: "Class",   section: "Section", subject: "Subject" },
  office:  { department: "Team",       class: "Project", section: "Sub-team", subject: "Task" },
  college: { department: "Faculty",    class: "Batch",   section: "Group",   subject: "Course" },
};

export function useHierarchy() {
  const { user } = useAuth();
  
  const orgType = user?.org_type || "office";
  const settings = user?.settings || {};
  const defaults = DEFAULT_LABELS[orgType] || DEFAULT_LABELS.office;

  const labels = {
    department: settings.label_department || defaults.department,
    class:      settings.label_class      || defaults.class,
    section:    settings.label_section    || defaults.section,
    subject:    settings.label_subject    || defaults.subject,
  };

  return {
    labels,
    orgType,
    get: (key) => labels[key] || key,
  };
}
