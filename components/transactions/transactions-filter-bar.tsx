"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Archive, ArrowLeftRight, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";
import { MonthSwitcher } from "@/components/ui/month-switcher";

type Tab = { value: string; label: string; count?: number };

export function TransactionsFilterBar({
  current,
  tabs,
  monthStr,
  monthLabel,
  isCurrentMonth,
  historicalShownByDefault = false,
}: {
  current: string;
  tabs: Tab[];
  monthStr: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  /** Quando true, históricas estão sendo exibidas mesmo sem flag explícita
   *  na URL (mês passado mostra elas por default). Afeta como o toggle se
   *  comporta. */
  historicalShownByDefault?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") sp.delete(key);
    else sp.set(key, value);
    sp.delete("page"); // reset paginação ao filtrar
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 mb-6", pending && "opacity-60")}>
      {/* Mobile: tabs ocupam linha inteira (cada uma flex-1).
          Desktop: inline-flex normal. */}
      <div className="flex w-full sm:w-auto sm:inline-flex items-center gap-1 p-1 bg-surface-muted rounded-[10px]">
        {tabs.map((t) => {
          const active = current === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setParam("kind", t.value === "all" ? null : t.value)}
              className={cn(
                "flex-1 sm:flex-none px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium tracking-[-0.005em] transition-colors text-center whitespace-nowrap",
                active ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {typeof t.count === "number" ? (
                <span className="ml-1.5 font-mono text-[10.5px] text-faint-foreground">
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 min-w-[200px] max-w-[400px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint-foreground pointer-events-none"
          strokeWidth={2}
        />
        <Input
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Buscar descrição…"
          className="pl-9 h-10"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setParam("q", (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => setParam("q", e.target.value)}
        />
      </div>

      <MonthSwitcher
        currentMonth={monthStr}
        isCurrent={isCurrentMonth}
        label={monthLabel.split(" ")[0]}
      />

      {/* Toggle pra mostrar/esconder transações históricas IR.
          Default: mês corrente = OFF; mês passado = ON. */}
      {(() => {
        const urlVal = searchParams.get("showHistorical");
        const isOn =
          urlVal === "1" || (urlVal === null && historicalShownByDefault);
        return (
          <button
            type="button"
            onClick={() => {
              // Alterna setando explicitamente o oposto do estado atual.
              setParam("showHistorical", isOn ? "0" : "1");
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11.5px] font-mono uppercase tracking-[0.08em] transition-colors border",
              isOn
                ? "bg-navy-700 text-white border-navy-700 dark:bg-navy-300 dark:text-navy-900 dark:border-navy-300"
                : "bg-surface text-muted-foreground border-border hover:text-foreground",
            )}
            title="Históricas = lançamentos retroativos que só aparecem no IR (não afetam saldo). Default ON em meses passados."
          >
            <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />
            {isOn ? "Históricas: ON" : "Históricas: OFF"}
          </button>
        );
      })()}

      {/* Toggle pra mostrar o par espelho de transferências.
          Default: esconde (transfer aparece como linha única).
          Quando filtra por conta, query força mostrar ambos → toggle reflete ON. */}
      {(() => {
        const hasAccountFilter = !!searchParams.get("accountId");
        const isOn =
          hasAccountFilter || searchParams.get("showTransferPairs") === "1";
        const forced = hasAccountFilter;
        return (
          <button
            type="button"
            onClick={() => {
              if (forced) return; // não permite toggle quando forçado pela conta
              const showing = searchParams.get("showTransferPairs") === "1";
              setParam("showTransferPairs", showing ? null : "1");
            }}
            disabled={forced}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11.5px] font-mono uppercase tracking-[0.08em] transition-colors border",
              isOn
                ? "bg-navy-700 text-white border-navy-700 dark:bg-navy-300 dark:text-navy-900 dark:border-navy-300"
                : "bg-surface text-muted-foreground border-border hover:text-foreground",
              forced && "cursor-not-allowed opacity-90",
            )}
            title={
              forced
                ? "Filtrando por conta — sempre mostra os 2 lados de cada transfer."
                : "Toda transferência tem 2 linhas (saída + entrada). Default mostra só a saída pra evitar duplicação visual."
            }
          >
            <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.7} />
            {isOn ? "Pares: ON" : "Pares: OFF"}
          </button>
        );
      })()}
    </div>
  );
}
