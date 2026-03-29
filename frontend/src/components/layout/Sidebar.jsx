import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ClipboardCheck, BarChart3, BrainCircuit,
  Users, ScrollText, Zap, LogOut, ChevronRight, Shield, Settings
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",  to: "/",           minRole: "user"  },
    ],
  },
  {
    label: "Attendance",
    items: [
      { icon: ClipboardCheck,  label: "Attendance",  to: "/attendance", minRole: "user"  },
      { icon: BarChart3,       label: "Analytics",   to: "/analytics",  minRole: "staff" },
    ],
  },
  {
    label: "AI & Insights",
    items: [
      { icon: BrainCircuit,   label: "AI Insights",  to: "/insights",   minRole: "admin", isPremium: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { icon: Users,          label: "Users",         to: "/users",      minRole: "admin" },
      { icon: ScrollText,     label: "Activity Logs", to: "/logs",       minRole: "admin" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: Settings,       label: "Settings",      to: "/settings",   minRole: "user"  },
    ],
  },
];

const HIERARCHY = { super_admin: 4, admin: 3, staff: 2, user: 1 };

function hasAccess(userRole, minRole) {
  return (HIERARCHY[userRole] || 0) >= (HIERARCHY[minRole] || 0);
}

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
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
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  function getInitials(name = "") {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-sm tracking-tight">Nexus</span>
          <p className="text-white/30 text-[10px] leading-tight">Attendance AI</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter(i => hasAccess(user?.role, i.minRole));
          if (!visible.length) return null;
          return (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visible.map(item => <NavItem key={item.to} item={item} />)}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User card */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="glass rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={user?.role || "user"}>{user?.role?.replace("_", " ")}</Badge>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
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
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-[#0A0F1E] border-r border-white/[0.06] h-screen sticky top-0">
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
              className="fixed left-0 top-0 bottom-0 z-50 w-56 bg-[#0A0F1E] border-r border-white/[0.06] lg:hidden"
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
