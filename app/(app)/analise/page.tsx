import { ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { CategoriesBarChart } from "@/components/charts/categories-bar-chart";
import { IncomeExpenseLine } from "@/components/charts/income-expense-line";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import {
  getCategoryBreakdown,
  getCategoryMovers,
  getMonthlyHistory,
  monthRange,
} from "@/services/transactions";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

function currentMonthISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  return fmt.format(new Date());
}

export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const [history, breakdown, movers] = await Promise.all([
    getMonthlyHistory(6, month, { includeForecast: true }),
    getCategoryBreakdown(month, "expense"),
    getCategoryMovers(month, "expense"),
  ]);
  const hasForecastInChart = history.some((r) => r.isForecast);

  const { label: monthLabel, from } = monthRange(month);
  const monthISO = from.slice(0, 7);
  const isCurrent = monthISO === currentMonthISO();
  const current = history[history.length - 1];
  const prev = history[history.length - 2];

  const incomeDelta = prev && prev.income > 0 ? current.income / prev.income - 1 : null;
  const expenseDelta = prev && prev.expense > 0 ? current.expense / prev.expense - 1 : null;
  const netDelta = prev ? current.net - prev.net : null;

  // Sparklines (últimos 6 meses)
  const incomeSpark = history.map((r) => r.income);
  const expenseSpark = history.map((r) => r.expense);
  const netSpark = history.map((r) => r.net);

  // Top 3 movers que subiram e top 3 que cairam
  const movedUp = movers.filter((m) => m.delta > 0).slice(0, 3);
  const movedDown = movers.filter((m) => m.delta < 0).slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow={`Insights · ${history.length} meses até ${monthLabel}`}
        title={
          <>
            Seu <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">histórico</em>
          </>
        }
        subtitle="Para onde o dinheiro foi, de onde veio, e como vocês mudaram nos últimos meses."
        actions={
          <MonthSwitcher
            currentMonth={monthISO}
            isCurrent={isCurrent}
            label={monthLabel.split(" ")[0]}
          />
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label={`Entrou em ${monthLabel}`}
          value={current?.income ?? 0}
          tone="positive"
          deltaPct={incomeDelta}
          sparkline={incomeSpark}
          sparklineTone="olive"
        />
        <KpiCard
          label={`Saiu em ${monthLabel}`}
          value={current?.expense ?? 0}
          tone="negative"
          deltaPct={expenseDelta}
          invertDeltaColor
          sparkline={expenseSpark}
          sparklineTone="rust"
        />
        <KpiCard
          label={`Sobra de ${monthLabel}`}
          value={current?.net ?? 0}
          tone={(current?.net ?? 0) >= 0 ? "positive" : "negative"}
          deltaAbs={netDelta}
          sparkline={netSpark}
          sparklineTone="navy"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mb-5">
        <Panel>
          <PanelHeader
            title="Receitas vs Despesas"
            meta={`${history[0]?.label} → ${history[history.length - 1]?.label}`}
          />
          <IncomeExpenseLine rows={history} />
          {hasForecastInChart ? (
            <p className="text-[11px] font-mono text-faint-foreground mt-2">
              * meses futuros com previsão das recorrências (círculo vazado)
            </p>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader title="Top categorias" meta={monthLabel} />
          <CategoriesBarChart rows={breakdown} />
        </Panel>
      </div>

      {/* Biggest movers — onde o comportamento mudou */}
      {(movedUp.length > 0 || movedDown.length > 0) && prev ? (
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <Panel>
            <PanelHeader
              title="Maiores altas"
              meta={`vs ${prev.label}`}
              action={
                <span className="font-mono text-[10.5px] text-rust-600 uppercase tracking-[0.12em] inline-flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" strokeWidth={1.8} /> aumento
                </span>
              }
            />
            {movedUp.length === 0 ? (
              <p className="text-[12.5px] text-faint-foreground italic">
                Nenhuma categoria subiu mais que R$ 10 vs mês anterior.
              </p>
            ) : (
              <MoverList items={movedUp} direction="up" />
            )}
          </Panel>
          <Panel>
            <PanelHeader
              title="Maiores quedas"
              meta={`vs ${prev.label}`}
              action={
                <span className="font-mono text-[10.5px] text-olive-700 dark:text-olive-500 uppercase tracking-[0.12em] inline-flex items-center gap-1">
                  <ArrowDown className="w-3 h-3" strokeWidth={1.8} /> economia
                </span>
              }
            />
            {movedDown.length === 0 ? (
              <p className="text-[12.5px] text-faint-foreground italic">
                Nenhuma categoria caiu mais que R$ 10 vs mês anterior.
              </p>
            ) : (
              <MoverList items={movedDown} direction="down" />
            )}
          </Panel>
        </div>
      ) : null}

      <Panel className="!px-0">
        <div className="px-4 sm:px-7 pt-1">
          <PanelHeader title="Comparativo mês a mês" meta="receita, despesa, sobra" />
        </div>

        {/* Mobile: cards verticais */}
        <div className="lg:hidden">
          {history.map((r, idx) => {
            const prevRow = history[idx - 1];
            const deltaPct = prevRow && prevRow.expense > 0 ? r.expense / prevRow.expense - 1 : null;
            const savingsRate = r.income > 0 ? r.net / r.income : null;
            return (
              <div key={r.month} className="px-4 py-3.5 border-b border-border last:border-b-0">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="capitalize font-medium tracking-[-0.005em] text-[14px]">
                    {r.label}
                    <span className="text-faint-foreground ml-1 text-[11px] font-mono">
                      {r.month.slice(0, 4)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "font-mono text-[15px] font-medium",
                      r.net >= 0 ? "text-foreground" : "text-rust-600",
                    )}
                  >
                    <MoneyMask>{formatMoney(r.net)}</MoneyMask>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11.5px]">
                  <div>
                    <div className="text-[9.5px] uppercase tracking-[0.12em] text-faint-foreground">
                      Entrou
                    </div>
                    <div className="mt-0.5 text-olive-700 dark:text-olive-500">
                      <MoneyMask>{formatMoney(r.income)}</MoneyMask>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9.5px] uppercase tracking-[0.12em] text-faint-foreground">
                      Saiu
                    </div>
                    <div className="mt-0.5 text-rust-600">
                      <MoneyMask>{formatMoney(r.expense)}</MoneyMask>
                    </div>
                    {deltaPct != null ? (
                      <div
                        className={cn(
                          "text-[10px] mt-0.5",
                          deltaPct > 0.05
                            ? "text-rust-600"
                            : deltaPct < -0.05
                              ? "text-olive-700 dark:text-olive-500"
                              : "text-muted-foreground",
                        )}
                      >
                        {deltaPct > 0 ? "+" : ""}
                        {(deltaPct * 100).toFixed(0)}%
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-[9.5px] uppercase tracking-[0.12em] text-faint-foreground">
                      Poupança
                    </div>
                    {savingsRate == null ? (
                      <div className="text-faint-foreground mt-0.5">—</div>
                    ) : (
                      <div
                        className={cn(
                          "mt-0.5",
                          savingsRate >= 0.3
                            ? "text-olive-700 dark:text-olive-500"
                            : savingsRate >= 0.1
                              ? "text-foreground"
                              : savingsRate >= 0
                                ? "text-muted-foreground"
                                : "text-rust-600",
                        )}
                      >
                        {(savingsRate * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden lg:block overflow-x-auto px-7">
          <table className="w-full text-[13.5px]">
            <thead className="sticky top-0 bg-surface z-10 shadow-[0_1px_0_0_var(--color-border)]">
              <tr className="text-faint-foreground">
                <th className="text-left font-mono text-[10.5px] uppercase tracking-[0.14em] py-2.5 font-medium">
                  Mês
                </th>
                <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] py-2.5 font-medium">
                  Entrou
                </th>
                <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] py-2.5 font-medium">
                  Saiu
                </th>
                <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] py-2.5 font-medium">
                  Sobra
                </th>
                <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] py-2.5 font-medium">
                  Δ Saiu
                </th>
                <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] py-2.5 font-medium">
                  Taxa de poupança
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((r, idx) => {
                const prev = history[idx - 1];
                const deltaPct = prev && prev.expense > 0 ? r.expense / prev.expense - 1 : null;
                const savingsRate = r.income > 0 ? r.net / r.income : null;
                return (
                  <tr key={r.month} className="border-b border-border last:border-b-0">
                    <td className="py-3 capitalize font-medium tracking-[-0.005em]">
                      {r.label}
                      <span className="text-faint-foreground ml-1 text-[11px] font-mono">
                        {r.month.slice(0, 4)}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      <MoneyMask>{formatMoney(r.income)}</MoneyMask>
                    </td>
                    <td className="text-right font-mono">
                      <MoneyMask>{formatMoney(r.expense)}</MoneyMask>
                    </td>
                    <td
                      className={cn(
                        "text-right font-mono font-medium",
                        r.net >= 0 ? "text-foreground" : "text-rust-600",
                      )}
                    >
                      <MoneyMask>{formatMoney(r.net)}</MoneyMask>
                    </td>
                    <td className="text-right font-mono">
                      {deltaPct === null ? (
                        <span className="text-faint-foreground">—</span>
                      ) : (
                        <span
                          className={
                            deltaPct > 0.05
                              ? "text-rust-600"
                              : deltaPct < -0.05
                                ? "text-olive-700 dark:text-olive-500"
                                : "text-muted-foreground"
                          }
                        >
                          {deltaPct > 0 ? "+" : ""}
                          {(deltaPct * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono">
                      {savingsRate == null ? (
                        <span className="text-faint-foreground">—</span>
                      ) : (
                        <span
                          className={
                            savingsRate >= 0.3
                              ? "text-olive-700 dark:text-olive-500"
                              : savingsRate >= 0.1
                                ? "text-foreground"
                                : savingsRate >= 0
                                  ? "text-muted-foreground"
                                  : "text-rust-600"
                          }
                        >
                          {(savingsRate * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function MoverList({
  items,
  direction,
}: {
  items: { category_id: string | null; category_name: string; delta: number; pct: number | null }[];
  direction: "up" | "down";
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((m) => (
        <li
          key={m.category_id ?? m.category_name}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-[13.5px] text-foreground truncate">{m.category_name}</span>
          <div className="text-right shrink-0">
            <div
              className={cn(
                "font-mono text-[13px] tabular-nums",
                direction === "up" ? "text-rust-600" : "text-olive-700 dark:text-olive-500",
              )}
            >
              {m.delta >= 0 ? "+" : ""}
              <MoneyMask>{formatMoney(m.delta)}</MoneyMask>
            </div>
            {m.pct != null ? (
              <div className="font-mono text-[10.5px] text-faint-foreground tabular-nums">
                {m.delta >= 0 ? "+" : ""}
                {formatPercent(m.pct, 0)}
              </div>
            ) : (
              <div className="font-mono text-[10.5px] text-faint-foreground italic">
                {direction === "up" ? "novo" : "—"}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
