import { Badge } from "@/components/ui/badge";
import type { RendaVariavelReport, DarfMonth } from "@/services/ir/renda-variavel";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function RendaVariavelTable({ report }: { report: RendaVariavelReport }) {
  const sections: { title: string; tone: "navy" | "olive" | "gold"; months: DarfMonth[] }[] = [
    { title: "Swing trade (ações)", tone: "navy", months: report.swing },
    { title: "Day trade", tone: "gold", months: report.dayTrade },
    { title: "FII (venda de cotas)", tone: "olive", months: report.fii },
  ];

  const anyActive = sections.some((s) => s.months.some((m) => m.grossSales > 0));
  if (!anyActive) {
    return (
      <p className="text-[13px] text-muted-foreground italic py-4">
        Nenhuma venda de renda variável no ano. Quando você registrar vendas de
        ações/ETFs/FIIs, a apuração mensal aparecerá aqui automaticamente.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map((sec) => {
        const active = sec.months.filter((m) => m.grossSales > 0 || m.monthlyLoss > 0);
        if (active.length === 0) return null;
        return (
          <section key={sec.title}>
            <div className="flex items-center gap-2 mb-2.5">
              <Badge tone={sec.tone}>{sec.title}</Badge>
              <span className="font-mono text-[11.5px] text-faint-foreground">
                {active.length} {active.length === 1 ? "mês" : "meses"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-faint-foreground font-mono text-[10px] uppercase tracking-[0.12em]">
                    <th className="text-left pb-2 pr-2 font-medium">Mês</th>
                    <th className="text-right pb-2 pr-2 font-medium">Vendas</th>
                    <th className="text-right pb-2 pr-2 font-medium">Lucro</th>
                    <th className="text-right pb-2 pr-2 font-medium">Pj compens</th>
                    <th className="text-right pb-2 pr-2 font-medium">Base</th>
                    <th className="text-right pb-2 pr-2 font-medium">IRRF</th>
                    <th className="text-right pb-2 pr-2 font-medium">DARF</th>
                    <th className="text-left pb-2 font-medium">Venc</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((m) => (
                    <tr key={m.month} className="border-t border-border">
                      <td className="py-2 pr-2 font-mono text-foreground capitalize">
                        {MONTH_LABELS[m.month - 1]}
                      </td>
                      <td className="py-2 pr-2 font-mono text-right tabular-nums">R$ {fmtBRL(m.grossSales)}</td>
                      <td
                        className={
                          "py-2 pr-2 font-mono text-right tabular-nums " +
                          (m.grossProfit > 0 ? "text-olive-700" : m.grossProfit < 0 ? "text-rust-600" : "text-faint-foreground")
                        }
                      >
                        R$ {fmtBRL(m.grossProfit)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-right tabular-nums text-faint-foreground">
                        {m.carryforwardUsedThisMonth > 0 ? `R$ ${fmtBRL(m.carryforwardUsedThisMonth)}` : "—"}
                      </td>
                      <td className="py-2 pr-2 font-mono text-right tabular-nums">R$ {fmtBRL(m.taxableBase)}</td>
                      <td className="py-2 pr-2 font-mono text-right tabular-nums text-faint-foreground">
                        R$ {fmtBRL(m.irrfRetained)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-right tabular-nums">
                        {m.isExempt ? (
                          <span className="text-olive-700">isento</span>
                        ) : m.taxDue > 0 ? (
                          <span className="text-foreground font-medium">R$ {fmtBRL(m.taxDue)}</span>
                        ) : (
                          <span className="text-faint-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 font-mono text-faint-foreground text-[10.5px]">
                        {m.taxDue > 0 ? m.dueDate : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
