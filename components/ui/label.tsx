import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block text-[12px] font-medium text-muted-foreground mb-1.5",
      "tracking-[-0.005em]",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
