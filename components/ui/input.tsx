import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-[8px] border border-border-strong bg-surface px-3 text-[14px] text-foreground",
        "placeholder:text-faint-foreground",
        "transition-[border-color,box-shadow] duration-150",
        "focus:outline-none focus:border-navy-500 focus:shadow-[0_0_0_3px_var(--color-navy-100)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
