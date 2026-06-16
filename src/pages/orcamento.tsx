import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
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

type BudgetRow = { id: string; month: string; categoryId: string; name: string; currency: Currency; amount: number };

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(month: string, delta: number): string {
  const [y, mm] = month.split("-").map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(month: string, lang: string, short = false): string {
  const [y, mm] = month.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", short ? { month: "short" } : { month: "long", year: "numeric" });
}

export default function Orcamento() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const tax = useTaxonomy();
  const data = useBudget();
  const CAT = categoryColors(theme);
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";
  const axis = theme === "dark" ? "#5f646c" : "#8a8f98";
  const [month, setMonth] = useState(currentMonth());

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const monthExp = data.expenses.filter((e) => e.month === month);
    const monthInc = data.incomes.filter((i) => i.month === month);

    const byCat = new Map<string, number>();
    for (const e of monthExp) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + conv(e.amount, e.currency));
    const expByCat = [...byCat.entries()]
      .map(([id, value]) => ({ id, name: nameById(tax.expenseCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    const totalExp = monthExp.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = monthInc.reduce((s, i) => s + conv(i.amount, i.currency), 0);

    // Histórico: todos os meses com lançamento, últimos 12.
    const hist = new Map<string, { receitas: number; gastos: number }>();
    for (const e of data.expenses) {
      const h = hist.get(e.month) ?? { receitas: 0, gastos: 0 };
      h.gastos += conv(e.amount, e.currency);
      hist.set(e.month, h);
    }
    for (const i of data.incomes) {
      const h = hist.get(i.month) ?? { receitas: 0, gastos: 0 };
      h.receitas += conv(i.amount, i.currency);
      hist.set(i.month, h);
    }
    const history = [...hist.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-12)
      .map(([mo, h]) => ({ month: mo, label: monthLabel(mo, lang, true), receitas: h.receitas, gastos: h.gastos, saldo: h.receitas - h.gastos }));

    return { monthExp, monthInc, expByCat, totalExp, totalInc, saldo: totalInc - totalExp, history };
  }, [data, disp, rates, tax, t, month, lang]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const opts = (items: TaxonomyItem[]): SelectOption[] => items.map((i) => ({ value: i.id, label: i.name }));
  const cols = (categories: TaxonomyItem[], rows: BudgetRow[]): GridColumn<BudgetRow>[] => {
    const columns: GridColumn<BudgetRow>[] = [
      { key: "categoryId", type: "select", header: t("orcamento.category"), width: "minmax(140px,1.2fr)", placeholder: t("orcamento.categoryPlaceholder"), options: opts(categories) },
      { key: "name", type: "text", header: t("orcamento.detail"), width: "minmax(150px,1.6fr)", placeholder: t("orcamento.detailPlaceholder") },
      { key: "amount", type: "money", header: t("orcamento.monthly"), width: "minmax(150px,1.1fr)", align: "right", currencyKey: "currency" },
    ];
    if (rows.some((r) => r.currency !== disp)) {
      columns.push({ key: "conv", type: "computed", header: `${t("patrimonio.in")} ${CURRENCY_SYMBOL[disp]}`, width: "minmax(88px,0.8fr)", align: "right", compute: (r) => formatMoney(conv(r.amount, r.currency), disp) });
    }
    return columns;
  };

  const blank = (): BudgetRow => ({ id: crypto.randomUUID(), month, categoryId: "", name: "", currency: base, amount: 0 });
  const complete = (r: BudgetRow) => r.categoryId.length > 0 && r.amount > 0;
  const isCurrent = month === currentMonth();
  const empty = view.monthExp.length === 0 && view.monthInc.length === 0;
  const prev = shiftMonth(month, -1);

  return (
    <div className="space-y-7">
      {/* Navegador de mês */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("orcamento.prevMonth")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <ChevronLeft size={18} />
          </button>
          <span className="text-[15px] font-semibold capitalize min-w-[150px] text-center tabular">{monthLabel(month, lang)}</span>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("orcamento.nextMonth")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {empty ? (
            <button type="button" onClick={() => void actions.copyBudgetMonth(prev, month)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] border border-border text-[12.5px] text-muted hover:text-text hover:bg-card-hover transition-colors">
              <Copy size={14} /> {t("orcamento.copyPrev")}
            </button>
          ) : null}
          {!isCurrent ? (
            <button type="button" onClick={() => setMonth(currentMonth())} className="h-9 px-3 rounded-[9px] text-[12.5px] text-accent hover:underline">
              {t("orcamento.thisMonth")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Histórico mensal */}
      {view.history.length > 1 ? (
        <Tile className="p-6 md:p-7">
          <Eyebrow className="mb-4">{t("orcamento.history")}</Eyebrow>
          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.history} margin={{ top: 4, right: 6, bottom: 0, left: 6 }} barGap={2}>
                <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: axis }} axisLine={false} tickLine={false} dy={4} />
                <Tooltip
                  cursor={{ fill: "var(--card-2)" }}
                  formatter={(val, name) => [formatMoney(Number(val), disp), t(`orcamento.${name as string}` as string)]}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                  labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
                />
                <Bar dataKey="receitas" name="income" fill={accent} radius={[3, 3, 0, 0]} maxBarSize={18} cursor="pointer" onClick={(d: { payload?: { month?: string } }) => d?.payload?.month && setMonth(d.payload.month)} />
                <Bar dataKey="gastos" name="expenses" fill="#f1746a" radius={[3, 3, 0, 0]} maxBarSize={18} cursor="pointer" onClick={(d: { payload?: { month?: string } }) => d?.payload?.month && setMonth(d.payload.month)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-5 mt-3 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: accent }} />{t("orcamento.income")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#f1746a]" />{t("orcamento.expenses")}</span>
            <span className="text-faint">{t("orcamento.historyHint")}</span>
          </div>
        </Tile>
      ) : null}

      {/* Gastos por categoria (mês selecionado) */}
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

      {/* Receitas (mês) */}
      <section>
        <SectionHead title={t("orcamento.income")} count={view.monthInc.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <DataGrid<BudgetRow>
              key={month}
              columns={cols(tax.incomeCategories, view.monthInc as BudgetRow[])}
              rows={view.monthInc as BudgetRow[]}
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

      {/* Gastos (mês) */}
      <section>
        <SectionHead title={t("orcamento.expenses")} count={view.monthExp.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <DataGrid<BudgetRow>
              key={month}
              columns={cols(tax.expenseCategories, view.monthExp as BudgetRow[])}
              rows={view.monthExp as BudgetRow[]}
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

/** KPIs do cabeçalho do accordion de Orçamento — sempre o MÊS CORRENTE. */
export function OrcamentoSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useBudget();
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const mo = currentMonth();
    const totalExp = data.expenses.filter((e) => e.month === mo).reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = data.incomes.filter((i) => i.month === mo).reduce((s, i) => s + conv(i.amount, i.currency), 0);
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
