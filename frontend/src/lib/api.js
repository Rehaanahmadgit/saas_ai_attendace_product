import axios from "axios";
import { getMemToken, setMemToken, clearMemToken } from "@/lib/token";

const http = axios.create({ baseURL: "/api" });

let _refreshing = false;
let _waiters = [];

// Inject auth token on every request
http.interceptors.request.use((cfg) => {
  const token = getMemToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-refresh on 401, with queue for concurrent requests
http.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    // Don't retry if it's already a retry OR if it's the refresh call itself failing
    if (err.response?.status === 401 && !original._retry && !original.url.includes("/auth/refresh")) {
      original._retry = true;

      if (_refreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          _waiters.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return http(original);
        });
      }

      _refreshing = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        // No refresh token — redirect to login
        window.location.href = "/login";
        return Promise.reject(err);
      }

      try {
        const { data } = await http.post("/auth/refresh", { refresh_token: refreshToken });
        setMemToken(data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);

        // Retry all waiting requests
        _waiters.forEach(w => w.resolve(data.access_token));
        _waiters = [];

        original.headers.Authorization = `Bearer ${data.access_token}`;
        return http(original);
      } catch (refreshErr) {
        _waiters.forEach(w => w.reject(refreshErr));
        _waiters = [];
        clearMemToken();
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        _refreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

// ── API surface ────────────────────────────────────────────────────────────────

export const authApi = {
  login:          (d)  => http.post("/auth/login", d),
  register:       (d)  => http.post("/auth/register", d),
  refresh:        (d)  => http.post("/auth/refresh", d),
  me:             ()   => http.get("/auth/me"),
  changePassword: (d)  => http.post("/auth/change-password", d),
  getOrgSettings: ()   => http.get("/auth/org-settings"),
  updateOrgSettings: (d) => http.patch("/auth/org-settings", d),
};

export const analyticsApi = {
  kpis:        ()       => http.get("/analytics/kpis"),
  trends:      (p)      => http.get("/analytics/trends", { params: p }),
  departments: (p)      => http.get("/analytics/departments", { params: p }),
  performance: (p)      => http.get("/analytics/user-performance", { params: p }),
};

export const attendanceApi = {
  mark:         (d)  => http.post("/attendance/mark", d),
  list:         (p)  => http.get("/attendance/", { params: p }),
  today:        (p)  => http.get("/attendance/today/summary", { params: p }),
  bulkMark:     (d)  => http.post("/attendance/bulk-mark", d),
  sectionStudents: (sectionId, p) => http.get(`/attendance/section/${sectionId}/students`, { params: p }),
};

export const permissionsApi = {
  me:    () => http.get("/permissions/me"),
  roles: () => http.get("/permissions/roles"),
  createRole: (d) => http.post("/permissions/roles", d),
  updateRole: (id, d) => http.put(`/permissions/roles/${id}`, d),
  deleteRole: (id) => http.delete(`/permissions/roles/${id}`),
  listRolePermissions: () => http.get("/permissions/role-permissions"),
  createRolePermission: (d) => http.post("/permissions/role-permissions", d),
  updateRolePermission: (id, d) => http.put(`/permissions/role-permissions/${id}`, d),
  deleteRolePermission: (id) => http.delete(`/permissions/role-permissions/${id}`),
};

export const permissionsApiClient = permissionsApi;

export const insightsApi = {
  list:     ()    => http.get("/insights/"),
  generate: ()    => http.post("/insights/generate"),
  markRead: (id)  => http.patch(`/insights/${id}/read`),
  summary:  ()    => http.get("/insights/summary"),
};

export const structureApi = {
  // Departments
  listDepartments:  (p)     => http.get("/structure/departments", { params: p }),
  createDepartment: (d)     => http.post("/structure/departments", d),
  updateDepartment: (id, d) => http.put(`/structure/departments/${id}`, d),
  deleteDepartment: (id)    => http.delete(`/structure/departments/${id}`),

  // Classes
  listClasses:  (p)     => http.get("/structure/classes", { params: p }),
  createClass:  (d)     => http.post("/structure/classes", d),
  updateClass:  (id, d) => http.put(`/structure/classes/${id}`, d),
  deleteClass:  (id)    => http.delete(`/structure/classes/${id}`),

  // Sections
  listSections:  (p)     => http.get("/structure/sections", { params: p }),
  createSection: (d)     => http.post("/structure/sections", d),
  updateSection: (id, d) => http.put(`/structure/sections/${id}`, d),
  deleteSection: (id)    => http.delete(`/structure/sections/${id}`),

  // Subjects
  listSubjects:  (p)     => http.get("/structure/subjects", { params: p }),
  createSubject: (d)     => http.post("/structure/subjects", d),
  updateSubject: (id, d) => http.put(`/structure/subjects/${id}`, d),
  deleteSubject: (id)    => http.delete(`/structure/subjects/${id}`),
};

export const devApi = {
  seed:     ()    => http.post("/dev/seed"),
};

export const usersApi = {
  list:   (p)       => http.get("/users", { params: p }),
  create: (d)       => http.post("/users", d),
  update: (id, d)   => http.put(`/users/${id}`, d),
  remove: (id)      => http.delete(`/users/${id}`),
  get:    (id)      => http.get(`/users/${id}`),
};

export const logsApi = {
  list: (p) => http.get("/logs", { params: p }),
};

export const studentsApi = {
  list:   (p)       => http.get("/students", { params: p }),
  get:    (id)      => http.get(`/students/${id}`),
  create: (d)       => http.post("/students", d),
  update: (id, d)   => http.put(`/students/${id}`, d),
  remove: (id)      => http.delete(`/students/${id}`),
};

export const onboardingApi = {
  getStatus:    ()  => http.get("/onboarding/status"),
  getChecklist: ()  => http.get("/onboarding/checklist"),
  setup:        (d) => http.post("/onboarding/setup", d),
  seedDefaults: ()  => http.post("/onboarding/seed-defaults"),
  complete:     ()  => http.post("/onboarding/complete"),
};

