import { cn } from "@/lib/utils";

const VARIANTS = {
  present:     "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  late:        "bg-amber-500/10   text-amber-400   border border-amber-500/20",
  absent:      "bg-red-500/10     text-red-400     border border-red-500/20",
  half_day:    "bg-indigo-500/10  text-indigo-400  border border-indigo-500/20",
  super_admin: "bg-violet-500/10  text-violet-400  border border-violet-500/20",
  admin:       "bg-blue-500/10    text-blue-400    border border-blue-500/20",
  staff:       "bg-cyan-500/10    text-cyan-400    border border-cyan-500/20",
  user:        "bg-slate-500/10   text-slate-400   border border-slate-500/20",
  critical:    "bg-red-500/10     text-red-400     border border-red-500/20",
  warning:     "bg-amber-500/10   text-amber-400   border border-amber-500/20",
  info:        "bg-blue-500/10    text-blue-400    border border-blue-500/20",
  pro:         "bg-violet-500/10  text-violet-400  border border-violet-500/20",
  free:        "bg-slate-500/10   text-slate-400   border border-slate-500/20",
};

export function Badge({ variant = "info", className, children }) {
  return (
    <span className={cn("status-badge capitalize", VARIANTS[variant] ?? VARIANTS.info, className)}>
      {children}
    </span>
  );
}
