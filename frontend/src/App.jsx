import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Attendance from "@/pages/Attendance";
import Analytics from "@/pages/Analytics";
import Insights from "@/pages/Insights";
import Users from "@/pages/Users";
import Logs from "@/pages/Logs";
import Organization from "@/pages/Organization";
import Onboarding from "@/pages/Onboarding";
import SettingsPage from "@/pages/settings/SettingsPage";
import Permissions from "@/pages/Permissions";
import Students from "@/pages/Students";
import Layout from "@/components/layout/Layout";

function RequireAuth({ children, minRole }) {
  const { user, loading, hasMinRole, isAdmin, isOnboarded } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="min-h-screen bg-[#060B18] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // ── Onboarding enforcement ────────────────────────────────────────────────
  // Only admins need to complete onboarding
  if (isAdmin && !isOnboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If already onboarded, don't let them back into onboarding page
  if (isOnboarded && location.pathname === "/onboarding") {
    return <Navigate to="/" replace />;
  }

  // ── Role check ────────────────────────────────────────────────────────────
  if (minRole && !hasMinRole(minRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes key={location.pathname}>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="analytics"  element={<RequireAuth minRole="staff"><Analytics /></RequireAuth>} />
          <Route path="insights"   element={<RequireAuth minRole="staff"><Insights /></RequireAuth>} />
          <Route path="users"      element={<RequireAuth minRole="staff"><Users /></RequireAuth>} />
          <Route path="students"   element={<RequireAuth minRole="staff"><Students /></RequireAuth>} />
          <Route path="organization" element={<RequireAuth minRole="admin"><Organization /></RequireAuth>} />
          <Route path="permissions" element={<RequireAuth minRole="admin"><Permissions /></RequireAuth>} />
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
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
