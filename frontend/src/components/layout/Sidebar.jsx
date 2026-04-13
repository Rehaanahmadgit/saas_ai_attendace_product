import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ClipboardCheck, BarChart3, BrainCircuit,
  Users, GraduationCap, ScrollText, Zap, LogOut, Settings,
  Shield, Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermission } from "@/hooks/usePermission";
import { useHierarchy } from "@/hooks/useHierarchy";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { path: "/",             label: "Dashboard",    icon: LayoutDashboard, always: true },
  { path: "/attendance",   label: "Attendance",   icon: ClipboardCheck,  always: true },
  { path: "/analytics",    label: "Analytics",    icon: BarChart3,       resource: "analytics" },
  { path: "/insights",     label: "AI Insights",  icon: BrainCircuit,    resource: "insights", isPremium: true },
  { path: "/users",        label: "Users",        icon: Users,           resource: "users" },
  { path: "/students",     label: "Students",     icon: GraduationCap,   resource: "students" },
  { path: "/organization", label: "Organization", icon: Building2,       resource: "departments" },
  { path: "/permissions",  label: "Permissions",  icon: Shield,          resource: "role_permissions" },
  { path: "/logs",         label: "Activity Logs",icon: ScrollText,      resource: "role_permissions" },
  { path: "/settings",     label: "Settings",     icon: Settings,        always: true },
];

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.isPremium && (
        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
          AI
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const { can } = usePermission();
  const navigate = useNavigate();
  const { labels } = useHierarchy();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const visibleNav = NAV_ITEMS.map(item => {
    if (item.path === "/organization") return { ...item, label: labels.department || "Organization" };
    return item;
  }).filter(item => item.always || can(item.resource, "can_view"));

  function getInitials(name = "") {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  }

  const sidebarStyle = {
    backgroundColor: isDark ? "#0A0F1E" : "#ffffff",
    borderRightColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
  };

  const logoBorderStyle = {
    borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b" style={logoBorderStyle}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>Nexus</span>
          <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>Attendance AI</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(item => (
          <NavItem key={item.path} item={item} />
        ))}
      </nav>

      {/* User card */}
      <div className="px-3 py-4 border-t" style={logoBorderStyle}>
        <div className="glass rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {user?.name || "User"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={user?.role || "user"}>{user?.role?.replace("_", " ")}</Badge>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer hover:bg-red-500/10 hover:text-red-400"
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r h-screen sticky top-0"
        style={sidebarStyle}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              className="fixed left-0 top-0 bottom-0 z-50 w-56 border-r lg:hidden"
              style={sidebarStyle}
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
