import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("text-sm font-medium text-white/60 leading-none", className)} {...props} />
));
Label.displayName = "Label";
export { Label };
