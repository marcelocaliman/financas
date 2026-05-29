"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDateShort, formatMoneyParts } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Transaction } from "@/services/transactions";
import type { ForecastOccurrence } from "@/services/recurrences";

type Item =
  | { kind: "tx"; tx: Transaction; key: string }
  | { kind: "forecast"; occ: ForecastOccurrence; key: string };

const PAGE_SIZE = 10;

/**
 * Painel "Últimos movimentos" do dashboard.
 *
 * Mantém server-fetch de 30 últimos (em listTransactions com pageSize=30) e
 * faz filtro + paginação CLIENT-SIDE pra não recarregar a página. Quando o
 * resultado filtrado fica vazio, mostra hint.
 */
export function LatestTransactionsPanel({
  rows,
  forecastRows = [],
  isForecast = false,
}: {
  rows: Transaction[];
  /** Ocorrências previstas (mês futuro sem materializar). Já vem com badge "previsto". */
  forecastRows?: ForecastOccurrence[];
  isForecast?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // Funde rows reais + forecast num único stream ordenado por data desc
  const allItems = useMemo<Item[]>(() => {
    const items: Item[] = [
      ...rows.map((tx) => ({ kind: "tx" as const, tx, key: `tx-${tx.id}` })),
      ...forecastRows.map((occ, i) => ({
        kind: "forecast" as const,
        occ,
        key: `fc-${occ.ruleId}-${occ.date}-${i}`,
      })),
    ];
    return items.sort((a, b) => {
      const da = a.kind === "tx" ? a.tx.date : a.occ.date;
      const db = b.kind === "tx" ? b.tx.date : b.occ.date;
      return db.localeCompare(da);
    });
  }, [rows, forecastRows]);

  // Filtro client-side por description/category/account
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((it) => {
      const fields =
        it.kind === "tx"
          ? [
              it.tx.description,
              it.tx.category?.name,
              it.tx.account?.name,
              it.tx.payment_method,
            ]
          : [
              it.occ.description,
              it.occ.categoryName,
              it.occ.accountName,
              it.occ.fromAccountName,
              it.occ.toAccountName,
              it.occ.paymentMethod,
            ];
      return fields.some((f) => f?.toLowerCase().includes(q));
    });
  }, [allItems, query]);

  // Reset page quando filtro muda
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display italic text-[18px] text-foreground tracking-[-0.02em] font-normal inline-flex items-center gap-2">
          Últimos movimentos
          {isForecast ? (
            <span className="not-italic inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-gold-600/15 text-gold-700 dark:text-gold-500 text-[9.5px] font-mono tracking-[0.12em] uppercase">
              Previsão
            </span>
          ) : null}
        </h2>
        <Link
          href="/transacoes"
          className="text-navy-700 dark:text-navy-300 text-[13px] hover:text-navy-900 dark:hover:text-navy-100 transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      <Panel className="!px-0">
        {/* Barra de busca — só aparece se há itens suficientes */}
        {allItems.length > 5 ? (
          <div className="px-7 pb-3 relative">
            <Search
              className="absolute left-9 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint-foreground pointer-events-none"
              strokeWidth={2}
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar nos últimos movimentos…"
              className="pl-9 h-9 text-[13px]"
            />
          </div>
        ) : null}

        <table className="w-full">
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="text-center py-8 text-[13px] text-muted-foreground italic">
                  {query
                    ? `Nada bateu com "${query}". Tenta outro termo.`
                    : isForecast
                      ? "Nenhuma previsão de recorrências pra esse mês."
                      : "Nada por aqui ainda esse mês. Use Cmd+K (ou ⌘K) pra lançar a primeira."}
                </td>
              </tr>
            ) : (
              visible.map((it) =>
                it.kind === "tx" ? (
                  <Row key={it.key} tx={it.tx} />
                ) : (
                  <ForecastRow key={it.key} occ={it.occ} />
                ),
              )
            )}
          </tbody>
        </table>

        {/* Paginação — só aparece se há mais que 1 página */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between px-7 py-3 border-t border-border">
            <div className="text-[11.5px] font-mono text-muted-foreground tracking-[0.04em]">
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}{" "}
              de {filtered.length}
              {query ? ` (filtrado de ${allItems.length})` : ""}
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content="Página anterior">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="p-1.5 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </Tooltip>
              <span className="text-[11.5px] font-mono text-muted-foreground tabular-nums px-2 min-w-[50px] text-center">
                {safePage + 1} / {totalPages}
              </span>
              <Tooltip content="Próxima página">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="p-1.5 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </Tooltip>
            </div>
          </div>
        ) : null}
      </Panel>
    </section>
  );
}

function Row({ tx }: { tx: Transaction }) {
  const txCurrency = (tx.currency ?? "BRL") as "BRL" | "EUR" | "USD" | "GBP";
  const { integer, cents, currency: symbol } = formatMoneyParts(tx.amount, txCurrency);
  const isIncome = tx.kind === "income";
  const isTransfer = tx.kind === "transfer";
  const prefix = isIncome ? "+ " : isTransfer ? "" : "− ";
  const cls = isIncome ? "text-olive-700" : "text-foreground";

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors">
      <td className="py-3.5 pl-7 pr-3 align-middle whitespace-nowrap w-[80px]">
        <span className="font-mono text-[11.5px] tracking-[0.04em] text-muted-foreground">
          {formatDateShort(tx.date)}
        </span>
      </td>
      <td className="py-3.5 pr-4 align-middle">
        <div className="font-medium text-[14px] text-foreground tracking-[-0.005em]">
          {tx.description}
        </div>
        <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.02em] mt-0.5">
          {tx.account?.name ?? "—"}
          {tx.payment_method ? ` · ${tx.payment_method}` : ""}
        </div>
      </td>
      <td className="py-3.5 pr-4 align-middle">
        {tx.category ? (
          <Badge tone={tx.category.kind === "income" ? "olive" : "neutral"} dot>
            {tx.category.name}
          </Badge>
        ) : isTransfer ? (
          <Badge tone="navy" dot>
            Transferência
          </Badge>
        ) : (
          <span className="text-faint-foreground text-[11.5px] italic">—</span>
        )}
      </td>
      <td className="py-3.5 pr-7 align-middle text-right whitespace-nowrap">
        <span className={`font-mono text-[14px] font-medium tracking-[-0.005em] ${cls}`}>
          {prefix}
          {symbol} <MoneyMask>{integer},{cents}</MoneyMask>
        </span>
      </td>
    </tr>
  );
}

function ForecastRow({ occ }: { occ: ForecastOccurrence }) {
  const { integer, cents, currency: symbol } = formatMoneyParts(occ.amount, occ.originalCurrency);
  const isIncome = occ.kind === "income";
  const isTransfer = occ.kind === "transfer";
  const prefix = isIncome ? "+ " : isTransfer ? "" : "− ";
  const cls = isIncome ? "text-olive-700/80" : "text-foreground/80";
  const accountLabel = isTransfer
    ? `${occ.fromAccountName ?? "—"} → ${occ.toAccountName ?? "—"}`
    : (occ.accountName ?? "—");

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors opacity-90">
      <td className="py-3.5 pl-7 pr-3 align-middle whitespace-nowrap w-[80px]">
        <span className="font-mono text-[11.5px] tracking-[0.04em] text-faint-foreground inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" strokeWidth={1.7} />
          {formatDateShort(occ.date)}
        </span>
      </td>
      <td className="py-3.5 pr-4 align-middle">
        <div className="font-medium text-[14px] text-foreground tracking-[-0.005em] inline-flex items-center gap-2">
          {occ.description}
          <span className="font-mono text-[9.5px] tracking-[0.12em] uppercase text-gold-700 dark:text-gold-500">
            previsto
          </span>
        </div>
        <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.02em] mt-0.5">
          {accountLabel}
          {occ.paymentMethod ? ` · ${occ.paymentMethod}` : ""}
        </div>
      </td>
      <td className="py-3.5 pr-4 align-middle">
        {occ.categoryName ? (
          <Badge tone={isIncome ? "olive" : "neutral"} dot>
            {occ.categoryName}
          </Badge>
        ) : isTransfer ? (
          <Badge tone="navy" dot>
            Transferência
          </Badge>
        ) : (
          <span className="text-faint-foreground text-[11.5px] italic">—</span>
        )}
      </td>
      <td className="py-3.5 pr-7 align-middle text-right whitespace-nowrap">
        <span className={`font-mono text-[14px] font-medium tracking-[-0.005em] ${cls}`}>
          {prefix}
          {symbol} <MoneyMask>{integer},{cents}</MoneyMask>
        </span>
      </td>
    </tr>
  );
}
