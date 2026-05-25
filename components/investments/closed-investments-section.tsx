"use client";

import { useState } from "react";
import { Archive, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { reopenInvestment } from "@/services/investments.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { Investment } from "@/services/investments";

const REASON_LABELS: Record<string, string> = {
  sold: "vendido",
  matured: "vencido",
  archived: "arquivado",
};

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ClosedInvestmentsSection({
  investments,
  currentYear,
}: {
  investments: Investment[];
  currentYear: number;
}) {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const confirm = useConfirm();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Agrupa por ano de fechamento
  const byYear = new Map<number, Investment[]>();
  for (const inv of investments) {
    if (!inv.closed_at) continue;
    const y = parseInt(inv.closed_at.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(inv);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);
  const items = byYear.get(selectedYear) ?? [];

  if (investments.length === 0) return null;

  const handleReopen = async (inv: Investment) => {
    const ok = await confirm({
      eyebrow: "Reverter liquidação",
      title: `Reabrir "${inv.ticker}"?`,
      description:
        "Apaga a venda, a transação de caixa e desfaz o ajuste de saldo. Útil pra corrigir erro.",
      confirmLabel: "Reabrir",
      destructive: true,
    });
    if (!ok) return;
    setPendingId(inv.id);
    const r = await reopenInvestment(inv.id);
    setPendingId(null);
    if (r.error) toast.error(r.error);
    else toast.success("Investimento reaberto.");
  };

  return (
    <Panel className="mb-5">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Archive className="w-4 h-4 text-muted-foreground" strokeWidth={1.7} />
            Encerrados em {selectedYear}
          </span>
        }
        meta={
          <div className="inline-flex items-center gap-1.5">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono tracking-[0.06em] transition-colors ${
                  y === selectedYear
                    ? "bg-navy-700 text-white dark:bg-navy-300 dark:text-navy-900"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        }
      />
      {items.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          Nenhum ativo encerrado em {selectedYear}.
        </p>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
              <th className="text-left pb-2 font-medium">Ativo</th>
              <th className="text-left pb-2 font-medium">Encerrado</th>
              <th className="text-right pb-2 font-medium">Aplicado</th>
              <th className="text-right pb-2 font-medium">Recebido bruto</th>
              <th className="text-right pb-2 font-medium">IR retido</th>
              <th className="text-right pb-2 font-medium">Resultado</th>
              <th className="text-center pb-2 font-medium w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((inv) => {
              const aplicado = Number(inv.initial_amount ?? 0);
              const bruto = Number(inv.gross_proceeds_on_close ?? 0);
              const ir = Number(inv.ir_withheld_on_close ?? 0);
              const liquido = bruto - ir;
              const ganho = liquido - aplicado;
              return (
                <tr key={inv.id} className="border-t border-border-strong/40 group">
                  <td className="py-2.5">
                    <div className="font-medium text-foreground">{inv.ticker}</div>
                    <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5">
                      {REASON_LABELS[inv.closed_reason ?? "archived"]}
                    </div>
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                    {fmtDateBR(inv.closed_at!)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                    R$ {fmtBRL(aplicado)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    R$ {fmtBRL(bruto)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-rust-600">
                    {ir > 0 ? `− R$ ${fmtBRL(ir)}` : "—"}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        ganho >= 0 ? "text-olive-700 dark:text-olive-500" : "text-rust-600"
                      }`}
                    >
                      {ganho >= 0 ? (
                        <TrendingUp className="w-3 h-3" strokeWidth={2} />
                      ) : (
                        <TrendingDown className="w-3 h-3" strokeWidth={2} />
                      )}
                      R$ {fmtBRL(ganho)}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleReopen(inv)}
                      disabled={pendingId === inv.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-navy-700 dark:text-navy-300 hover:underline inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <RotateCcw className="w-3 h-3" strokeWidth={1.8} />
                      Reabrir
                    </button>
                  </td>
                </tr>
              );
            })}
            {/* Totalizador */}
            <tr className="border-t-2 border-border-strong font-medium">
              <td colSpan={2} className="py-2.5 text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.14em]">
                Total {selectedYear}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums">
                R$ {fmtBRL(items.reduce((s, i) => s + Number(i.initial_amount ?? 0), 0))}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums">
                R$ {fmtBRL(items.reduce((s, i) => s + Number(i.gross_proceeds_on_close ?? 0), 0))}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums text-rust-600">
                − R$ {fmtBRL(items.reduce((s, i) => s + Number(i.ir_withheld_on_close ?? 0), 0))}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums">
                R${" "}
                {fmtBRL(
                  items.reduce(
                    (s, i) =>
                      s +
                      (Number(i.gross_proceeds_on_close ?? 0) -
                        Number(i.ir_withheld_on_close ?? 0) -
                        Number(i.initial_amount ?? 0)),
                    0,
                  ),
                )}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
      <p className="text-[10.5px] font-mono text-faint-foreground tracking-[0.06em] mt-3">
        Encerrados continuam na declaração IR do ano do fechamento (situação anterior R$ X → situação atual R$ 0).
      </p>
    </Panel>
  );
}
