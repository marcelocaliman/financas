import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { CategoriesBarChart } from "@/components/charts/categories-bar-chart";
import { IncomeExpenseLine } from "@/components/charts/income-expense-line";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import {
  getCategoryBreakdown,
  getMonthlyHistory,
  monthRange,
} from "@/services/transactions";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

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
  const [history, breakdown] = await Promise.all([
    getMonthlyHistory(6, month, { includeForecast: true }),
    getCategoryBreakdown(month, "expense"),
  ]);
  const hasForecastInChart = history.some((r) => r.isForecast);

  const { label: monthLabel, from } = monthRange(month);
  const monthISO = from.slice(0, 7);
  const isCurrent = monthISO === currentMonthISO();
  const current = history[history.length - 1];
  const prev = history[history.length - 2];

  const incomeDelta =
    prev && prev.income > 0 ? current.income / prev.income - 1 : null;
  const expenseDelta =
    prev && prev.expense > 0 ? current.expense / prev.expense - 1 : null;
  const netDelta = prev ? current.net - prev.net : null;

  return (
    <>
      <PageHeader
        eyebrow={`Insights · ${history.length} meses até ${monthLabel}`}
        title={
          <>
            Análise <em className="not-italic font-display italic text-navy-700">financeira</em>
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

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <DeltaCard
          label={`Entrou em ${monthLabel}`}
          value={current?.income ?? 0}
          delta={incomeDelta}
          tone="positive"
        />
        <DeltaCard
          label={`Saiu em ${monthLabel}`}
          value={current?.expense ?? 0}
          delta={expenseDelta}
          tone="negative"
          invertDeltaColor
        />
        <DeltaCard
          label={`Sobra de ${monthLabel}`}
          value={current?.net ?? 0}
          delta={netDelta}
          isAbsoluteDelta
          tone={(current?.net ?? 0) >= 0 ? "positive" : "negative"}
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

      <Panel>
        <PanelHeader title="Comparativo mês a mês" meta="receita, despesa, sobra" />
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-border text-faint-foreground">
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
                Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((r, idx) => {
              const prev = history[idx - 1];
              const deltaPct = prev && prev.expense > 0 ? r.expense / prev.expense - 1 : null;
              return (
                <tr key={r.month} className="border-b border-border last:border-b-0">
                  <td className="py-3 capitalize font-medium tracking-[-0.005em]">
                    {r.label}
                    <span className="text-faint-foreground ml-1 text-[11px] font-mono">
                      {r.month.slice(0, 4)}
                    </span>
                  </td>
                  <td className="text-right font-mono"><MoneyMask>{formatMoney(r.income)}</MoneyMask></td>
                  <td className="text-right font-mono"><MoneyMask>{formatMoney(r.expense)}</MoneyMask></td>
                  <td className="text-right font-mono font-medium">
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
                              ? "text-olive-700"
                              : "text-muted-foreground"
                        }
                      >
                        {deltaPct > 0 ? "+" : ""}
                        {(deltaPct * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function DeltaCard({
  label,
  value,
  delta,
  tone,
  invertDeltaColor,
  isAbsoluteDelta,
}: {
  label: string;
  value: number;
  delta: number | null;
  tone: "positive" | "negative";
  invertDeltaColor?: boolean;
  isAbsoluteDelta?: boolean;
}) {
  const goodWhenUp = !invertDeltaColor;
  const deltaTone =
    delta === null
      ? "text-faint-foreground"
      : (delta > 0) === goodWhenUp
        ? "text-olive-700"
        : "text-rust-600";

  return (
    <div className="rounded-[var(--radius)] bg-surface border border-border px-5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div
        className={`mt-1.5 font-mono text-[22px] tracking-[-0.02em] ${tone === "positive" ? "text-foreground" : "text-rust-600"}`}
      >
        <MoneyMask>{formatMoney(value)}</MoneyMask>
      </div>
      <div className={`mt-1 font-mono text-[11.5px] ${deltaTone}`}>
        {delta === null ? (
          "primeiro mês"
        ) : isAbsoluteDelta ? (
          <>{delta >= 0 ? "+" : ""}<MoneyMask>{formatMoney(delta)}</MoneyMask> vs mês anterior</>
        ) : (
          `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}% vs mês anterior`
        )}
      </div>
    </div>
  );
}
