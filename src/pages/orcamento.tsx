import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { CalendarClock, ChevronLeft, ChevronRight, Circle, Copy, Repeat } from "lucide-react";
import { useUI } from "@/store/ui";
import { useViewer } from "@/store/viewer";
import { useRates } from "@/store/rates";
import { useBudgetMonth } from "@/store/budget-month";
import { useBudget } from "@/hooks/use-budget";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { expenseColors } from "@/money/composition";
import { nameById, type TaxonomyItem } from "@/domain/taxonomy";
import { upcomingBills, type BillStatus } from "@/domain/bills";
import type { Expense, Income } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn, type SelectOption } from "@/components/grid/data-grid";

type BudgetRow = { id: string; month: string; categoryId: string; name: string; currency: Currency; amount: number; recurring?: boolean; dueDay?: number; paid?: boolean };

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dueDateLabel(dueDate: string, lang: string): string {
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { day: "2-digit", month: "short" });
}
const STATUS_TONE: Record<BillStatus, string> = {
  overdue: "text-neg",
  today: "text-neg",
  soon: "text-text",
  later: "text-faint",
};
/** Conta a pagar válida: dia 1–31 inteiro; 0/inválido limpa o vencimento (vira gasto comum). */
function normalizeBill(e: Expense): Expense {
  if (e.dueDay == null) return e;
  const d = Math.round(e.dueDay);
  if (d < 1) return { ...e, dueDay: undefined };
  return { ...e, dueDay: Math.min(31, d) };
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
  const CAT = expenseColors(theme); // gastos = rampa quente/vermelha (oposto ao verde das receitas)
  const viewerMode = useViewer((s) => s.viewerMode);
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";
  const axis = theme === "dark" ? "#5f646c" : "#8a8f98";
  const month = useBudgetMonth((s) => s.month);
  const setMonth = useBudgetMonth((s) => s.setMonth);

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

    // Variação vs o mês anterior.
    const pm = shiftMonth(month, -1);
    const prevExp = data.expenses.filter((e) => e.month === pm).reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const prevInc = data.incomes.filter((i) => i.month === pm).reduce((s, i) => s + conv(i.amount, i.currency), 0);
    return {
      monthExp,
      monthInc,
      expByCat,
      totalExp,
      totalInc,
      saldo: totalInc - totalExp,
      history,
      incDelta: prevInc > 0 ? ((totalInc - prevInc) / prevInc) * 100 : null,
      expDelta: prevExp > 0 ? ((totalExp - prevExp) / prevExp) * 100 : null,
    };
  }, [data, disp, rates, tax, t, month, lang]);

  // Recorrências: ao abrir um mês NOVO/futuro ainda sem fixos, trazê-los sozinhos do mês
  // anterior. Idempotente e dedupado na action; nunca reescreve o passado. UMA tentativa por
  // mês por sessão — assim apagar um fixo deste mês NÃO o ressuscita (respeita o usuário).
  const autofilled = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data || month < currentMonth() || autofilled.current.has(month)) return;
    const hasRec =
      data.expenses.some((e) => e.month === month && e.recurring) ||
      data.incomes.some((i) => i.month === month && i.recurring);
    if (hasRec) return;
    autofilled.current.add(month);
    void actions.materializeRecurring(month);
  }, [data, month]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const opts = (items: TaxonomyItem[]): SelectOption[] => items.map((i) => ({ value: i.id, label: i.name }));
  const cols = (categories: TaxonomyItem[], rows: BudgetRow[], withDueDay = false): GridColumn<BudgetRow>[] => {
    const columns: GridColumn<BudgetRow>[] = [
      { key: "recurring", type: "toggle", header: t("orcamento.recurringShort"), width: "64px" },
      { key: "categoryId", type: "select", header: t("orcamento.category"), width: "minmax(140px,1.2fr)", placeholder: t("orcamento.categoryPlaceholder"), options: opts(categories) },
      { key: "name", type: "text", header: t("orcamento.detail"), width: "minmax(150px,1.6fr)", placeholder: t("orcamento.detailPlaceholder") },
    ];
    if (withDueDay) {
      columns.push({ key: "dueDay", type: "day", header: t("orcamento.dueDay"), width: "84px", align: "right" });
    }
    columns.push({ key: "amount", type: "money", header: t("orcamento.monthly"), width: "minmax(150px,1.1fr)", align: "right", currencyKey: "currency" });
    if (rows.some((r) => r.currency !== disp)) {
      columns.push({ key: "conv", type: "computed", header: `${t("patrimonio.in")} ${CURRENCY_SYMBOL[disp]}`, width: "minmax(88px,0.8fr)", align: "right", compute: (r) => formatMoney(conv(r.amount, r.currency), disp) });
    }
    return columns;
  };

  const blank = (): BudgetRow => ({ id: crypto.randomUUID(), month, categoryId: "", name: "", currency: base, amount: 0, recurring: false });
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
          <MonthPicker value={month} onChange={setMonth} lang={lang} />
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("orcamento.nextMonth")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {empty && !viewerMode ? (
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

      {/* Variação vs o mês anterior */}
      {view.incDelta != null || view.expDelta != null ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] -mt-4">
          <span className="text-faint">{t("orcamento.vsPrev")}</span>
          {view.incDelta != null ? (
            <span className="text-muted">
              {t("orcamento.income")}{" "}
              <span className={`tabular ${view.incDelta >= 0 ? "text-accent" : "text-neg"}`}>
                <Hidden>{(view.incDelta >= 0 ? "+" : "") + Math.round(view.incDelta) + "%"}</Hidden>
              </span>
            </span>
          ) : null}
          {view.expDelta != null ? (
            <span className="text-muted">
              {t("orcamento.expenses")}{" "}
              <span className={`tabular ${view.expDelta <= 0 ? "text-accent" : "text-neg"}`}>
                <Hidden>{(view.expDelta >= 0 ? "+" : "") + Math.round(view.expDelta) + "%"}</Hidden>
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Contas a pagar / próximos vencimentos */}
      <UpcomingBillsTile />

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
          <div className="flex items-center gap-6">
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
            {/* Legenda: pares compactos (categoria + valor colados), que fluem em colunas. Com 1
                item fica organizado, sem o valor jogado no meio do card; com vários, preenche a largura. */}
            <div className="flex flex-wrap content-center gap-x-7 gap-y-2.5 min-w-0">
              {view.expByCat.map((e, i) => (
                <div key={e.id} className="inline-flex items-center gap-2.5 text-[12.5px]">
                  <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: CAT[i % CAT.length] }} />
                  <span className="text-muted">{e.name}</span>
                  <Money value={e.value} currency={disp} className="font-semibold tabular" />
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
              columns={cols(tax.expenseCategories, view.monthExp as BudgetRow[], true)}
              rows={view.monthExp as BudgetRow[]}
              blank={blank}
              isComplete={complete}
              onCommit={(r) => void actions.putExpense(normalizeBill(r as Expense))}
              onDelete={(id) => void actions.removeExpense(id)}
              addPlaceholder={t("orcamento.detailPlaceholder")}
              total={<Money value={view.totalExp} currency={disp} className="text-neg" options={{ signDisplay: "never" }} />}
            />
          </div>
        </div>
      </section>

      {/* Dica: o toggle ↻ marca lançamentos fixos que entram sozinhos nos próximos meses. */}
      <p className="flex items-center gap-2 text-[12px] text-faint">
        <Repeat size={13} className="shrink-0" />
        {t("orcamento.recurringHint")}
      </p>
    </div>
  );
}

/** Seletor de mês: clicar no nome abre um mini-calendário (ano + 12 meses) pra pular direto. */
function MonthPicker({ value, onChange, lang }: { value: string; onChange: (m: string) => void; lang: string }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.split("-")[0]));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setYear(Number(value.split("-")[0])), [value]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const [selY, selM] = value.split("-").map(Number);
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(2020, i, 1).toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { month: "short" }).replace(".", ""),
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="text-[15px] font-semibold capitalize min-w-[150px] text-center tabular px-2 py-1 rounded-[8px] hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {monthLabel(value, lang)}
      </button>
      {open ? (
        <div className="absolute z-50 left-0 mt-2 w-[260px] rounded-[12px] border border-border-strong bg-card shadow-[var(--shadow-float)] p-3">
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label="-1" className="grid place-items-center w-8 h-8 rounded-[8px] text-muted hover:text-text hover:bg-card-hover transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[14px] font-semibold tabular">{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="+1" className="grid place-items-center w-8 h-8 rounded-[8px] text-muted hover:text-text hover:bg-card-hover transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {monthNames.map((mname, i) => {
              const on = selY === year && selM === i + 1;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(`${year}-${String(i + 1).padStart(2, "0")}`);
                    setOpen(false);
                  }}
                  className={cn(
                    "py-2 rounded-[8px] text-[12.5px] font-medium capitalize transition-colors",
                    on ? "bg-accent text-[#0A0B0D]" : "text-muted hover:text-text hover:bg-card-hover",
                  )}
                >
                  {mname}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Contas a pagar: próximos vencimentos + atrasadas (não pagas), com marcação rápida de "paga". */
function UpcomingBillsTile() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const viewerMode = useViewer((s) => s.viewerMode);
  const rates = useRates((s) => s.rates);
  const tax = useTaxonomy();
  const data = useBudget();
  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const bills = upcomingBills(data.expenses, todayISO());
    const total = bills.reduce((s, b) => s + conv(b.amount, b.currency), 0);
    return { bills, total };
  }, [data, disp, rates]);
  if (!view || view.bills.length === 0) return null;

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const pay = (id: string) => {
    const e = data?.expenses.find((x) => x.id === id);
    if (e) void actions.putExpense({ ...e, paid: true });
  };
  const daysLabel = (status: BillStatus, daysUntil: number) =>
    status === "overdue" ? t("orcamento.overdueDays", { n: -daysUntil })
      : status === "today" ? t("orcamento.dueToday")
        : t("orcamento.dueInDays", { n: daysUntil });
  const shown = view.bills.slice(0, 8);
  const extra = view.bills.length - shown.length;

  return (
    <Tile className="p-6 md:p-7">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-muted shrink-0" />
          <Eyebrow>{t("orcamento.upcomingBills")}</Eyebrow>
        </div>
        <Money value={view.total} currency={disp} className="text-[13px] font-semibold tabular text-neg" options={{ signDisplay: "never" }} />
      </div>
      <ul className="divide-y divide-[var(--grid-line)]">
        {shown.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-2.5">
            {viewerMode ? (
              <Circle size={18} className="text-faint shrink-0" />
            ) : (
              <button
                type="button"
                onClick={() => pay(b.id)}
                title={t("orcamento.markPaid")}
                aria-label={t("orcamento.markPaid")}
                className="text-faint hover:text-accent transition-colors shrink-0 p-1 -m-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Circle size={18} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] text-text truncate">
                {b.name || nameById(tax.expenseCategories, b.categoryId) || t("orcamento.uncategorized")}
              </div>
              <div className={`text-[11.5px] tabular ${STATUS_TONE[b.status]}`}>
                {dueDateLabel(b.dueDate, lang)} · {daysLabel(b.status, b.daysUntil)}
              </div>
            </div>
            <Money value={conv(b.amount, b.currency)} currency={disp} className="text-[13.5px] font-medium tabular shrink-0" />
          </li>
        ))}
      </ul>
      {extra > 0 ? <p className="text-[11.5px] text-faint mt-3">{t("orcamento.moreBills", { n: extra })}</p> : null}
    </Tile>
  );
}

/** KPIs do cabeçalho do accordion de Orçamento — sempre o MÊS CORRENTE. */
export function OrcamentoSummary() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useBudget();
  const month = useBudgetMonth((s) => s.month); // sincronizado com o seletor da página
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const mo = month;
    const totalExp = data.expenses.filter((e) => e.month === mo).reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = data.incomes.filter((i) => i.month === mo).reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const saldo = totalInc - totalExp;
    const bills = upcomingBills(data.expenses, todayISO());
    const duePayable = bills.reduce((s, b) => s + conv(b.amount, b.currency), 0);
    return { totalExp, totalInc, saldo, savingsRate: totalInc > 0 ? (saldo / totalInc) * 100 : 0, duePayable, dueCount: bills.length };
  }, [data, disp, rates, month]);
  if (!v) return null;
  const ml = monthLabel(month, lang, true).replace(/\.$/, "");
  const monthLbl = `${ml.charAt(0).toUpperCase()}${ml.slice(1)} ${month.slice(0, 4)}`;
  return (
    <HeaderKpis>
      <HeaderKpi raw label={t("historico.month")} value={monthLbl} />
      <HeaderKpi label={t("orcamento.balance")} tone={v.saldo >= 0 ? "text" : "neg"} value={<Money value={v.saldo} currency={disp} />} />
      {v.totalInc > 0 ? (
        <HeaderKpi secondary label={t("orcamento.savingsRate")} tone={v.savingsRate >= 0 ? "accent" : "neg"} value={`${Math.round(v.savingsRate)}%`} />
      ) : null}
      <HeaderKpi secondary label={t("orcamento.income")} tone="accent" value={<Money value={v.totalInc} currency={disp} />} />
      <HeaderKpi secondary label={t("orcamento.expenses")} tone="neg" value={<Money value={v.totalExp} currency={disp} options={{ signDisplay: "never" }} />} />
      {v.dueCount > 0 ? (
        <HeaderKpi secondary label={t("orcamento.duePayable")} tone="neg" value={<Money value={v.duePayable} currency={disp} options={{ signDisplay: "never" }} />} />
      ) : null}
    </HeaderKpis>
  );
}
