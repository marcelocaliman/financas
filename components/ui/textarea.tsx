import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-[8px] border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-foreground",
        "placeholder:text-faint-foreground resize-y min-h-[80px]",
        "focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100",
        "transition-[border-color,box-shadow] duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
