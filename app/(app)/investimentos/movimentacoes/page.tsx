import Link from "next/link";
import { ChevronLeft, ArrowDownToLine, ArrowUpFromLine, Banknote, Split, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { listWalletMovements, type WalletMovement } from "@/services/investments";

export const dynamic = "force-dynamic";

const KIND_META: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  buy: {
    label: "Compra",
    color: "text-navy-700 dark:text-navy-300 bg-navy-100/60 dark:bg-navy-700/20",
    icon: <ArrowDownToLine className="w-3 h-3" strokeWidth={2} />,
  },
  sell: {
    label: "Venda",
    color: "text-rust-600 bg-rust-100/40 dark:bg-rust-700/15",
    icon: <ArrowUpFromLine className="w-3 h-3" strokeWidth={2} />,
  },
  dividend: {
    label: "Dividendo / JCP",
    color: "text-olive-700 dark:text-olive-500 bg-olive-100/60 dark:bg-olive-700/15",
    icon: <Banknote className="w-3 h-3" strokeWidth={2} />,
  },
  split: {
    label: "Split / bonificação",
    color: "text-gold-700 dark:text-gold-300 bg-gold-100/60 dark:bg-gold-700/15",
    icon: <Split className="w-3 h-3" strokeWidth={2} />,
  },
  exercise: { label: "Exercício", color: "text-foreground bg-surface-muted", icon: null },
  assignment: { label: "Assignment", color: "text-foreground bg-surface-muted", icon: null },
  expiration: { label: "Vencimento opção", color: "text-foreground bg-surface-muted", icon: null },
};

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function groupByMonth(items: WalletMovement[]): Array<{ month: string; items: WalletMovement[] }> {
  const map = new Map<string, WalletMovement[]>();
  for (const m of items) {
    const key = m.date.slice(0, 7); // YYYY-MM
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, items]) => ({ month, items }));
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${months[parseInt(m) - 1]} de ${y}`;
}

export default async function MovimentacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || `${new Date().getUTCFullYear() - 1}-01-01`;
  const to = params.to || `${new Date().getUTCFullYear()}-12-31`;

  const movements = await listWalletMovements({
    from,
    to,
    kind: (params.kind as WalletMovement["kind"]) || undefined,
    limit: 500,
  });
  const groups = groupByMonth(movements);

  // Sumários do período
  const totals = movements.reduce(
    (acc, m) => {
      const value = Number(m.total_amount ?? 0);
      if (m.kind === "buy") acc.bought += value;
      else if (m.kind === "sell") acc.sold += value;
      else if (m.kind === "dividend") acc.dividends += value;
      return acc;
    },
    { bought: 0, sold: 0, dividends: 0 },
  );

  return (
    <>
      <Link
        href="/investimentos"
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar pra Investimentos
      </Link>

      <PageHeader
        eyebrow={`Movimentações · ${movements.length} operação${movements.length !== 1 ? "s" : ""}`}
        title={
          <>
            Timeline da{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              carteira
            </em>
          </>
        }
        subtitle={`Compras, vendas, dividendos e splits entre ${fmtDateBR(from)} e ${fmtDateBR(to)}. Use ?from=YYYY-MM-DD&to=YYYY-MM-DD pra ajustar o período.`}
      />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Panel>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1">
            Comprado
          </div>
          <div className="font-mono text-[20px] tabular-nums text-foreground">
            R$ {fmtBRL(totals.bought)}
          </div>
        </Panel>
        <Panel>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1">
            Vendido (bruto)
          </div>
          <div className="font-mono text-[20px] tabular-nums text-rust-600">
            R$ {fmtBRL(totals.sold)}
          </div>
        </Panel>
        <Panel>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-1">
            Dividendos / JCP
          </div>
          <div className="font-mono text-[20px] tabular-nums text-olive-700 dark:text-olive-500">
            R$ {fmtBRL(totals.dividends)}
          </div>
        </Panel>
      </div>

      {movements.length === 0 ? (
        <Panel className="!py-12 grid place-items-center">
          <AlertCircle className="w-6 h-6 text-faint-foreground mb-2" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground text-center max-w-[360px]">
            Nenhuma movimentação no período. Compras, vendas e dividendos aparecem aqui automaticamente
            quando você usa as ações no menu de cada ativo (ou cadastra via &quot;Liquidar&quot;).
          </p>
        </Panel>
      ) : (
        groups.map((g) => (
          <Panel key={g.month} className="mb-4">
            <PanelHeader title={monthLabel(g.month)} meta={`${g.items.length} operação${g.items.length !== 1 ? "s" : ""}`} />
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-faint-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
                  <th className="text-left pb-2 font-medium w-[60px]">Data</th>
                  <th className="text-left pb-2 font-medium w-[140px]">Tipo</th>
                  <th className="text-left pb-2 font-medium">Ativo</th>
                  <th className="text-right pb-2 font-medium w-[110px]">Quantidade</th>
                  <th className="text-right pb-2 font-medium w-[110px]">Preço unit.</th>
                  <th className="text-right pb-2 font-medium w-[130px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((m) => {
                  const meta = KIND_META[m.kind] ?? KIND_META.buy;
                  return (
                    <tr key={m.id} className="border-t border-border-strong/40">
                      <td className="py-2 font-mono text-[11px] text-muted-foreground">
                        {m.date.slice(8, 10)}/{m.date.slice(5, 7)}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono uppercase tracking-[0.06em] ${meta.color}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="font-medium text-foreground">
                          {m.investment?.ticker ?? "—"}
                        </div>
                        {m.notes ? (
                          <div className="font-mono text-[10.5px] text-faint-foreground truncate max-w-[280px]">
                            {m.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {Number(m.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 8 })}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                        R$ {Number(m.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        R$ {fmtBRL(Number(m.total_amount ?? 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        ))
      )}
    </>
  );
}
