"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils/cn";

export function ThemeToggle({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  // Idioma "detectar mount" pra evitar hydration mismatch com next-themes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="inline-block w-[68px] h-6" aria-hidden />;
  }

  const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = theme === "dark" ? "Escuro" : theme === "light" ? "Claro" : "Sistema";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[11px] font-mono tracking-[0.04em]",
        "transition-colors",
        tone === "dark"
          ? "text-ink-600 hover:text-navy-200 hover:bg-ink-800"
          : "text-faint-foreground hover:text-foreground hover:bg-surface-muted",
      )}
      title={`Tema: ${label} (clique para alternar)`}
    >
      <Icon className="w-3 h-3" strokeWidth={1.7} />
      <span className="uppercase tracking-[0.12em]">{label}</span>
    </button>
  );
}
