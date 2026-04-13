import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, Bell, Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { insightsApi } from "@/lib/api";

const PAGE_TITLES = {
  "/":             "Dashboard",
  "/attendance":   "Attendance",
  "/analytics":    "Analytics",
  "/insights":     "AI Insights",
  "/users":        "User Management",
  "/students":     "Students",
  "/organization": "Organization",
  "/permissions":  "Permissions & RBAC",
  "/logs":         "Activity Logs",
  "/settings":     "Settings",
};

export default function Topbar({ onMenuToggle }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, orgPlan } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unread, setUnread] = useState(0);
  const isDark = theme === "dark";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

  useEffect(() => {
    if (["admin", "super_admin"].includes(user?.role)) {
      insightsApi.list()
        .then(({ data }) => setUnread(data.unread || 0))
        .catch(() => {});
    }
  }, [user, location.pathname]);

  const planStyle = orgPlan === "pro"
    ? "text-violet-400 bg-violet-500/10 border-violet-500/20"
    : "text-slate-400 bg-slate-500/10 border-slate-500/20";
  const planLabel = orgPlan === "pro" ? "Pro Plan" : "Free Plan";

  const btnClass = isDark
    ? "p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
    : "p-2 rounded-lg text-black/40 hover:text-black hover:bg-black/[0.06] cursor-pointer transition-colors";

  return (
    <header
      className="h-14 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 backdrop-blur-xl border-b transition-colors duration-200"
      style={{
        backgroundColor: isDark ? "rgba(6,11,24,0.85)" : "rgba(255,255,255,0.85)",
        borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)",
      }}
    >
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          className={btnClass}
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {PAGE_TITLES[location.pathname] || "Nexus"}
          </h1>
          <p
            className="text-[11px] hidden sm:block"
            style={{ color: "var(--text-muted)" }}
          >
            {today}
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">

        {/* Dark/Light toggle */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          className={btnClass}
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </motion.button>

        {/* Notification bell */}
        {["admin", "super_admin"].includes(user?.role) && (
          <button
            className={`${btnClass} relative`}
            onClick={() => navigate("/insights")}
            aria-label="View AI insights"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </button>
        )}

        {/* Plan badge */}
        <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full ${planStyle}`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${orgPlan === "pro" ? "bg-violet-400" : "bg-slate-400"}`} />
          {planLabel}
        </span>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 cursor-pointer select-none"
          onClick={() => navigate("/settings")}
          title={user?.name}
        >
          {(user?.name || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
