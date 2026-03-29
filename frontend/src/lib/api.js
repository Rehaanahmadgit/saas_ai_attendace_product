import axios from "axios";

const http = axios.create({ baseURL: "/api" });

// Inject auth token on every request
http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-logout on 401
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── API surface ────────────────────────────────────────────────────────────────

export const authApi = {
  login:          (d)  => http.post("/auth/login", d),
  register:       (d)  => http.post("/auth/register", d),
  me:             ()   => http.get("/auth/me"),
  changePassword: (d)  => http.post("/auth/change-password", d),
};

export const analyticsApi = {
  kpis:        ()       => http.get("/analytics/kpis"),
  trends:      (p)      => http.get("/analytics/trends", { params: p }),
  departments: (p)      => http.get("/analytics/departments", { params: p }),
  performance: (p)      => http.get("/analytics/user-performance", { params: p }),
};

export const attendanceApi = {
  mark:     (d)  => http.post("/attendance/mark", d),
  list:     (p)  => http.get("/attendance/", { params: p }),
  today:    ()   => http.get("/attendance/today/summary"),
};

export const insightsApi = {
  list:     ()    => http.get("/insights/"),
  generate: ()    => http.post("/insights/generate"),
  markRead: (id)  => http.patch(`/insights/${id}/read`),
  summary:  ()    => http.get("/insights/summary"),
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

export const permissionsApi = {
  me:    () => http.get("/permissions/me"),
  roles: () => http.get("/permissions/roles"),
};

export const devApi = {
  seed: () => http.post("/dev/seed"),
};
