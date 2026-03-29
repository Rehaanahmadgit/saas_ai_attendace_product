import { motion } from "framer-motion";
import { AlertTriangle, Info, AlertCircle, CheckCircle2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, border: "border-red-500/20",    bg: "bg-red-500/[0.04]",    dot: "bg-red-500" },
  warning:  { icon: AlertTriangle, border: "border-amber-500/20", bg: "bg-amber-500/[0.04]", dot: "bg-amber-500" },
  info:     { icon: Info,          border: "border-blue-500/20",  bg: "bg-blue-500/[0.04]",  dot: "bg-blue-400" },
};

export default function InsightCard({ insight, onMarkRead, index = 0 }) {
  const cfg = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <motion.div
      className={cn("rounded-xl border p-4", cfg.border, cfg.bg, !insight.is_read && "ring-1 ring-inset ring-white/[0.04]")}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-lg mt-0.5 flex-shrink-0", cfg.bg)}>
          <Icon className={cn("w-4 h-4", {
            critical: "text-red-400",
            warning: "text-amber-400",
            info: "text-blue-400",
          }[insight.severity])} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-white leading-snug">{insight.title}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge variant={insight.severity}>{insight.severity}</Badge>
              {!insight.is_read && <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />}
            </div>
          </div>

          <p className="text-xs text-white/50 leading-relaxed">{insight.description}</p>

          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[0.05]">
            <span className="text-[11px] text-white/25">
              {format(new Date(insight.created_at), "MMM d, yyyy h:mm a")}
            </span>
            {!insight.is_read && onMarkRead && (
              <button
                onClick={() => onMarkRead(insight.id)}
                className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
