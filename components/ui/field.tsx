import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Label } from "./label";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-rust-600 ml-0.5">*</span> : null}
        </Label>
      ) : null}
      {children}
      {hint ? (
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">{hint}</p>
      ) : null}
      {error ? <p className="text-[11.5px] text-rust-600">{error}</p> : null}
    </div>
  );
}
