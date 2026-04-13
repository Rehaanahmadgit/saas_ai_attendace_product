import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  violet:  { iconBg: "bg-violet-500/10",  iconBorder: "border-violet-500/20",  iconText: "text-violet-400",  glow: "shadow-violet-500/5" },
  emerald: { iconBg: "bg-emerald-500/10", iconBorder: "border-emerald-500/20", iconText: "text-emerald-400", glow: "shadow-emerald-500/5" },
  blue:    { iconBg: "bg-blue-500/10",    iconBorder: "border-blue-500/20",    iconText: "text-blue-400",    glow: "shadow-blue-500/5" },
  amber:   { iconBg: "bg-amber-500/10",   iconBorder: "border-amber-500/20",   iconText: "text-amber-400",   glow: "shadow-amber-500/5" },
  red:     { iconBg: "bg-red-500/10",     iconBorder: "border-red-500/20",     iconText: "text-red-400",     glow: "shadow-red-500/5" },
};

export default function KPICard({ title, value, change, subtitle, icon: Icon, color = "violet", loading, index = 0 }) {
  const colors = COLOR_MAP[color] || COLOR_MAP.violet;
  const isPositive = typeof change === "number" ? change >= 0 : (change || "").startsWith("+");

  return (
    <motion.div
      className={cn("glass rounded-2xl p-5 shadow-xl", colors.glow)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{title}</p>

          {loading ? (
            <div className="h-8 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
          )}

          {change !== undefined && !loading && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive
                ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              }
              <span className={cn("text-xs font-medium", isPositive ? "text-emerald-400" : "text-red-400")}>
                {typeof change === "number" ? `${change > 0 ? "+" : ""}${change}%` : change}
              </span>
              {subtitle && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</span>}
            </div>
          )}
        </div>

        {/* Icon box — fixed explicit class keys instead of fragile string splitting */}
        <div className={cn("p-2.5 rounded-xl border flex-shrink-0 ml-4", colors.iconBg, colors.iconBorder)}>
          {Icon && <Icon className={cn("w-5 h-5", colors.iconText)} />}
        </div>
      </div>
    </motion.div>
  );
}
