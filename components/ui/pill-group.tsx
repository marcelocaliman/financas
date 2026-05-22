"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type PillOption<T extends string = string> = {
  value: T;
  label: React.ReactNode;
  hint?: string;
};

export function PillGroup<T extends string = string>({
  options,
  value,
  onChange,
  name,
  className,
  size = "md",
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (next: T) => void;
  name?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-grid grid-flow-col auto-cols-fr gap-1 p-1 bg-surface-muted rounded-[10px]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[7px] font-medium tracking-[-0.005em] transition-colors text-center",
              size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[13px]",
              active
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
            {opt.hint ? (
              <span className="block font-mono text-[10px] text-faint-foreground mt-0.5 normal-case">
                {opt.hint}
              </span>
            ) : null}
          </button>
        );
      })}
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
