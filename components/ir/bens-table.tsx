import { Badge } from "@/components/ui/badge";
import type { BensReport } from "@/services/ir/bens";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

// Grupos onde a Receita exige CNPJ: 04 (renda variável), 05 (renda fixa),
// 06 (depósito), 07 (fundos). Pra imóveis/móveis/veículos/cripto/outros
// a coluna só vira ruído visual.
const GROUPS_WITH_CNPJ = new Set(["04", "05", "06", "07"]);

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
      {report.byGroup.map((g) => {
        const showCnpj = GROUPS_WITH_CNPJ.has(g.group);
        return (
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
            <table className="w-full text-[12.5px] table-fixed">
              <colgroup>
                <col className="w-[48px]" />
                <col />
                {showCnpj ? <col className="w-[160px]" /> : null}
                <col className="w-[140px]" />
                <col className="w-[140px]" />
              </colgroup>
              <thead>
                <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
                  <th className="text-left pb-2 pr-3 font-medium">Cod</th>
                  <th className="text-left pb-2 pr-3 font-medium">Discriminação</th>
                  {showCnpj ? (
                    <th className="text-left pb-2 pr-3 font-medium">CNPJ</th>
                  ) : null}
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
                    <td className="py-2.5 pr-3">
                      <div className="text-foreground">{item.codeLabel}</div>
                      <div className="text-faint-foreground text-[11.5px] mt-0.5 break-words">
                        {item.discrimination}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.fxNote ? (
                          <Badge tone="gold">moeda estrangeira</Badge>
                        ) : null}
                        {item.valuationKind === "projected" ? (
                          <Badge tone="olive" title="Projetado por composição da taxa atual (Selic/CDI/IPCA) até 31/12">
                            projetado
                          </Badge>
                        ) : null}
                        {item.valuationKind === "provisional" ? (
                          <Badge tone="navy" title="Valor de hoje — ainda vai mudar até 31/12">
                            provisório
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    {showCnpj ? (
                      <td className="py-2.5 pr-3 text-faint-foreground text-[11.5px] truncate">
                        {item.cnpj == null ? (
                          "—"
                        ) : item.cnpj === "não exigido" ? (
                          <span className="italic">não exigido</span>
                        ) : (
                          <span className="font-mono">{item.cnpj}</span>
                        )}
                      </td>
                    ) : null}
                    <td className="py-2.5 pr-3 font-mono text-right tabular-nums text-faint-foreground">
                      R$ {fmtBRL(item.previousYearValue)}
                    </td>
                    <td className="py-2.5 font-mono text-right tabular-nums text-foreground font-medium">
                      R$ {fmtBRL(item.currentYearValue)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border-strong">
                  <td
                    colSpan={showCnpj ? 3 : 2}
                    className="pt-2.5 pr-3 font-mono text-[11px] uppercase tracking-[0.12em] text-faint-foreground font-medium"
                  >
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
        );
      })}
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
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium flex items-center gap-1.5">
            Total 31/12/{report.year}
            {report.yearStatus === "in_progress" ? (
              <Badge
                tone="navy"
                title="Ano em curso: RF é projetada pela Selic atual; demais ativos refletem hoje. Edite manualmente antes de exportar pra Receita."
              >
                provisório
              </Badge>
            ) : null}
          </div>
          <div className="font-mono text-[17px] tabular-nums mt-1 text-foreground font-medium">
            R$ {fmtBRL(report.totals.current)}
          </div>
          {report.yearStatus === "in_progress" ? (
            <div className="font-mono text-[10px] text-faint-foreground mt-1 leading-snug">
              {report.yearStatusBreakdown.projected > 0 ? (
                <>
                  {report.yearStatusBreakdown.projected} projetado
                  {report.yearStatusBreakdown.projected === 1 ? "" : "s"} ·{" "}
                </>
              ) : null}
              {report.yearStatusBreakdown.provisional} provisóri
              {report.yearStatusBreakdown.provisional === 1 ? "o" : "os"}
            </div>
          ) : null}
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
      {report.yearStatus === "in_progress" ? (
        <p className="text-[11.5px] text-muted-foreground italic leading-relaxed pt-3 border-t border-border/40">
          O ano-base ainda está em curso. Valores marcados como{" "}
          <b className="not-italic">projetado</b> são compostos pela Selic/CDI/IPCA atual
          até 31/12/{report.year}; <b className="not-italic">provisórios</b> refletem o
          valor de hoje (contas, ações, FIIs, bens — sem base pra projetar com precisão).
          Edite manualmente antes de exportar pra Receita.
        </p>
      ) : null}
    </div>
  );
}
