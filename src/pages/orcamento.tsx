import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Check, ChevronLeft, ChevronRight, Circle, Copy, Repeat } from "lucide-react";
import { useUI } from "@/store/ui";
import { useViewer } from "@/store/viewer";
import { useRates } from "@/store/rates";
import { useBudgetMonth } from "@/store/budget-month";
import { useBudget } from "@/hooks/use-budget";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { categoryColors, expenseColors } from "@/money/composition";
import { nameById, EXPENSE_CARD, type TaxonomyItem } from "@/domain/taxonomy";
import { topLevelExpenses, expenseTotal, expenseLeaves, expenseByPerson } from "@/finance/statement";
import { upcomingBills } from "@/domain/bills";
import { BILL_STATUS_TONE, dueDateLabel, daysLabel } from "@/components/common/bill-format";
import type { Expense, Income } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
import { CardSubNav } from "@/components/common/card-sub-nav";
import Assinaturas from "@/pages/assinaturas";
import { StatementDetail } from "@/pages/statement-detail";
import { DataGrid, type GridColumn, type SelectOption } from "@/components/grid/data-grid";

type BudgetRow = { id: string; month: string; categoryId: string; name: string; currency: Currency; amount: number; recurring?: boolean; dueDay?: number; paid?: boolean; received?: boolean; parentId?: string; isStatement?: boolean; personId?: string };

/** Normaliza o vínculo do lançamento no commit: "" (desmarcado) → undefined; e uma fatura
 *  (categoria Cartão) nunca fica DENTRO de outra fatura (não faz sentido aninhar cartão em cartão). */
function normalizeExpenseLink(e: Expense): Expense {
  const parentId = e.categoryId === EXPENSE_CARD ? undefined : e.parentId || undefined;
  return { ...e, parentId };
}

type Slice = { id: string; name: string; value: number };
/** Limita o donut a N fatias: as (N−1) maiores + uma "Outros" agregando a cauda. Sem isso, um
 *  extrato de cartão itemizado (dezenas de compras pequenas) vira um anel de fatias minúsculas
 *  (com o paddingAngle, parece pontos espalhados). Recebe as fatias JÁ ordenadas desc. */
const MAX_SLICES = 9;
function capSlices(slices: Slice[], othersLabel: string): Slice[] {
  if (slices.length <= MAX_SLICES) return slices;
  const rest = slices.slice(MAX_SLICES - 1);
  const value = rest.reduce((s, x) => s + x.value, 0);
  return [...slices.slice(0, MAX_SLICES - 1), { id: "__others__", name: `${othersLabel} · ${rest.length}`, value }];
}

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
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

/** Cards da aba Orçamento (âncoras + rótulos da sub-nav sticky). "Vencimentos" é condicional
 *  (some sem contas a pagar) — a CardSubNav omite a aba quando o card não está no DOM. */
const SUBNAV: { id: string; key: string }[] = [
  { id: "orc-ano", key: "orcamento.tabYear" },
  { id: "orc-vencimentos", key: "orcamento.tabBills" },
  { id: "orc-composicao", key: "orcamento.tabBreakdown" },
  { id: "orc-pessoas", key: "orcamento.tabPeople" },
  { id: "orc-receitas", key: "orcamento.income" },
  { id: "orc-gastos", key: "orcamento.expenses" },
  { id: "orc-assinaturas", key: "nav.assinaturas" },
];

export default function Orcamento() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const tax = useTaxonomy();
  const data = useBudget();
  const CAT_EXP = expenseColors(theme); // gastos = rampa quente/vermelha
  const CAT_INC = categoryColors(theme); // receitas = rampa verde (oposto aos gastos)
  const viewerMode = useViewer((s) => s.viewerMode);
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";
  const axis = theme === "dark" ? "#5f646c" : "#8a8f98";
  const month = useBudgetMonth((s) => s.month);
  const setMonth = useBudgetMonth((s) => s.setMonth);
  // Ano do gráfico anual: segue o mês selecionado; o usuário navega outros anos com ◀ ▶.
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  useEffect(() => setYear(Number(month.slice(0, 4))), [month]);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const monthExp = data.expenses.filter((e) => e.month === month);
    const monthInc = data.incomes.filter((i) => i.month === month);

    // Donut: agrupado por CATEGORIA (uma fatia por categoria). Usa as FOLHAS dos gastos, então os
    // itens da fatura contam na SUA categoria (Amil→Saúde…) e a sobra "não discriminado" na categoria
    // da fatura (Cartão de Crédito) — a soma bate com o total top-level (sem dupla contagem).
    const sumByCat = <T,>(items: T[], catOf: (x: T) => string, valOf: (x: T) => number, names: TaxonomyItem[]) => {
      const by = new Map<string, number>();
      for (const it of items) by.set(catOf(it), (by.get(catOf(it)) ?? 0) + valOf(it));
      return capSlices(
        [...by]
          .map(([catId, value]) => ({ id: catId, name: nameById(names, catId) || t("orcamento.uncategorized"), value }))
          .filter((s) => s.value > 0)
          .sort((a, b) => b.value - a.value),
        t("orcamento.othersSlice"),
      );
    };
    const expSlices = sumByCat(expenseLeaves(monthExp, rates), (l) => l.categoryId, (l) => conv(l.amount, l.currency), tax.expenseCategories);
    const incSlices = sumByCat(monthInc, (i) => i.categoryId, (i) => conv(i.amount, i.currency), tax.incomeCategories);
    const totalExp = expenseTotal(monthExp, disp, rates); // só top-level (faturas + avulsos)
    const totalInc = monthInc.reduce((s, i) => s + conv(i.amount, i.currency), 0);

    // Variação vs o mês anterior.
    const pm = shiftMonth(month, -1);
    const prevExp = expenseTotal(data.expenses.filter((e) => e.month === pm), disp, rates);
    const prevInc = data.incomes.filter((i) => i.month === pm).reduce((s, i) => s + conv(i.amount, i.currency), 0);
    return {
      monthExp,
      monthInc,
      expSlices,
      incSlices,
      totalExp,
      totalInc,
      saldo: totalInc - totalExp,
      incDelta: prevInc > 0 ? ((totalInc - prevInc) / prevInc) * 100 : null,
      expDelta: prevExp > 0 ? ((totalExp - prevExp) / prevExp) * 100 : null,
    };
  }, [data, disp, rates, tax, t, month, lang]);

  // Gráfico ANUAL: 12 meses (jan→dez) do ano exibido, receitas/gastos por mês (0 onde não há).
  const annual = useMemo(() => {
    if (!data) return [];
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const rows = Array.from({ length: 12 }, (_, m) => {
      const mo = `${year}-${String(m + 1).padStart(2, "0")}`;
      return { month: mo, label: monthLabel(mo, lang, true), receitas: 0, gastos: 0 };
    });
    const pfx = `${year}-`;
    for (const e of topLevelExpenses(data.expenses)) if (e.month.startsWith(pfx)) rows[Number(e.month.slice(5, 7)) - 1].gastos += conv(e.amount, e.currency);
    for (const i of data.incomes) if (i.month.startsWith(pfx)) rows[Number(i.month.slice(5, 7)) - 1].receitas += conv(i.amount, i.currency);
    return rows;
  }, [data, year, disp, rates, lang]);

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
  const cols = (
    categories: TaxonomyItem[],
    rows: BudgetRow[],
    bill?: { statusKey: "paid" | "received"; statusLabel: string },
  ): GridColumn<BudgetRow>[] => {
    const columns: GridColumn<BudgetRow>[] = [
      { key: "recurring", type: "toggle", header: t("orcamento.recurringShort"), width: "64px" },
      { key: "categoryId", type: "select", header: t("orcamento.category"), width: "minmax(140px,1.2fr)", placeholder: t("orcamento.categoryPlaceholder"), options: opts(categories), indentable: true },
      { key: "name", type: "text", header: t("orcamento.detail"), width: "minmax(150px,1.6fr)", placeholder: t("orcamento.detailPlaceholder") },
    ];
    // "Pessoa" (portador) — só aparece quando há 2+ integrantes cadastrados (não polui quem mora só).
    if (tax.people.length >= 2) {
      columns.push({ key: "personId", type: "select", header: t("orcamento.person"), width: "minmax(96px,0.9fr)", optional: true, options: tax.people.map((p) => ({ value: p.id, label: p.name })) });
    }
    if (bill) {
      columns.push({ key: "dueDay", type: "day", header: t("orcamento.dueDay"), width: "84px", align: "right" });
      // "Pago"/"Recebido": check só nas linhas COM dia (dueDay) — reflete/alterna o status (o mesmo
      // `paid` da seção Vencimentos, nos gastos). Padroniza receitas e gastos. Sem dia → "—".
      columns.push({ key: bill.statusKey, type: "toggle", header: bill.statusLabel, width: "58px", icon: Check, isOn: (r) => !!r[bill.statusKey], hideWhen: (r) => r.dueDay == null });
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
  // Tabela principal: só TOP-LEVEL (faturas + avulsos). Os itens DENTRO de uma fatura vivem no
  // painel expansível da própria fatura (accordion) — não poluem a lista nem contam em dobro.
  const topLevelExp = topLevelExpenses(view.monthExp) as BudgetRow[];
  const prev = shiftMonth(month, -1);

  // Resumo "Por pessoa" (só com 2+ integrantes): gastou (por FOLHA — item da fatura conta pela sua
  // pessoa; "não discriminado" pela pessoa da fatura) · recebeu · saldo. Sem pessoa = "Compartilhado".
  const peopleRows =
    tax.people.length >= 2
      ? (() => {
          const spent = expenseByPerson(view.monthExp, disp, rates);
          const recv: Record<string, number> = {};
          for (const i of view.monthInc) {
            const k = i.personId ?? "";
            recv[k] = (recv[k] ?? 0) + conv(i.amount, i.currency);
          }
          const rows = tax.people.map((p) => ({ id: p.id, name: p.name, spent: spent[p.id] ?? 0, received: recv[p.id] ?? 0 }));
          const sSpent = spent[""] ?? 0;
          const sRecv = recv[""] ?? 0;
          if (sSpent > 0.005 || sRecv > 0.005) rows.push({ id: "", name: t("orcamento.personShared"), spent: sSpent, received: sRecv });
          return rows.map((r) => ({ ...r, saldo: r.received - r.spent }));
        })()
      : null;

  // Apagar uma fatura SOLTA seus itens (parentId → undefined): voltam a ser lançamentos normais,
  // pra o valor nunca sumir do total (não vira órfão preso a um cartão inexistente).
  const removeExpenseAndDetach = async (id: string) => {
    for (const c of view.monthExp.filter((e) => e.parentId === id)) {
      await actions.putExpense({ ...c, parentId: undefined });
    }
    await actions.removeExpense(id);
  };

  // Painel de DETALHE de uma fatura (accordion): itens da fatura + "não discriminado" + import CSV.
  // Adicionar/importar aqui já linka parentId = id da fatura → nunca soma em dobro no total do mês.
  const statementCats = tax.expenseCategories.filter((c) => c.id !== EXPENSE_CARD);
  const renderStatementDetail = (fatura: BudgetRow) => (
    <StatementDetail
      fatura={fatura as Expense}
      items={view.monthExp.filter((e) => e.parentId === fatura.id)}
      categories={statementCats}
      people={tax.people}
      rates={rates}
    />
  );

  return (
    <div className="space-y-5 sm:space-y-7">
      <CardSubNav items={SUBNAV.map((s) => ({ id: s.id, label: t(s.key) }))} />
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

      {/* Ao longo do ano — barras dos 12 meses do ano exibido (seletor de ano; clique abre o mês) */}
      <div id="orc-ano">
      <Tile className="p-4 sm:p-6 md:p-7">
        <div className="flex items-center justify-between mb-4">
          <Eyebrow>{t("orcamento.alongYear")}</Eyebrow>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label={t("orcamento.prevYear")} className="grid place-items-center w-8 h-8 rounded-[8px] text-muted hover:text-text hover:bg-card-hover transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[14px] font-semibold tabular w-[52px] text-center">{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label={t("orcamento.nextYear")} className="grid place-items-center w-8 h-8 rounded-[8px] text-muted hover:text-text hover:bg-card-hover transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="w-full h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annual} margin={{ top: 4, right: 6, bottom: 0, left: 6 }} barGap={1} barCategoryGap="28%">
              <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: axis }} axisLine={false} tickLine={false} dy={4} />
              <Tooltip
                cursor={{ fill: "var(--card-2)" }}
                formatter={(val, name) => [formatMoney(Number(val), disp), t(`orcamento.${name as string}` as string)]}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
              />
              <Bar dataKey="receitas" name="income" fill={accent} radius={[3, 3, 0, 0]} maxBarSize={16} cursor="pointer" onClick={(d: { payload?: { month?: string } }) => d?.payload?.month && setMonth(d.payload.month)}>
                {annual.map((r) => (
                  <Cell key={r.month} fillOpacity={r.month === month ? 1 : 0.38} />
                ))}
              </Bar>
              <Bar dataKey="gastos" name="expenses" fill="#f1746a" radius={[3, 3, 0, 0]} maxBarSize={16} cursor="pointer" onClick={(d: { payload?: { month?: string } }) => d?.payload?.month && setMonth(d.payload.month)}>
                {annual.map((r) => (
                  <Cell key={r.month} fillOpacity={r.month === month ? 1 : 0.38} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-5 mt-3 text-[11.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: accent }} />{t("orcamento.income")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#f1746a]" />{t("orcamento.expenses")}</span>
          <span className="text-faint">{t("orcamento.historyHint")}</span>
        </div>
      </Tile>
      </div>

      {/* Contas a pagar / próximos vencimentos */}
      <UpcomingBillsTile />

      {/* Mês selecionado: receitas e gastos por categoria — SEMPRE lado a lado (ghost quando vazio).
          items-start: cada card com altura NATURAL (não estica pra igualar o outro → sem vão). */}
      <div id="orc-composicao" className="grid lg:grid-cols-2 gap-6 items-start">
        <CategoryDonut title={t("orcamento.incomeBreakdown")} data={view.incSlices} palette={CAT_INC} disp={disp} emptyLabel={t("orcamento.noIncomeMonth")} />
        <CategoryDonut title={t("orcamento.expenseBreakdown")} data={view.expSlices} palette={CAT_EXP} disp={disp} emptyLabel={t("orcamento.noExpenseMonth")} />
      </div>

      {/* Por pessoa (só com 2+ integrantes): um CARD por integrante, numa linha (auto-fit) — quebra
          só quando não couber. Mesmo padrão sempre: nome, Gastou/Recebeu e Saldo destacado embaixo. */}
      {peopleRows ? (
        <section id="orc-pessoas">
          <SectionHead title={t("orcamento.tabPeople")} count={peopleRows.length} />
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {peopleRows.map((p) => (
              <div key={p.id || "shared"} className="rounded-[14px] border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-card)]">
                <div className="truncate text-[14px] font-medium text-text">{p.name}</div>
                <div className="mt-3 space-y-1.5">
                  <PersonStat label={t("orcamento.personSpent")}>
                    <Money value={p.spent} currency={disp} className="text-neg" options={{ signDisplay: "never" }} />
                  </PersonStat>
                  <PersonStat label={t("orcamento.personReceived")}>
                    <Money value={p.received} currency={disp} className="text-accent" />
                  </PersonStat>
                </div>
                <div className="mt-2.5 border-t border-border pt-2.5">
                  <PersonStat label={t("orcamento.personBalance")} strong>
                    <Money value={p.saldo} currency={disp} className={p.saldo >= 0 ? "text-accent" : "text-neg"} />
                  </PersonStat>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Receitas (mês) */}
      <section id="orc-receitas">
        <SectionHead title={t("orcamento.income")} count={view.monthInc.length} />
        <div className="overflow-x-auto">
          <div className="min-w-0 sm:min-w-[600px]">
            <DataGrid<BudgetRow>
              key={month}
              columns={cols(tax.incomeCategories, view.monthInc as BudgetRow[], { statusKey: "received", statusLabel: t("orcamento.receivedShort") })}
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
      <section id="orc-gastos">
        <SectionHead title={t("orcamento.expenses")} count={view.monthExp.length} />
        <div className="overflow-x-auto">
          <div className="min-w-0 sm:min-w-[600px] grid-neg">
            <DataGrid<BudgetRow>
              key={month}
              columns={cols(tax.expenseCategories, topLevelExp, { statusKey: "paid", statusLabel: t("orcamento.paidShort") })}
              rows={topLevelExp}
              expandableRow={(r) => r.categoryId === EXPENSE_CARD}
              renderRowDetail={renderStatementDetail}
              blank={blank}
              isComplete={complete}
              onCommit={(r) => void actions.putExpense(normalizeExpenseLink(normalizeBill(r as Expense)))}
              onDelete={(id) => void removeExpenseAndDetach(id)}
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

      {/* Assinaturas (documentação — lista global, NÃO soma no total do orçamento). */}
      <div id="orc-assinaturas">
        <Assinaturas />
      </div>
    </div>
  );
}

/** Linha de métrica do card "Por pessoa": rótulo mono à esquerda, valor tabular à direita.
 *  `strong` destaca o Saldo (maior/mais forte). */
function PersonStat({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-faint">{label}</span>
      <span className={cn("tabular", strong ? "text-[15px] font-semibold" : "text-[13.5px] font-medium")}>{children}</span>
    </div>
  );
}

/** Donut de categorias (mês): rosca + legenda em pares compactos. Reusado por receitas (verde)
 *  e gastos (quente) — só muda título, dados e paleta. */
function CategoryDonut({
  title,
  data,
  palette,
  disp,
  emptyLabel,
}: {
  title: string;
  data: { id: string; name: string; value: number }[];
  palette: string[];
  disp: Currency;
  emptyLabel: string;
}) {
  // Fade na base da legenda SÓ quando ainda há item abaixo do que cabe (dica de "role pra ver mais").
  // Some ao chegar no fim → o ÚLTIMO item nunca fica esmaecido à toa. Recalcula no scroll e no resize.
  const listRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const check = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // Vazio: mantém o card visível com um anel "fantasma" + dica, em vez de sumir (layout estável).
  if (data.length === 0) {
    return (
      <Tile className="p-4 sm:p-6 md:p-7">
        <Eyebrow className="mb-4">{title}</Eyebrow>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-[128px] h-[128px] shrink-0 rounded-full border-[21px] border-card2" aria-hidden />
          <span className="text-[12.5px] text-faint">{emptyLabel}</span>
        </div>
      </Tile>
    );
  }
  return (
    <Tile className="p-4 sm:p-6 md:p-7">
      <Eyebrow className="mb-4">{title}</Eyebrow>
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="w-[128px] h-[128px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
                {data.map((e, i) => (
                  <Cell key={e.id} fill={palette[i % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => formatMoney(Number(v), disp)}
                contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legenda com altura FIXA (= a do donut) + rolagem sutil: o card fica do MESMO tamanho
            com 3 ou 100 itens, e os dois cards (receitas/gastos) sempre alinhados. Fade na base
            só quando há mais itens do que cabem (dica de "role pra ver mais"; não corta lista curta). */}
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
          }}
          className="flex flex-1 flex-col gap-y-2 min-w-0 max-h-[128px] overflow-y-auto scrollbar-subtle pr-1"
          style={
            moreBelow
              ? {
                  maskImage: "linear-gradient(to bottom, #000 calc(100% - 22px), transparent)",
                  WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 22px), transparent)",
                }
              : undefined
          }
        >
          {data.map((e, i) => (
            <div key={e.id} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: palette[i % palette.length] }} />
              {/* Nome no flow (trunca) + valor SEMPRE colado à direita (coluna alinhada, estilo recibo). */}
              <span className="min-w-0 flex-1 truncate text-muted">{e.name}</span>
              <Money value={e.value} currency={disp} className="shrink-0 font-semibold tabular" />
            </div>
          ))}
        </div>
      </div>
    </Tile>
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
  const month = useBudgetMonth((s) => s.month);
  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    // Só os vencimentos do mês em exibição (não misturar contas de outros meses).
    const bills = upcomingBills(data.expenses, todayISO()).filter((b) => b.month === month);
    const total = bills.reduce((s, b) => s + conv(b.amount, b.currency), 0);
    return { bills, total };
  }, [data, disp, rates, month]);
  if (!view || view.bills.length === 0) return null;

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const pay = (id: string) => {
    const e = data?.expenses.find((x) => x.id === id);
    if (e) void actions.putExpense({ ...e, paid: true });
  };
  const shown = view.bills.slice(0, 8);
  const extra = view.bills.length - shown.length;

  const TPL = "44px minmax(150px,1.8fr) minmax(130px,1fr) minmax(110px,0.8fr)";
  const headCls = "px-3 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted";
  return (
    <section id="orc-vencimentos">
      <SectionHead title={t("orcamento.upcomingBills")} count={view.bills.length} />

      {/* MOBILE: lista compacta (a tabela em grid não cabe na tela do celular). */}
      <div className="sm:hidden overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] divide-y divide-[var(--grid-line)]">
        {shown.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-3.5 py-2.5">
            {viewerMode ? (
              <Circle size={17} className="shrink-0 text-faint" />
            ) : (
              <button
                type="button"
                onClick={() => pay(b.id)}
                aria-label={t("orcamento.markPaid")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint hover:bg-card-hover hover:text-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Circle size={17} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] text-text">{b.name || nameById(tax.expenseCategories, b.categoryId) || t("orcamento.uncategorized")}</div>
              <div className={cn("mt-0.5 text-[11.5px] tabular", BILL_STATUS_TONE[b.status])}>
                {dueDateLabel(b.dueDate, lang)} · {daysLabel(t, b.status, b.daysUntil)}
              </div>
            </div>
            <Money value={conv(b.amount, b.currency)} currency={disp} className="shrink-0 text-[13.5px] font-medium tabular" />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 bg-card2 px-3.5 py-2.5">
          <span className="text-[11px] text-faint">{extra > 0 ? t("orcamento.moreBills", { n: extra }) : null}</span>
          <Money value={view.total} currency={disp} className="text-[13px] font-semibold tabular text-neg" options={{ signDisplay: "never" }} />
        </div>
      </div>

      {/* DESKTOP/TABLET: tabela em grid. */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-0 sm:min-w-[480px] rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
          {/* Cabeçalho */}
          <div className="grid items-center bg-card2 border-b border-border" style={{ gridTemplateColumns: TPL }}>
            <div className="px-2 py-2.5" />
            <div className={headCls}>{t("orcamento.detail")}</div>
            <div className={headCls}>{t("orcamento.dueColumn")}</div>
            <div className={cn(headCls, "text-right")}>{t("orcamento.amount")}</div>
          </div>
          {/* Linhas */}
          {shown.map((b) => (
            <div key={b.id} className="group grid items-center border-b border-[var(--grid-line)] hover:bg-card-hover transition-colors" style={{ gridTemplateColumns: TPL }}>
              <div className="flex justify-center py-1.5">
                {viewerMode ? (
                  <Circle size={17} className="text-faint shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => pay(b.id)}
                    title={t("orcamento.markPaid")}
                    aria-label={t("orcamento.markPaid")}
                    className="grid place-items-center w-7 h-7 rounded-full text-faint hover:text-accent hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Circle size={17} />
                  </button>
                )}
              </div>
              <div className="px-3 py-2.5 text-[13.5px] text-text truncate">
                {b.name || nameById(tax.expenseCategories, b.categoryId) || t("orcamento.uncategorized")}
              </div>
              <div className={cn("px-3 py-2.5 text-[12.5px] tabular", BILL_STATUS_TONE[b.status])}>
                {dueDateLabel(b.dueDate, lang)} · {daysLabel(t, b.status, b.daysUntil)}
              </div>
              <div className="px-3 py-2.5 text-right">
                <Money value={conv(b.amount, b.currency)} currency={disp} className="text-[13.5px] font-medium tabular" />
              </div>
            </div>
          ))}
          {/* Rodapé: +N mais (esq.) + total (dir.) */}
          <div className="grid items-center bg-card2 border-t border-border" style={{ gridTemplateColumns: TPL }}>
            <div className="px-3 py-2.5 text-[11px] text-faint" style={{ gridColumn: "1 / -2" }}>
              {extra > 0 ? t("orcamento.moreBills", { n: extra }) : null}
            </div>
            <div className="px-3 py-2.5 text-right">
              <Money value={view.total} currency={disp} className="text-[13px] font-semibold tabular text-neg" options={{ signDisplay: "never" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
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
    const totalExp = expenseTotal(data.expenses.filter((e) => e.month === mo), disp, rates); // só top-level (bate com a tabela)
    const totalInc = data.incomes.filter((i) => i.month === mo).reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const saldo = totalInc - totalExp;
    const bills = upcomingBills(data.expenses, todayISO()).filter((b) => b.month === mo);
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
