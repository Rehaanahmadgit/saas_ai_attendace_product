import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg px-3.5 text-sm appearance-none",
        "bg-white/[0.04] border border-white/[0.08] text-white",
        "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent",
        "transition-all duration-200 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
