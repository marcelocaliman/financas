import { Badge } from "@/components/ui/badge";
import type { BensReport } from "@/services/ir/bens";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function BensTable({ report }: { report: BensReport }) {
  if (report.byGroup.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic py-6 text-center">
        Nenhum bem declarável encontrado. Cadastre contas, investimentos e bens
        físicos pra preencher esta seção automaticamente.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {report.byGroup.map((g) => (
        <section key={g.group}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium">
              Grupo {g.group} · {g.groupLabel}
            </span>
            <span className="text-[11.5px] font-mono text-faint-foreground">
              {g.items.length} {g.items.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
                  <th className="text-left pb-2 pr-3 font-medium">Cod</th>
                  <th className="text-left pb-2 pr-3 font-medium">Discriminação</th>
                  <th className="text-left pb-2 pr-3 font-medium">CNPJ</th>
                  <th className="text-right pb-2 pr-3 font-medium">
                    31/12/{report.year - 1}
                  </th>
                  <th className="text-right pb-2 font-medium">31/12/{report.year}</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((item) => (
                  <tr
                    key={`${item.source}-${item.sourceId}`}
                    className="border-t border-border align-top"
                  >
                    <td className="py-2.5 pr-3 font-mono text-foreground">
                      {item.code}
                    </td>
                    <td className="py-2.5 pr-3 max-w-[420px]">
                      <div className="text-foreground">{item.codeLabel}</div>
                      <div className="text-faint-foreground text-[11.5px] mt-0.5">
                        {item.discrimination}
                      </div>
                      {item.fxNote ? (
                        <Badge tone="gold" className="mt-1">moeda estrangeira</Badge>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-faint-foreground text-[11.5px]">
                      {item.cnpj ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-right tabular-nums text-faint-foreground">
                      R$ {fmtBRL(item.previousYearValue)}
                    </td>
                    <td className="py-2.5 font-mono text-right tabular-nums text-foreground font-medium">
                      R$ {fmtBRL(item.currentYearValue)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border-strong">
                  <td colSpan={3} className="pt-2.5 pr-3 font-mono text-[11px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
                    Subtotal grupo {g.group}
                  </td>
                  <td className="pt-2.5 pr-3 font-mono text-right tabular-nums text-faint-foreground">
                    R$ {fmtBRL(g.totalPrevious)}
                  </td>
                  <td className="pt-2.5 font-mono text-right tabular-nums text-foreground font-medium">
                    R$ {fmtBRL(g.totalCurrent)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <div className="pt-4 border-t-2 border-border-strong grid grid-cols-3 gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            Total 31/12/{report.year - 1}
          </div>
          <div className="font-mono text-[17px] tabular-nums mt-1">
            R$ {fmtBRL(report.totals.previous)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            Total 31/12/{report.year}
          </div>
          <div className="font-mono text-[17px] tabular-nums mt-1 text-foreground font-medium">
            R$ {fmtBRL(report.totals.current)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            Variação
          </div>
          <div
            className={
              "font-mono text-[17px] tabular-nums mt-1 " +
              (report.totals.delta >= 0 ? "text-olive-700" : "text-rust-600")
            }
          >
            {report.totals.delta >= 0 ? "+" : ""}R$ {fmtBRL(report.totals.delta)}
          </div>
        </div>
      </div>
    </div>
  );
}
