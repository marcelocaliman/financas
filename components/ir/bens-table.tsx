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

      {/* Rodapé. Layout adapta: quando ano em curso E sem dados completos
          de N-1, mostra só Atual + Projeção (2 colunas). Caso contrário,
          inclui 31/12/N-1 e Variação. */}
      <div
        className={
          "pt-4 border-t-2 border-border-strong grid gap-4 " +
          (showPrevYear
            ? report.yearStatus === "in_progress"
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-3"
            : report.yearStatus === "in_progress"
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2")
        }
      >
        {showPrevYear ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Total 31/12/{report.year - 1}
            </div>
            <div className="font-mono text-[17px] tabular-nums mt-1">
              R$ {fmtBRL(report.totals.previous)}
            </div>
          </div>
        ) : null}
        {inProgress ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Atual · hoje
            </div>
            <div className="font-mono text-[17px] tabular-nums mt-1 text-foreground font-medium">
              R$ {fmtBRL(report.totals.today)}
            </div>
            <div className="font-mono text-[10px] text-faint-foreground mt-1">
              soma dos saldos do broker
            </div>
          </div>
        ) : null}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            {inProgress ? `Projeção 31/12/${report.year}` : `Total 31/12/${report.year}`}
          </div>
          <div
            className={
              "font-mono text-[17px] tabular-nums mt-1 font-medium " +
              (inProgress ? "text-muted-foreground" : "text-foreground")
            }
          >
            R$ {fmtBRL(report.totals.current)}
          </div>
          {inProgress && report.totals.yieldProjected > 0 ? (
            <div className="font-mono text-[10px] text-olive-700 dark:text-olive-500 mt-1 leading-snug">
              +R$ {fmtBRL(report.totals.yieldProjected)} estimado pela Selic
            </div>
          ) : null}
        </div>
        {showVariation ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Variação vs {report.year - 1}
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
        ) : null}
      </div>
    </div>
  );
}
