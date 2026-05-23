import { FileText, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { getAnnualReport } from "@/services/annual-report";
import { formatMoney, formatPercent, formatDateShort } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { YearSwitcher } from "./year-switcher";

export const dynamic = "force-dynamic";

type SearchParams = { year?: string };

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { year: yearStr } = await searchParams;
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getUTCFullYear() - 1;
  const report = await getAnnualReport(year);

  return (
    <>
      <PageHeader
        eyebrow="Relatório anual"
        title={
          <>
            Fechamento de <em className="not-italic font-display italic text-navy-700">{report.year}</em>
          </>
        }
        subtitle="Resumo do ano fiscal: fluxo de caixa, top categorias, bens declaráveis e proventos. Use como referência pra IRPF — não substitui orientação contábil."
        actions={<YearSwitcher current={report.year} />}
      />

      {/* KPIs do ano */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        <KpiCard label="Entrou no ano" value={report.totalIncome} tone="positive" />
        <KpiCard label="Saiu no ano" value={report.totalExpense} tone="negative" />
        <KpiCard
          label="Sobra anual"
          value={report.totalSavings}
          tone={report.totalSavings >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Taxa de poupança"
          textValue={formatPercent(report.savingsRate, 0)}
          tone={
            report.savingsRate >= 0.3
              ? "positive"
              : report.savingsRate >= 0.1
                ? "neutral"
                : report.savingsRate >= 0
                  ? "muted"
                  : "negative"
          }
          hint={
            report.savingsRate >= 0.3
              ? "ritmo excelente"
              : report.savingsRate >= 0.1
                ? "saudável"
                : report.savingsRate >= 0
                  ? "apertado mas positivo"
                  : "no vermelho"
          }
        />
      </div>

      {/* Mês a mês */}
      <Panel className="mb-7">
        <PanelHeader title={`Fluxo mês a mês — ${report.year}`} meta="receita, despesa, sobra" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-faint-foreground">
              <tr className="border-b border-border">
                <Th>Mês</Th>
                <Th right>Entrou</Th>
                <Th right>Saiu</Th>
                <Th right>Sobra</Th>
                <Th right>Taxa</Th>
              </tr>
            </thead>
            <tbody>
              {report.monthlyBreakdown.map((m) => {
                const rate = m.income > 0 ? m.net / m.income : null;
                return (
                  <tr key={m.month} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 capitalize font-medium">
                      {m.label}
                      <span className="text-faint-foreground ml-1 text-[11px] font-mono">
                        {report.year}
                      </span>
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      <MoneyMask>{formatMoney(m.income)}</MoneyMask>
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      <MoneyMask>{formatMoney(m.expense)}</MoneyMask>
                    </td>
                    <td
                      className={
                        "text-right font-mono font-medium tabular-nums " +
                        (m.net >= 0 ? "text-foreground" : "text-rust-600")
                      }
                    >
                      <MoneyMask>{formatMoney(m.net)}</MoneyMask>
                    </td>
                    <td className="text-right font-mono text-faint-foreground">
                      {rate == null ? "—" : formatPercent(rate, 0)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-surface-muted/50">
                <td className="py-2.5 font-medium uppercase tracking-[0.06em] text-[11px]">
                  Total
                </td>
                <td className="text-right font-mono font-medium tabular-nums">
                  <MoneyMask>{formatMoney(report.totalIncome)}</MoneyMask>
                </td>
                <td className="text-right font-mono font-medium tabular-nums">
                  <MoneyMask>{formatMoney(report.totalExpense)}</MoneyMask>
                </td>
                <td className="text-right font-mono font-bold tabular-nums">
                  <MoneyMask>{formatMoney(report.totalSavings)}</MoneyMask>
                </td>
                <td className="text-right font-mono text-faint-foreground">
                  {formatPercent(report.savingsRate, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Top categorias */}
      {report.topExpenseCategories.length > 0 ? (
        <Panel className="mb-7">
          <PanelHeader
            title="Onde o dinheiro foi"
            meta={`top 10 categorias de despesa em ${report.year}`}
          />
          <ul className="space-y-2.5">
            {report.topExpenseCategories.map((c) => (
              <li key={c.categoryName} className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] text-foreground truncate flex-1">
                  {c.categoryName}
                </span>
                <span className="font-mono text-[11.5px] text-faint-foreground tabular-nums">
                  {c.transactionCount} {c.transactionCount === 1 ? "tx" : "txs"}
                </span>
                <span className="font-mono text-[13px] tabular-nums text-foreground">
                  <MoneyMask>{formatMoney(c.total)}</MoneyMask>
                </span>
                <span className="font-mono text-[10.5px] text-faint-foreground tabular-nums w-12 text-right">
                  {formatPercent(c.pct, 0)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* Bens declaráveis */}
      <Panel className="mb-7">
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <FileText className="w-4 h-4 text-navy-700" strokeWidth={1.7} />
              Declaração de bens · 31/dez
            </span>
          }
          meta={`total: ${formatMoney(report.declarableAssets.totalDeclarable)}`}
        />

        {/* Contas */}
        {report.declarableAssets.accounts.length > 0 ? (
          <div className="mb-5">
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
              Contas correntes / poupança / dinheiro
            </h3>
            <ul className="space-y-1.5">
              {report.declarableAssets.accounts.map((a, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 text-[12.5px] font-mono"
                >
                  <span className="text-foreground truncate flex-1">
                    {a.name} <span className="text-faint-foreground">· {a.institution}</span>
                  </span>
                  <span className="text-foreground tabular-nums shrink-0">
                    <MoneyMask>{formatMoney(a.balanceEndOfYear, a.currency)}</MoneyMask>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Investimentos */}
        {report.declarableAssets.investments.length > 0 ? (
          <div className="mb-5">
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
              Investimentos
            </h3>
            <ul className="space-y-1.5">
              {report.declarableAssets.investments.map((inv) => (
                <li
                  key={inv.ticker}
                  className="flex items-baseline justify-between gap-3 text-[12.5px] font-mono"
                >
                  <span className="text-foreground truncate flex-1">
                    {inv.ticker}{" "}
                    <span className="text-faint-foreground">· {inv.name}</span>
                  </span>
                  <span className="text-muted-foreground text-[11px] mr-2">
                    pago: <MoneyMask>{formatMoney(inv.initialAmount, inv.currency)}</MoneyMask>
                  </span>
                  <span className="text-foreground tabular-nums shrink-0">
                    <MoneyMask>{formatMoney(inv.balanceEndOfYear, inv.currency)}</MoneyMask>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Bens físicos */}
        {report.declarableAssets.physical.length > 0 ? (
          <div>
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
              Bens físicos
            </h3>
            <ul className="space-y-1.5">
              {report.declarableAssets.physical.map((p, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 text-[12.5px] font-mono"
                >
                  <span className="text-foreground truncate flex-1">
                    {p.name}{" "}
                    <span className="text-faint-foreground">· {p.category}</span>
                  </span>
                  <span className="text-muted-foreground text-[11px] mr-2">
                    pago: <MoneyMask>{formatMoney(p.acquiredValue, p.currency)}</MoneyMask>
                  </span>
                  <span className="text-foreground tabular-nums shrink-0">
                    <MoneyMask>{formatMoney(p.currentValue, p.currency)}</MoneyMask>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      {/* Investimentos */}
      <div className="grid lg:grid-cols-2 gap-5 mb-7">
        <Panel>
          <PanelHeader title="Compras + vendas + proventos" meta={`movimentos em ${report.year}`} />
          <div className="grid grid-cols-3 gap-3 mb-4 text-[12.5px] font-mono">
            <div>
              <div className="text-faint-foreground text-[10px] uppercase tracking-[0.12em]">
                Comprado
              </div>
              <div className="text-foreground tabular-nums mt-0.5">
                <MoneyMask>{formatMoney(report.investmentMovements.totalBought)}</MoneyMask>
              </div>
            </div>
            <div>
              <div className="text-faint-foreground text-[10px] uppercase tracking-[0.12em]">
                Vendido
              </div>
              <div className="text-foreground tabular-nums mt-0.5">
                <MoneyMask>{formatMoney(report.investmentMovements.totalSold)}</MoneyMask>
              </div>
            </div>
            <div>
              <div className="text-faint-foreground text-[10px] uppercase tracking-[0.12em]">
                Proventos
              </div>
              <div className="text-olive-700 dark:text-olive-500 tabular-nums mt-0.5">
                <MoneyMask>
                  {formatMoney(report.investmentMovements.totalDividends)}
                </MoneyMask>
              </div>
            </div>
          </div>
          {report.investmentMovements.rows.length > 0 ? (
            <div className="max-h-72 overflow-y-auto pr-2">
              <ul className="space-y-1">
                {report.investmentMovements.rows.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-2 text-[11.5px] font-mono"
                  >
                    <span className="text-faint-foreground tabular-nums w-[60px]">
                      {formatDateShort(m.date)}
                    </span>
                    <span className="text-foreground flex-1 min-w-0 truncate">
                      <Badge
                        tone={
                          m.kind === "buy"
                            ? "navy"
                            : m.kind === "sell"
                              ? "rust"
                              : "olive"
                        }
                      >
                        {m.kind === "buy" ? "C" : m.kind === "sell" ? "V" : "D"}
                      </Badge>{" "}
                      {m.ticker}
                    </span>
                    <span className="text-foreground tabular-nums">
                      <MoneyMask>{formatMoney(m.totalAmount)}</MoneyMask>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[12.5px] text-faint-foreground italic">
              Nenhum movimento de investimento esse ano.
            </p>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Rendimentos por regime" meta="auxilia preencher IRPF" />
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[13px] text-foreground font-medium">
                  Isentos / não-tributáveis
                </div>
                <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5">
                  LCI, LCA, Tesouro IPCA+ educacional, dividendos até R$ 20k/mês
                </div>
              </div>
              <div className="font-mono text-[16px] text-olive-700 dark:text-olive-500 tabular-nums">
                <MoneyMask>{formatMoney(report.yieldsByRegime.exempt)}</MoneyMask>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[13px] text-foreground font-medium">
                  Tributáveis (IR retido na fonte)
                </div>
                <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5">
                  Tesouro Selic, CDB, FII, juros de capital — declarar em &quot;Rendimentos sujeitos
                  à tributação exclusiva&quot;
                </div>
              </div>
              <div className="font-mono text-[16px] text-foreground tabular-nums">
                <MoneyMask>{formatMoney(report.yieldsByRegime.taxable)}</MoneyMask>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-faint-foreground mt-5 leading-relaxed">
            Os valores acima vêm da tabela <code>investment_yields</code>. Se vc não
            registra os yields mensalmente, esses números ficam zerados. O número de
            referência principal pro IRPF vem do informe de rendimentos da corretora.
          </p>
        </Panel>
      </div>

      {/* Disclaimer */}
      <Panel className="!p-5">
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-faint-foreground shrink-0 mt-0.5" strokeWidth={1.7} />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Este relatório é auxiliar — usa dados que você lançou no app. Pra
            declaração definitiva no IRPF, use os <b>informes de rendimentos</b>{" "}
            que cada banco/corretora emite em fev/mar. Os valores aqui ajudam a
            cruzar referências e identificar o que você tem que declarar como bem
            ou rendimento.
          </p>
        </div>
        <a
          href="/api/transactions/export"
          download={`financas-${report.year}.csv`}
          className="inline-flex items-center gap-1.5 mt-4 text-[12.5px] text-navy-700 hover:text-navy-900 transition-colors"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.8} />
          Exportar transações em CSV
        </a>
      </Panel>
    </>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`font-mono text-[10.5px] uppercase tracking-[0.14em] py-2 font-medium ${right ? "text-right pl-3" : "text-left pr-3"}`}
    >
      {children}
    </th>
  );
}
