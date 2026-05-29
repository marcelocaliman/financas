"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/components/ui/privacy-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

/**
 * Botão de "esconder valores" — mascara dígitos em todo lugar que usa
 * <Money> ou consulta `usePrivacy()`. Persiste em localStorage.
 *
 * Importante: é apenas mascaramento VISUAL. Não criptografa nada, valores
 * continuam acessíveis via DevTools/network. Útil pra demos e prints.
 */
export function PrivacyToggle({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { hidden, toggle } = usePrivacy();
  const Icon = hidden ? EyeOff : Eye;

  const label = hidden ? "Mostrar valores" : "Esconder valores";
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={cn(
          "p-1.5 rounded-[6px] transition-colors",
          tone === "dark"
            ? "text-navy-200 hover:bg-ink-800 hover:text-white"
            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
        )}
      >
        <Icon className="w-[15px] h-[15px]" strokeWidth={1.6} />
      </button>
    </Tooltip>
  );
}
