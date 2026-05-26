"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Filter, X, Archive, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

export function MoreFiltersPopover({
  categories,
  portadores,
  historicalShownByDefault,
}: {
  categories: CategoryLite[];
  /** Lista de tags "portador:<nome>" usadas. */
  portadores: string[];
  historicalShownByDefault: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") sp.delete(key);
    else sp.set(key, value);
    sp.delete("page");
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  const currentCategoryId = searchParams.get("categoryId") ?? "";
  const currentTag = searchParams.get("tag") ?? "";
  const hasAccountFilter = !!searchParams.get("accountId");
  const showHistorical = (() => {
    const urlVal = searchParams.get("showHistorical");
    return urlVal === "1" || (urlVal === null && historicalShownByDefault);
  })();
  const showTransferPairs = hasAccountFilter || searchParams.get("showTransferPairs") === "1";
  const pairsForced = hasAccountFilter;

  const activeCount =
    (currentCategoryId ? 1 : 0) +
    (currentTag ? 1 : 0) +
    (searchParams.get("showHistorical") !== null ? 1 : 0) +
    (searchParams.get("showTransferPairs") === "1" ? 1 : 0);

  const clearAll = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("categoryId");
    sp.delete("tag");
    sp.delete("showHistorical");
    sp.delete("showTransferPairs");
    sp.delete("page");
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11.5px] font-mono uppercase tracking-[0.08em] transition-colors border whitespace-nowrap",
            activeCount > 0
              ? "bg-navy-700 text-white border-navy-700 dark:bg-navy-300 dark:text-navy-900 dark:border-navy-300"
              : "bg-surface text-muted-foreground border-border hover:text-foreground",
            pending && "opacity-60",
          )}
        >
          <Filter className="w-3.5 h-3.5" strokeWidth={1.7} />
          Filtros
          {activeCount > 0 ? (
            <span className="font-mono text-[10px] px-1 rounded bg-white/20">
              {activeCount}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-50 w-[320px] rounded-[10px] border border-border-strong bg-surface shadow-lg p-4 space-y-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {/* Categoria */}
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1.5 block">
              Categoria
            </label>
            <select
              value={currentCategoryId}
              onChange={(e) => setParam("categoryId", e.target.value || null)}
              className="w-full h-9 rounded-[8px] border border-border bg-surface text-foreground text-[13px] px-2"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.kind === "income" ? " · receita" : c.kind === "transfer" ? " · transfer" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Portador */}
          {portadores.length > 0 ? (
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1.5 block">
                Portador
              </label>
              <select
                value={currentTag.startsWith("portador:") ? currentTag : ""}
                onChange={(e) => setParam("tag", e.target.value || null)}
                className="w-full h-9 rounded-[8px] border border-border bg-surface text-foreground text-[13px] px-2"
              >
                <option value="">Todos</option>
                {portadores.map((p) => (
                  <option key={p} value={p}>
                    {p.replace("portador:", "")}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Toggles */}
          <div className="space-y-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setParam("showHistorical", showHistorical ? "0" : "1")}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-[7px] hover:bg-surface-muted text-left"
            >
              <span className="flex items-center gap-2 text-[12.5px]">
                <Archive className="w-3.5 h-3.5 text-faint-foreground" strokeWidth={1.7} />
                Mostrar históricas (IR)
              </span>
              <span
                className={cn(
                  "w-9 h-5 rounded-full transition-colors relative",
                  showHistorical ? "bg-navy-700 dark:bg-navy-300" : "bg-border-strong",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                    showHistorical ? "translate-x-[18px]" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (pairsForced) return;
                const showing = searchParams.get("showTransferPairs") === "1";
                setParam("showTransferPairs", showing ? null : "1");
              }}
              disabled={pairsForced}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-[7px] hover:bg-surface-muted text-left disabled:opacity-60 disabled:cursor-not-allowed"
              title={
                pairsForced
                  ? "Filtrando por conta — sempre mostra os 2 lados."
                  : undefined
              }
            >
              <span className="flex items-center gap-2 text-[12.5px]">
                <ArrowLeftRight className="w-3.5 h-3.5 text-faint-foreground" strokeWidth={1.7} />
                Pares de transferência
              </span>
              <span
                className={cn(
                  "w-9 h-5 rounded-full transition-colors relative",
                  showTransferPairs ? "bg-navy-700 dark:bg-navy-300" : "bg-border-strong",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                    showTransferPairs ? "translate-x-[18px]" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          </div>

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[7px] text-[12px] text-rust-600 hover:bg-rust-100/40 dark:hover:bg-rust-700/20"
            >
              <X className="w-3 h-3" strokeWidth={1.8} />
              Limpar todos os filtros
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
