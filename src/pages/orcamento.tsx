import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useBudget } from "@/hooks/use-budget";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { categoryColors } from "@/money/composition";
import { nameById, type TaxonomyItem } from "@/domain/taxonomy";
import type { Expense, Income } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn, type SelectOption } from "@/components/grid/data-grid";

type BudgetRow = { id: string; categoryId: string; name: string; currency: Currency; amount: number };

export default function Orcamento() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const tax = useTaxonomy();
  const data = useBudget();
  const CAT = categoryColors(theme);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    // Agrupa GASTOS por categoria (pro donut e o "tudo batendo" com o card do Painel).
    const byCat = new Map<string, number>();
    for (const e of data.expenses) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + conv(e.amount, e.currency));
    const expByCat = [...byCat.entries()]
      .map(([id, value]) => ({ id, name: nameById(tax.expenseCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    const totalExp = data.expenses.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = data.incomes.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    return { expByCat, totalExp, totalInc, saldo: totalInc - totalExp };
  }, [data, disp, rates, tax, t]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const opts = (items: TaxonomyItem[]): SelectOption[] => items.map((i) => ({ value: i.id, label: i.name }));
  const cols = (categories: TaxonomyItem[], rows: BudgetRow[]): GridColumn<BudgetRow>[] => {
    const columns: GridColumn<BudgetRow>[] = [
      {
        key: "categoryId",
        type: "select",
        header: t("orcamento.category"),
        width: "minmax(140px,1.2fr)",
        placeholder: t("orcamento.categoryPlaceholder"),
        options: opts(categories),
      },
      { key: "name", type: "text", header: t("orcamento.detail"), width: "minmax(150px,1.6fr)", placeholder: t("orcamento.detailPlaceholder") },
      { key: "amount", type: "money", header: t("orcamento.monthly"), width: "minmax(150px,1.1fr)", align: "right", currencyKey: "currency" },
    ];
    // "Em <moeda>" só aparece quando há de fato conversão (alguma linha em moeda ≠ da exibida).
    if (rows.some((r) => r.currency !== disp)) {
      columns.push({
        key: "conv",
        type: "computed",
        header: `${t("patrimonio.in")} ${CURRENCY_SYMBOL[disp]}`,
        width: "minmax(88px,0.8fr)",
        align: "right",
        compute: (r) => formatMoney(conv(r.amount, r.currency), disp),
      });
    }
    return columns;
  };

  const blank = (): BudgetRow => ({ id: crypto.randomUUID(), categoryId: "", name: "", currency: base, amount: 0 });
  const complete = (r: BudgetRow) => r.categoryId.length > 0 && r.amount > 0;

  return (
    <div className="space-y-7">
      {/* Gastos por categoria */}
      {view.expByCat.length > 0 ? (
        <Tile className="p-6 md:p-7">
          <Eyebrow className="mb-4">{t("orcamento.byCategory")}</Eyebrow>
          <div className="flex items-center gap-5">
            <div className="w-[128px] h-[128px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={view.expByCat} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
                    {view.expByCat.map((e, i) => (
                      <Cell key={e.id} fill={CAT[i % CAT.length]} />
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
              {view.expByCat.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between text-[12.5px] gap-3">
                  <span className="flex items-center gap-2 text-muted truncate">
                    <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: CAT[i % CAT.length] }} />
                    {e.name}
                  </span>
                  <Money value={e.value} currency={disp} className="font-medium tabular" />
                </div>
              ))}
            </div>
          </div>
        </Tile>
      ) : null}

      {/* Receitas */}
      <section>
        <SectionHead title={t("orcamento.income")} count={data.incomes.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <DataGrid<BudgetRow>
              columns={cols(tax.incomeCategories, data.incomes as BudgetRow[])}
              rows={data.incomes as BudgetRow[]}
              blank={blank}
              isComplete={complete}
              onCommit={(r) => void actions.putIncome(r as Income)}
              onDelete={(id) => void actions.removeIncome(id)}
              addPlaceholder={t("orcamento.detailPlaceholder")}
              total={<Money value={view.totalInc} currency={disp} />}
            />
          </div>
        </div>
      </section>

      {/* Gastos */}
      <section>
        <SectionHead title={t("orcamento.expenses")} count={data.expenses.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <DataGrid<BudgetRow>
              columns={cols(tax.expenseCategories, data.expenses as BudgetRow[])}
              rows={data.expenses as BudgetRow[]}
              blank={blank}
              isComplete={complete}
              onCommit={(r) => void actions.putExpense(r as Expense)}
              onDelete={(id) => void actions.removeExpense(id)}
              addPlaceholder={t("orcamento.detailPlaceholder")}
              total={<Money value={view.totalExp} currency={disp} className="text-neg" options={{ signDisplay: "never" }} />}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/** KPIs do cabeçalho do accordion de Orçamento. */
export function OrcamentoSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useBudget();
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const totalExp = data.expenses.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = data.incomes.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    return { totalExp, totalInc, saldo: totalInc - totalExp };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("orcamento.balance")} tone={v.saldo >= 0 ? "text" : "neg"} value={<Money value={v.saldo} currency={disp} />} />
      <HeaderKpi secondary label={t("orcamento.income")} tone="accent" value={<Money value={v.totalInc} currency={disp} />} />
      <HeaderKpi secondary label={t("orcamento.expenses")} tone="neg" value={<Money value={v.totalExp} currency={disp} options={{ signDisplay: "never" }} />} />
    </HeaderKpis>
  );
}
