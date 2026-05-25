"use client";

import { useState } from "react";
import { Check, AlertTriangle, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Linha de auditoria — mostra valor do app vs valor oficial (digitado pelo user).
 *
 * Lógica de cores:
 *  - Verde: bate dentro da tolerância (R$ 1)
 *  - Amarelo: diverge entre R$ 1 e 5% do valor do app
 *  - Vermelho: diverge > 5%
 *  - Cinza: ainda não preenchido
 */

const TOLERANCE_BRL = 1;
const TOLERANCE_PCT = 0.05;

export function AuditRow({
  label,
  hint,
  appValue,
  unit = "R$",
  storageKey,
}: {
  label: string;
  hint?: string;
  appValue: number;
  unit?: "R$" | "un.";
  /** localStorage key pra persistir o que o user digitou entre sessões */
  storageKey: string;
}) {
  const [officialValue, setOfficialValue] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(storageKey) ?? "";
  });

  const officialNum = parseFloat(officialValue.replace(",", "."));
  const filled = officialValue.trim().length > 0 && !Number.isNaN(officialNum);
  const diff = filled ? officialNum - appValue : 0;
  const diffPct = filled && appValue !== 0 ? Math.abs(diff) / Math.abs(appValue) : 0;

  let state: "ok" | "warn" | "error" | "empty" = "empty";
  if (filled) {
    if (Math.abs(diff) <= TOLERANCE_BRL) state = "ok";
    else if (diffPct <= TOLERANCE_PCT) state = "warn";
    else state = "error";
  }

  const handleChange = (v: string) => {
    setOfficialValue(v);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, v);
    }
  };

  const fmt = (n: number) =>
    unit === "R$"
      ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(Math.round(n));

  return (
    <tr className="border-t border-border align-top">
      <td className="py-3 pr-3">
        <div className="text-[13px] text-foreground">{label}</div>
        {hint ? <div className="text-[11.5px] text-faint-foreground mt-0.5">{hint}</div> : null}
      </td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums text-[12.5px] text-foreground">
        {unit === "R$" ? "R$ " : ""}{fmt(appValue)}
      </td>
      <td className="py-3 pr-3">
        <input
          type="text"
          inputMode="decimal"
          value={officialValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={unit === "R$" ? "0,00" : "0"}
          className={cn(
            "w-full h-9 px-3 rounded-[6px] border bg-surface text-[12.5px] font-mono tabular-nums text-right",
            state === "ok" && "border-olive-400",
            state === "warn" && "border-gold-400",
            state === "error" && "border-rust-400",
            state === "empty" && "border-border-strong",
          )}
        />
      </td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums text-[12.5px]">
        {filled ? (
          <span
            className={cn(
              diff === 0
                ? "text-faint-foreground"
                : diff > 0
                  ? "text-olive-700 dark:text-olive-200"
                  : "text-rust-600",
            )}
          >
            {diff > 0 ? "+" : ""}
            {unit === "R$" ? "R$ " : ""}{fmt(diff)}
          </span>
        ) : (
          <span className="text-faint-foreground">—</span>
        )}
      </td>
      <td className="py-3 text-center">
        {state === "ok" ? (
          <Check className="w-4 h-4 text-olive-700 dark:text-olive-200 inline" strokeWidth={2} />
        ) : state === "warn" ? (
          <AlertTriangle className="w-4 h-4 text-gold-700 dark:text-gold-200 inline" strokeWidth={1.7} />
        ) : state === "error" ? (
          <AlertTriangle className="w-4 h-4 text-rust-600 inline" strokeWidth={1.7} />
        ) : (
          <Minus className="w-4 h-4 text-faint-foreground inline" strokeWidth={1.7} />
        )}
      </td>
    </tr>
  );
}
