import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useBudget } from "@/hooks/use-budget";
import { actions } from "@/data/actions";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { categoryColors } from "@/money/composition";
import type { Expense, Income } from "@/domain/types";
import { Tile } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { StatBlock } from "@/components/common/stat-block";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

export default function Orcamento() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const data = useBudget();
  const CAT = categoryColors(theme);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const expDisp = data.expenses
      .map((e) => ({ name: e.name, value: conv(e.amount, e.currency) }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    const totalExp = data.expenses.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = data.incomes.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    return { expDisp, totalExp, totalInc, saldo: totalInc - totalExp };
  }, [data, disp, rates]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const moneyCol = {
    key: "conv",
    type: "computed" as const,
    header: `${t("patrimonio.in")} ${disp === "BRL" ? "R$" : disp}`,
    width: "minmax(88px,0.9fr)",
    align: "right" as const,
  };
  const cols = <T extends { currency: Currency; amount: number }>(ph: string): GridColumn<T>[] => [
    { key: "currency", type: "currency", header: "", width: "46px" },
    { key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.8fr)", placeholder: ph },
    { key: "amount", type: "money", header: t("orcamento.monthly"), width: "minmax(110px,1fr)", align: "right", currencyKey: "currency" },
    { ...moneyCol, compute: (r: T) => formatMoney(conv(r.amount, r.currency), disp) },
  ];

  const newIncome = (): Income => ({ id: crypto.randomUUID(), name: "", currency: disp, amount: 0 });
  const newExpense = (): Expense => ({ id: crypto.randomUUID(), name: "", currency: disp, amount: 0 });
  const complete = (r: { name: string; amount: number }) => r.name.trim().length > 0 && r.amount > 0;

  return (
    <div className="space-y-7">
      {/* Resumo do mês */}
      <Tile className="p-6 md:p-7">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <StatBlock label={t("orcamento.income")} tone="accent">
            <Money value={view.totalInc} currency={disp} />
          </StatBlock>
          <StatBlock label={t("orcamento.expenses")} tone="neg">
            <Money value={view.totalExp} currency={disp} options={{ signDisplay: "never" }} />
          </StatBlock>
          <StatBlock label={t("orcamento.balance")} tone={view.saldo >= 0 ? "text" : "neg"}>
            <Money value={view.saldo} currency={disp} />
          </StatBlock>
        </div>
        {view.expDisp.length > 0 ? (
          <div className="flex items-center gap-5 mt-7 pt-6 border-t border-border">
            <div className="w-[128px] h-[128px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={view.expDisp} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
                    {view.expDisp.map((e, i) => (
                      <Cell key={e.name} fill={CAT[i % CAT.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatMoney(Number(v), disp)}
                    contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid sm:grid-cols-2 gap-x-8 gap-y-1.5 min-w-0">
              {view.expDisp.map((e, i) => (
                <div key={e.name} className="flex items-center justify-between text-[12.5px] gap-3">
                  <span className="flex items-center gap-2 text-muted truncate">
                    <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: CAT[i % CAT.length] }} />
                    {e.name}
                  </span>
                  <Money value={e.value} currency={disp} className="font-medium tabular" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Tile>

      {/* Receitas */}
      <section>
        <SectionHead title={t("orcamento.income")} count={data.incomes.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <DataGrid<Income>
              columns={cols<Income>(t("orcamento.incomePlaceholder"))}
              rows={data.incomes}
              blank={newIncome}
              isComplete={complete}
              onCommit={(r) => void actions.putIncome(r)}
              onDelete={(id) => void actions.removeIncome(id)}
              addPlaceholder={t("orcamento.addIncome")}
              total={<Money value={view.totalInc} currency={disp} />}
            />
          </div>
        </div>
      </section>

      {/* Gastos */}
      <section>
        <SectionHead title={t("orcamento.expenses")} count={data.expenses.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <DataGrid<Expense>
              columns={cols<Expense>(t("orcamento.expensePlaceholder"))}
              rows={data.expenses}
              blank={newExpense}
              isComplete={complete}
              onCommit={(r) => void actions.putExpense(r)}
              onDelete={(id) => void actions.removeExpense(id)}
              addPlaceholder={t("orcamento.addExpense")}
              total={
                <Money value={view.totalExp} currency={disp} className="text-neg" options={{ signDisplay: "never" }} />
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
