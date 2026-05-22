"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Toggle de tema com três opções: sistema, claro, escuro.
 * Renderiza placeholder até montar (evita flash SSR).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Padrão recomendado pelo next-themes: marca "montado" pra evitar
    // hydration mismatch — `theme` é null no SSR e definido no client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const current = mounted ? theme ?? "system" : "system";

  const options: Array<{
    value: "system" | "light" | "dark";
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: "system", label: "Sistema", icon: <Monitor className="w-3.5 h-3.5" strokeWidth={1.7} /> },
    { value: "light", label: "Claro", icon: <Sun className="w-3.5 h-3.5" strokeWidth={1.7} /> },
    { value: "dark", label: "Escuro", icon: <Moon className="w-3.5 h-3.5" strokeWidth={1.7} /> },
  ];

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-surface-muted rounded-[10px]">
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium tracking-[-0.005em] transition-colors",
              active
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
