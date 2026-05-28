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

  // Decide se mostra coluna do ano anterior. Quando incompleto (faltam saldos
  // manuais pra ativos que existiam em 31/12/N-1), esconde pra evitar
  // comparação enganosa com dados parciais.
  const showPrevYear = report.previousYearIsComplete && report.totals.previous > 0;
  // Variação só faz sentido se tiver os 2 lados completos
  const showVariation = showPrevYear;
  // Ano em curso → tabela mostra valor ATUAL (estado real do broker).
  // Ano fechado → tabela mostra o valor FINAL do snapshot 31/12.
  // A projeção 31/12 fica visível só no rodapé como stat agregado.
  const inProgress = report.yearStatus === "in_progress";
  const currentColumnHeader = inProgress ? "Atual · hoje" : `31/12/${report.year}`;
  const getItemDisplayValue = (item: typeof report.byGroup[number]["items"][number]) =>
    inProgress ? item.todayValue : item.currentYearValue;
  const getGroupDisplayTotal = (g: typeof report.byGroup[number]) =>
    inProgress ? g.totalToday : g.totalCurrent;

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
                {showPrevYear ? <col className="w-[140px]" /> : null}
                <col className="w-[140px]" />
              </colgroup>
              <thead>
                <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
                  <th className="text-left pb-2 pr-3 font-medium">Cod</th>
                  <th className="text-left pb-2 pr-3 font-medium">Discriminação</th>
                  {showCnpj ? (
                    <th className="text-left pb-2 pr-3 font-medium">CNPJ</th>
                  ) : null}
                  {showPrevYear ? (
                    <th className="text-right pb-2 pr-3 font-medium">
                      31/12/{report.year - 1}
                    </th>
                  ) : null}
                  <th className="text-right pb-2 font-medium">{currentColumnHeader}</th>
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
                      {item.fxNote ? (
                        <Badge tone="gold" className="mt-1">moeda estrangeira</Badge>
                      ) : null}
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
                    {showPrevYear ? (
                      <td className="py-2.5 pr-3 font-mono text-right tabular-nums text-faint-foreground">
                        R$ {fmtBRL(item.previousYearValue)}
                      </td>
                    ) : null}
                    <td className="py-2.5 font-mono text-right tabular-nums text-foreground font-medium">
                      R$ {fmtBRL(getItemDisplayValue(item))}
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
                  {showPrevYear ? (
                    <td className="pt-2.5 pr-3 font-mono text-right tabular-nums text-faint-foreground">
                      R$ {fmtBRL(g.totalPrevious)}
                    </td>
                  ) : null}
                  <td className="pt-2.5 font-mono text-right tabular-nums text-foreground font-medium">
                    R$ {fmtBRL(getGroupDisplayTotal(g))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        );
      })}

      {/* Rodapé discriminado: tabela com breakdown por classe + totais */}
      <div className="pt-4 border-t-2 border-border-strong space-y-4">
        {/* Tabela de breakdown por classe */}
        {report.byClass.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground">
                  <th className="text-left pb-2 font-medium">Classe</th>
                  <th className="text-right pb-2 font-medium pl-4">Aplicado</th>
                  <th className="text-right pb-2 font-medium pl-4">{inProgress ? "Atual · hoje" : `31/12/${report.year}`}</th>
                  <th className="text-right pb-2 font-medium pl-4">Variação</th>
                </tr>
              </thead>
              <tbody>
                {report.byClass.map((c) => {
                  const varColor =
                    c.variation > 0.005
                      ? "text-olive-700 dark:text-olive-500"
                      : c.variation < -0.005
                        ? "text-rust-600"
                        : "text-faint-foreground";
                  // Conta corrente não tem conceito de "aplicado" (saldo = saldo). Exibe — se
                  // aplicado for igual a atual e classe é "Contas" pra evitar ruído.
                  const isAccountClass = c.label.startsWith("Contas");
                  const hideVariation = isAccountClass && Math.abs(c.variation) < 0.005;
                  return (
                    <tr key={c.label} className="border-t border-border/60">
                      <td className="py-2 text-foreground">{c.label}</td>
                      <td className="py-2 pl-4 font-mono text-right tabular-nums text-muted-foreground">
                        R$ {fmtBRL(c.applied)}
                      </td>
                      <td className="py-2 pl-4 font-mono text-right tabular-nums text-foreground">
                        R$ {fmtBRL(c.today)}
                      </td>
                      <td className="py-2 pl-4 font-mono text-right tabular-nums">
                        {hideVariation ? (
                          <span className="text-faint-foreground italic">—</span>
                        ) : (
                          <div className="flex flex-col items-end leading-tight">
                            <span className={varColor}>
                              {c.variation >= 0 ? "+" : ""}R$ {fmtBRL(c.variation)}
                            </span>
                            <span className={`text-[10.5px] ${varColor}`}>
                              {c.variation >= 0 ? "+" : ""}{c.variationPct.toFixed(1).replace(".", ",")}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(() => {
                  const totalApplied = report.byClass.reduce((s, c) => s + c.applied, 0);
                  const totalVariation = report.totals.today - totalApplied;
                  const totalVariationPct = totalApplied > 0 ? (totalVariation / totalApplied) * 100 : 0;
                  const varColor =
                    totalVariation > 0.005
                      ? "text-olive-700 dark:text-olive-500"
                      : totalVariation < -0.005
                        ? "text-rust-600"
                        : "text-foreground";
                  return (
                    <tr className="border-t-2 border-border-strong font-medium">
                      <td className="pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
                        Patrimônio total
                      </td>
                      <td className="pt-3 pl-4 font-mono text-right tabular-nums text-muted-foreground text-[15px]">
                        R$ {fmtBRL(totalApplied)}
                      </td>
                      <td className="pt-3 pl-4 font-mono text-right tabular-nums text-foreground text-[15px]">
                        R$ {fmtBRL(report.totals.today)}
                      </td>
                      <td className="pt-3 pl-4 font-mono text-right tabular-nums text-[15px]">
                        <div className="flex flex-col items-end leading-tight">
                          <span className={varColor}>
                            {totalVariation >= 0 ? "+" : ""}R$ {fmtBRL(totalVariation)}
                          </span>
                          <span className={`text-[10.5px] ${varColor}`}>
                            {totalVariation >= 0 ? "+" : ""}{totalVariationPct.toFixed(1).replace(".", ",")}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
            <p className="font-mono text-[10.5px] text-faint-foreground mt-3 leading-relaxed">
              <b className="not-italic text-muted-foreground">Aplicado</b>: custo de
              aquisição. <b className="not-italic text-muted-foreground">{inProgress ? "Atual · hoje" : `31/12/${report.year}`}</b>:
              {inProgress ? " valor de mercado agora — vai virar o saldo de 31/12 quando o ano fechar." : " valor congelado da declaração."} {" "}
              <b className="not-italic text-muted-foreground">Variação</b>:
              lucro/prejuízo acumulado (atual − aplicado).
            </p>
          </div>
        ) : null}

        {/* Variação vs N-1 só quando tem dados completos do ano anterior */}
        {showPrevYear || showVariation ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-border/60">
            {showPrevYear ? (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                  Total 31/12/{report.year - 1}
                </div>
                <div className="font-mono text-[15px] tabular-nums mt-1 text-muted-foreground">
                  R$ {fmtBRL(report.totals.previous)}
                </div>
              </div>
            ) : null}
            {showVariation ? (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
                  Variação vs {report.year - 1}
                </div>
                <div
                  className={
                    "font-mono text-[15px] tabular-nums mt-1 " +
                    (report.totals.delta >= 0
                      ? "text-olive-700 dark:text-olive-500"
                      : "text-rust-600")
                  }
                >
                  {report.totals.delta >= 0 ? "+" : ""}R$ {fmtBRL(report.totals.delta)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
