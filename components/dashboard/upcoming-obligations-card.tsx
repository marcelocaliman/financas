import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Calendar } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { formatDateShort } from "@/lib/utils/format";
import type { UpcomingSummary } from "@/services/upcoming";
import { cn } from "@/lib/utils/cn";

/**
 * Card "Próximos 7 dias" — lista as recorrências que vão cair em breve.
 * Mostra resumo agregado (entradas vs saídas) + lista compacta de itens.
 *
 * Quando vazio, mostra empty state convidando a cadastrar recorrências.
 */
export function UpcomingObligationsCard({
  upcoming,
  days,
}: {
  upcoming: UpcomingSummary;
  days: number;
}) {
  const net = upcoming.totalIncome - upcoming.totalExpense;
  const top = upcoming.items.slice(0, 5);

  return (
    <Panel className="!p-0 overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-border">
        <PanelHeader
          title={`Próximos ${days} dias`}
          meta={
            upcoming.items.length === 0
              ? "sem lançamentos previstos"
              : `${upcoming.items.length} lançamento${upcoming.items.length === 1 ? "" : "s"}`
          }
          className="!mb-3"
        />
        {upcoming.items.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            <Summary
              label="Entram"
              value={upcoming.totalIncome}
              tone="positive"
            />
            <Summary
              label="Saem"
              value={upcoming.totalExpense}
              tone="negative"
            />
            <Summary
              label="Saldo"
              value={net}
              tone={net >= 0 ? "positive" : "negative"}
              signed
            />
          </div>
        ) : null}
      </div>

      {upcoming.items.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-[13px] text-muted-foreground italic">
            Nenhuma recorrência cadastrada com data nos próximos {days} dias.
          </p>
          <Link
            href="/recorrentes"
            className="inline-block mt-2 text-[12.5px] text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 font-medium"
          >
            Cadastrar recorrência →
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {top.map((item, idx) => (
              <UpcomingItemRow key={`${item.ruleId}-${item.date}-${idx}`} item={item} />
            ))}
          </ul>
          {upcoming.items.length > top.length ? (
            <div className="px-5 py-3 border-t border-border text-right">
              <Link
                href="/recorrentes"
                className="text-[12px] text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100"
              >
                + {upcoming.items.length - top.length} outras →
              </Link>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function Summary({
  label,
  value,
  tone,
  signed,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative";
  signed?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[15px] tracking-[-0.01em]",
          value === 0
            ? "text-foreground"
            : tone === "positive"
              ? "text-olive-700 dark:text-olive-500"
              : "text-rust-600",
        )}
      >
        <span>
          {signed && value > 0 ? "+" : ""}
          {signed && value < 0 ? "−" : ""}
        </span>
        <Money
          value={Math.abs(value)}
          className="inline-flex !flex-row !items-baseline text-[15px]"
        />
      </div>
    </div>
  );
}

function UpcomingItemRow({ item }: { item: ReturnType<() => UpcomingSummary["items"][number]> }) {
  const icon =
    item.kind === "income" ? (
      <ArrowDownLeft className="w-3 h-3 text-olive-700 dark:text-olive-500" strokeWidth={1.8} />
    ) : item.kind === "expense" ? (
      <ArrowUpRight className="w-3 h-3 text-rust-600" strokeWidth={1.8} />
    ) : (
      <ArrowLeftRight className="w-3 h-3 text-navy-700 dark:text-navy-300" strokeWidth={1.8} />
    );
  const accountLabel =
    item.kind === "transfer"
      ? `${item.fromAccountName ?? "—"} → ${item.toAccountName ?? "—"}`
      : item.accountName ?? "—";
  const prefix = item.kind === "income" ? "+ " : item.kind === "expense" ? "− " : "";
  const tone =
    item.kind === "income"
      ? "text-olive-700 dark:text-olive-500"
      : item.kind === "expense"
        ? "text-rust-600"
        : "text-foreground";

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-2.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint-foreground inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" strokeWidth={1.7} />
          {formatDateShort(item.date)}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-foreground truncate">{item.description}</div>
        <div className="font-mono text-[10.5px] text-faint-foreground truncate">{accountLabel}</div>
      </div>
      <span className={cn("font-mono text-[13px] font-medium tabular-nums", tone)}>
        {prefix}
        <Money
          value={item.amount}
          className="inline-flex !flex-row !items-baseline text-[13px]"
        />
      </span>
    </li>
  );
}
