import Link from "next/link";
import { Calendar } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, formatMoneyParts } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Transaction } from "@/services/transactions";
import type { ForecastOccurrence } from "@/services/recurrences";

export function LatestTransactionsPanel({
  rows,
  forecastRows = [],
  isForecast = false,
  limit = 4,
}: {
  rows: Transaction[];
  /** Ocorrências previstas (mês futuro sem materializar). Já vem com badge "previsto". */
  forecastRows?: ForecastOccurrence[];
  isForecast?: boolean;
  /** Quantos itens mostrar (default 4, mais enxuto na home) */
  limit?: number;
}) {
  const visible = rows.length > 0 ? rows.slice(0, limit) : null;
  const visibleForecast = forecastRows.slice(0, Math.max(0, limit - (visible?.length ?? 0)));

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
        <table className="w-full">
          <tbody>
            {!visible && visibleForecast.length === 0 ? (
              <tr>
                <td className="text-center py-8 text-[13px] text-muted-foreground italic">
                  {isForecast
                    ? "Nenhuma previsão de recorrências pra esse mês."
                    : "Nada por aqui ainda esse mês. Use Cmd+K (ou ⌘K) pra lançar a primeira."}
                </td>
              </tr>
            ) : (
              <>
                {visible?.map((tx) => <Row key={tx.id} tx={tx} />)}
                {visibleForecast.map((occ, i) => (
                  <ForecastRow key={`fc-${occ.ruleId}-${occ.date}-${i}`} occ={occ} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </Panel>
    </section>
  );
}

function Row({ tx }: { tx: Transaction }) {
  const txCurrency = (tx.currency ?? "BRL") as "BRL" | "EUR" | "USD";
  const { integer, cents, currency: symbol } = formatMoneyParts(tx.amount, txCurrency);
  const isIncome = tx.kind === "income";
  const isTransfer = tx.kind === "transfer";
  const prefix = isIncome ? "+ " : isTransfer ? "" : "− ";
  const cls = isIncome ? "text-olive-700" : "text-foreground";

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bone-100/40 transition-colors">
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
          {prefix}{symbol} <MoneyMask>{integer},{cents}</MoneyMask>
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
    <tr className="border-b border-border last:border-b-0 hover:bg-bone-100/40 transition-colors opacity-90">
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
          {prefix}{symbol} <MoneyMask>{integer},{cents}</MoneyMask>
        </span>
      </td>
    </tr>
  );
}
