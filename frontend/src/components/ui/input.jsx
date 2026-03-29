import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, error, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-lg px-3.5 py-2 text-sm",
      "bg-white/[0.04] border text-white placeholder:text-white/25",
      error ? "border-red-500/50" : "border-white/[0.08]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:border-transparent",
      error ? "focus-visible:ring-red-500/50" : "focus-visible:ring-violet-500/50",
      "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
export { Input };
