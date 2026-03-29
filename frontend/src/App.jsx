import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Attendance from "@/pages/Attendance";
import Analytics from "@/pages/Analytics";
import Insights from "@/pages/Insights";
import Users from "@/pages/Users";
import Logs from "@/pages/Logs";
import SettingsPage from "@/pages/settings/SettingsPage";
import Layout from "@/components/layout/Layout";

function RequireAuth({ children, minRole }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#060B18] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (minRole) {
    const hierarchy = { super_admin: 4, admin: 3, staff: 2, user: 1 };
    if ((hierarchy[user.role] || 0) < (hierarchy[minRole] || 0)) {
      return <Navigate to="/" replace />;
    }
  }
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="analytics"  element={<RequireAuth minRole="staff"><Analytics /></RequireAuth>} />
          <Route path="insights"   element={<RequireAuth minRole="admin"><Insights /></RequireAuth>} />
          <Route path="users"      element={<RequireAuth minRole="admin"><Users /></RequireAuth>} />
          <Route path="logs"       element={<RequireAuth minRole="admin"><Logs /></RequireAuth>} />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AnimatedRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
