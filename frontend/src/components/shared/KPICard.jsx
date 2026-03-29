import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  violet:  { icon: "bg-violet-500/10 border-violet-500/20 text-violet-400",  glow: "shadow-violet-500/5" },
  emerald: { icon: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", glow: "shadow-emerald-500/5" },
  blue:    { icon: "bg-blue-500/10   border-blue-500/20   text-blue-400",     glow: "shadow-blue-500/5" },
  amber:   { icon: "bg-amber-500/10  border-amber-500/20  text-amber-400",    glow: "shadow-amber-500/5" },
  red:     { icon: "bg-red-500/10    border-red-500/20    text-red-400",      glow: "shadow-red-500/5" },
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
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">{title}</p>

          {loading ? (
            <div className="h-8 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
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
              {subtitle && <span className="text-xs text-white/25">{subtitle}</span>}
            </div>
          )}
        </div>

        <div className={cn("p-2.5 rounded-xl border flex-shrink-0 ml-4", colors.icon.replace("text-", "border-").split(" ")[1], colors.icon.split(" ")[0])}>
          {Icon && <Icon className={cn("w-5 h-5", colors.icon.split(" ")[2])} />}
        </div>
      </div>
    </motion.div>
  );
}
