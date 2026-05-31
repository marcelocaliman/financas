"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Navegação de mês: setas (anterior/próximo) + label clicável que abre um
 * seletor (grade de 12 meses + navegação de ano) pra pular direto pra qualquer
 * mês, sem clicar seta N vezes. Lê/escreve `?month=YYYY-MM` na URL.
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
  const [open, setOpen] = useState(false);

  const [y, m] = currentMonth.split("-").map(Number);
  const [pickerYear, setPickerYear] = useState(y);

  const navigate = (toMonth: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (toMonth === null) sp.delete("month");
    else sp.set("month", toMonth);
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  const prev = new Date(Date.UTC(y, m - 2, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const prevStr = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;

  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

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

      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setPickerYear(y); // abre já no ano do mês atual
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="px-2.5 py-1.5 text-[12.5px] font-medium tracking-[-0.005em] text-foreground capitalize hover:bg-surface-muted rounded-[7px] transition-colors min-w-[110px] text-center cursor-pointer"
            aria-label="Selecionar mês"
          >
            {label}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="center"
            sideOffset={6}
            className={cn(
              "z-50 w-[240px] rounded-[10px] border border-border-strong bg-surface shadow-md p-3",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            )}
          >
            {/* Navegação de ano */}
            <div className="flex items-center justify-between mb-2.5">
              <button
                type="button"
                onClick={() => setPickerYear((py) => py - 1)}
                className="p-1 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
                aria-label="Ano anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <span className="font-mono text-[13px] font-medium tabular-nums text-foreground">
                {pickerYear}
              </span>
              <button
                type="button"
                onClick={() => setPickerYear((py) => py + 1)}
                className="p-1 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
                aria-label="Próximo ano"
              >
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>

            {/* Grade de meses */}
            <div className="grid grid-cols-3 gap-1">
              {MONTHS_SHORT.map((mn, idx) => {
                const mm = String(idx + 1).padStart(2, "0");
                const val = `${pickerYear}-${mm}`;
                const isSelected = val === currentMonth;
                const isThisMonth = val === thisMonthStr;
                return (
                  <button
                    key={mn}
                    type="button"
                    onClick={() => {
                      navigate(val);
                      setOpen(false);
                    }}
                    className={cn(
                      "py-1.5 rounded-[7px] text-[12.5px] capitalize transition-colors",
                      isSelected
                        ? "bg-ink-950 text-white dark:bg-bone-100 dark:text-ink-950 font-medium"
                        : "text-foreground hover:bg-surface-muted",
                      !isSelected && isThisMonth && "ring-1 ring-navy-500/50",
                    )}
                  >
                    {mn}
                  </button>
                );
              })}
            </div>

            {/* Atalho pro mês corrente */}
            <button
              type="button"
              onClick={() => {
                navigate(null);
                setOpen(false);
              }}
              className="w-full mt-2.5 py-1.5 rounded-[7px] text-[12px] font-medium text-navy-700 dark:text-navy-300 hover:bg-navy-50 dark:hover:bg-navy-900/30 transition-colors"
            >
              Ir pro mês atual
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

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
