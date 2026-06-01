import Link from "next/link";
import { CreditCard, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { BillActions } from "@/components/accounts/bill-actions";
import type { CreditCardBill } from "@/services/credit-card";
import type { Tables } from "@/types/database";

function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function daysUntil(iso: string): number {
  const target = new Date(iso + "T00:00:00Z");
  const today = new Date();
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function statusBadge(bill: CreditCardBill): React.ReactNode {
  if (bill.status === "overdue") {
    const overdue = Math.abs(bill.daysUntilDue ?? 0);
    return (
      <Badge tone="rust">
        <AlertTriangle className="w-3 h-3" strokeWidth={2} />
        Atrasada há {overdue} dia{overdue !== 1 ? "s" : ""}
      </Badge>
    );
  }
  if (bill.status === "closed_pending") {
    const days = bill.daysUntilDue ?? 0;
    return (
      <Badge tone="gold">
        <Clock className="w-3 h-3" strokeWidth={2} />
        {days === 0 ? "Vence hoje" : `Vence em ${days} dia${days !== 1 ? "s" : ""}`}
      </Badge>
    );
  }
  return null;
}

export function CreditCardBillsSection({
  bills,
  accountsById,
}: {
  bills: CreditCardBill[];
  accountsById: Map<string, Tables<"accounts">>;
}) {
  if (bills.length === 0) return null;
  const cardCount = new Set(bills.map((b) => b.accountId)).size;
  const overdueCount = bills.filter((b) => b.status === "overdue").length;
  const pendingCount = bills.filter((b) => b.status === "closed_pending").length;

  return (
    <Panel className="mb-5">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4" strokeWidth={1.7} />
            Faturas abertas
          </span>
        }
        meta={
          overdueCount + pendingCount > 0
            ? `${overdueCount + pendingCount} a pagar · ${cardCount} cartão${cardCount !== 1 ? "es" : ""}`
            : `${cardCount} cartão${cardCount !== 1 ? "es" : ""}`
        }
      />
      <div className="space-y-3">
        {bills.map((bill) => {
          const acc = accountsById.get(bill.accountId);
          if (!acc) return null;
          const limit = Number(acc.credit_limit ?? 0);
          const daysToClose = daysUntil(bill.closeDate);
          const daysToDue = daysUntil(bill.dueDate);
          const utilColor =
            bill.utilizationPct == null
              ? "bg-navy-700 dark:bg-navy-300"
              : bill.utilizationPct < 0.5
                ? "bg-olive-600"
                : bill.utilizationPct < 0.8
                  ? "bg-gold-600"
                  : "bg-rust-600";

          const ringClass =
            bill.status === "overdue"
              ? "border-rust-300 dark:border-rust-700/60 bg-rust-50/40 dark:bg-rust-950/20"
              : bill.status === "closed_pending"
                ? "border-gold-300 dark:border-gold-700/60 bg-gold-50/40 dark:bg-gold-950/20"
                : "border-border bg-bone-100/40 dark:bg-ink-800/40";

          return (
            <div
              key={`${bill.accountId}-${bill.status}-${bill.dueDate}`}
              className={`border rounded-[8px] p-4 ${ringClass}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-medium text-[14.5px] text-foreground flex items-center gap-2 flex-wrap">
                    {acc.institution} · {acc.name}
                    {statusBadge(bill)}
                  </div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground mt-0.5">
                    Período {fmtDateBR(bill.periodStart)} → {fmtDateBR(bill.periodEnd)}
                  </div>
                </div>
                <Link
                  href={`/transacoes?accountId=${bill.accountId}&month=${bill.periodEnd.slice(0, 7)}`}
                  className="text-[11.5px] text-navy-700 dark:text-navy-300 hover:underline shrink-0 self-center"
                >
                  Ver compras →
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground mb-0.5">
                    {bill.status === "overdue" || bill.status === "closed_pending"
                      ? "A pagar"
                      : "Em formação"}
                  </div>
                  <Money
                    value={bill.totalOpen}
                    className="text-[20px] font-medium tracking-[-0.01em]"
                  />
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {bill.txCount} compra{bill.txCount !== 1 ? "s" : ""}
                    {bill.paidAmount > 0
                      ? ` · R$ ${bill.paidAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} pago`
                      : ""}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground mb-0.5">
                    Fecha em
                  </div>
                  <div className="text-[16px] font-mono tabular-nums text-foreground">
                    {fmtDateBR(bill.closeDate)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {daysToClose <= 0 ? "Fechou hoje" : `${daysToClose} dia${daysToClose !== 1 ? "s" : ""}`}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground mb-0.5">
                    Vence em
                  </div>
                  <div className="text-[16px] font-mono tabular-nums text-foreground">
                    {fmtDateBR(bill.dueDate)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {daysToDue <= 0 ? "Vence hoje" : `${daysToDue} dia${daysToDue !== 1 ? "s" : ""}`}
                  </div>
                </div>
              </div>

              {bill.utilizationPct != null ? (
                <div className="mt-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground">
                      Utilização do limite
                    </span>
                    <span className="font-mono text-[12px] tabular-nums">
                      {(bill.utilizationPct * 100).toFixed(0)}% de R$ {limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className={`h-full ${utilColor} transition-all`}
                      style={{ width: `${Math.min(100, bill.utilizationPct * 100)}%` }}
                    />
                  </div>
                  {bill.utilizationPct >= 0.8 ? (
                    <div className="flex items-center gap-1 mt-1.5 text-[11px] text-rust-700 dark:text-rust-300">
                      <AlertCircle className="w-3 h-3" strokeWidth={1.8} />
                      Utilização alta — afeta score de crédito
                    </div>
                  ) : null}
                </div>
              ) : null}

              <BillActions
                cardAccountId={bill.accountId}
                amountDue={Math.round((bill.totalOpen - bill.paidAmount) * 100) / 100}
                dueDate={bill.dueDate}
                isCurrent={bill.status === "current"}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[10.5px] font-mono text-faint-foreground tracking-[0.06em] mt-3">
        Cada compra no cartão = 1 lançamento. Ao pagar a fatura, use “Marcar como
        paga” — o app cria a transferência da conta → cartão e atualiza o saldo.
      </p>
    </Panel>
  );
}
