import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, formatMoneyParts } from "@/lib/utils/format";
import type { Transaction } from "@/services/transactions";

export function LatestTransactionsPanel({ rows }: { rows: Transaction[] }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display italic text-[18px] text-foreground tracking-[-0.02em] font-normal">
          Últimos movimentos
        </h2>
        <Link
          href="/transacoes"
          className="text-navy-700 text-[13px] hover:text-navy-900 transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      <Panel className="!px-0">
        <table className="w-full">
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-center py-8 text-[13px] text-muted-foreground italic">
                  Nada por aqui ainda esse mês. Use Cmd+K (ou ⌘K) pra lançar a primeira.
                </td>
              </tr>
            ) : (
              rows.slice(0, 6).map((tx) => <Row key={tx.id} tx={tx} />)
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
          {prefix}{symbol} {integer},{cents}
        </span>
      </td>
    </tr>
  );
}
