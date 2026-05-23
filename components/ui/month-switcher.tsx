"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Navegação de mês pra dashboard: anterior · mês atual com input · próximo · hoje.
 * Lê e escreve `?month=YYYY-MM` na URL. Quando `?month` ausente, está no mês corrente.
 */
export function MonthSwitcher({
  currentMonth, // YYYY-MM
  isCurrent,
  label, // "maio de 2026"
}: {
  currentMonth: string;
  isCurrent: boolean;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const navigate = (toMonth: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (toMonth === null) sp.delete("month");
    else sp.set("month", toMonth);
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  const [y, m] = currentMonth.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const prevStr = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] border border-border-strong bg-surface p-0.5 shadow-xs",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => navigate(prevStr)}
        className="p-1.5 rounded-[7px] text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="month"
          value={currentMonth}
          onChange={(e) => navigate(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Selecionar mês"
        />
        <span className="px-2.5 py-1.5 text-[12.5px] font-medium tracking-[-0.005em] text-foreground capitalize hover:bg-surface-muted rounded-[7px] transition-colors min-w-[110px] text-center">
          {label}
        </span>
      </label>

      <button
        type="button"
        onClick={() => navigate(nextStr)}
        className="p-1.5 rounded-[7px] text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
        aria-label="Próximo mês"
      >
        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      {!isCurrent ? (
        <>
          <span className="mx-0.5 w-px h-5 bg-border" aria-hidden />
          <button
            type="button"
            onClick={() => navigate(null)}
            className="px-2 py-1.5 text-[11.5px] font-medium text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 hover:bg-navy-50 dark:hover:bg-navy-900/30 rounded-[7px] transition-colors"
          >
            Hoje
          </button>
        </>
      ) : null}
    </div>
  );
}
