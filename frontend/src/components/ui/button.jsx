import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium " +
  "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        gradient: "bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:from-violet-500 hover:to-purple-400",
        default:  "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:  "border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07] hover:text-white",
        ghost:    "text-white/60 hover:bg-white/[0.05] hover:text-white",
        danger:   "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
        success:  "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
      },
      size: {
        sm:   "h-8 px-3 text-xs rounded-md",
        default: "h-10 px-4 py-2",
        lg:   "h-11 px-6",
        xl:   "h-12 px-6 text-base rounded-xl",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
export { Button, buttonVariants };
