import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { insightsApi } from "@/lib/api";

const PAGE_TITLES = {
  "/":           "Dashboard",
  "/attendance": "Attendance",
  "/analytics":  "Analytics",
  "/insights":   "AI Insights",
  "/users":      "User Management",
  "/logs":       "Activity Logs",
  "/settings":   "Settings",
};

export default function Topbar({ onMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, orgPlan } = useAuth();
  const [unread, setUnread] = useState(0);
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

  // Plan badge styles
  const planStyles = {
    pro:  "text-violet-400 bg-violet-500/10 border-violet-500/20",
    free: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  };
  const planLabel = orgPlan === "pro" ? "Pro Plan" : "Free Plan";
  const planStyle = planStyles[orgPlan] || planStyles.free;

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-white/[0.06] bg-[#060B18]/80 backdrop-blur-xl sticky top-0 z-30">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-white">
            {PAGE_TITLES[location.pathname] || "Nexus"}
          </h1>
          <p className="text-[11px] text-white/30 hidden sm:block">{today}</p>
        </div>
      </div>

      {/* Right: notifications + org plan */}
      <div className="flex items-center gap-2">
        {/* Insight notifications — clicking navigates to /insights */}
        {["admin", "super_admin"].includes(user?.role) && (
          <button
            className="relative p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
            onClick={() => navigate("/insights")}
            aria-label="View AI insights"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
              >
                {unread}
              </motion.span>
            )}
          </button>
        )}

        {/* Org plan badge — real data from backend */}
        <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full ${planStyle}`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${orgPlan === "pro" ? "bg-violet-400" : "bg-slate-400"}`} />
          {planLabel}
        </span>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {(user?.name || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
