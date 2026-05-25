import Link from "next/link";
import { CreditCard, AlertCircle } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
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

export function CreditCardBillsSection({
  bills,
  accountsById,
}: {
  bills: CreditCardBill[];
  accountsById: Map<string, Tables<"accounts">>;
}) {
  if (bills.length === 0) return null;

  return (
    <Panel className="mb-5">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4" strokeWidth={1.7} />
            Faturas abertas
          </span>
        }
        meta={`${bills.length} cartão${bills.length !== 1 ? "es" : ""}`}
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

          return (
            <div
              key={bill.accountId}
              className="border border-border rounded-[8px] p-4 bg-bone-100/40 dark:bg-ink-800/40"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-medium text-[14.5px] text-foreground">
                    {acc.institution} · {acc.name}
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
                    Fatura aberta
                  </div>
                  <Money
                    value={bill.totalOpen}
                    className="text-[20px] font-medium tracking-[-0.01em]"
                  />
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {bill.txCount} compra{bill.txCount !== 1 ? "s" : ""}
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
            </div>
          );
        })}
      </div>
      <p className="text-[10.5px] font-mono text-faint-foreground tracking-[0.06em] mt-3">
        Cada compra no cartão = 1 transaction. Quando pagar a fatura, crie um
        transfer da conta de débito → conta do cartão.
      </p>
    </Panel>
  );
}
