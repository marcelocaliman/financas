import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, TrendingDown, Wallet } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { categoryColors } from "@/money/composition";
import { isInvestedClass, nameById, tipoSubtypesFor, REGION_FLAG, REGION_CURRENCY, MACRO, ASSET_MACROS, macroOf, type AssetMacro } from "@/domain/taxonomy";
import { debtPlan, amortizationBalances } from "@/finance/debt";
import type { Asset, Liability } from "@/domain/types";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { Kpi } from "@/components/common/kpi";
import { Tile, Eyebrow } from "@/components/common/tile";
import { CardSubNav } from "@/components/common/card-sub-nav";
import { useBalanceUpdater } from "@/store/balance-updater";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { DataGrid, type GridColumn, type SelectOption } from "@/components/grid/data-grid";
import Investimentos from "./investimentos";
import { cn } from "@/lib/utils";

const LANG_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };
/** Rótulo "mês/ano" para N meses à frente de hoje. */
function monthsAheadLabel(monthsAhead: number, lang: string): string {
  const d = new Date();
  const target = new Date(d.getFullYear(), d.getMonth() + Math.round(monthsAhead), 1);
  return target.toLocaleDateString(LANG_LOCALE[lang] ?? "pt-BR", { month: "short", year: "numeric" });
}

/** Cards da aba Patrimônio (âncoras + rótulos da sub-nav sticky). Alocação/Passivos são
 *  condicionais — a CardSubNav omite a aba quando o card não está no DOM. */
const SUBNAV: { id: string; key: string }[] = [
  { id: "pat-alocacao", key: "patrimonio.allocation" },
  { id: "pat-ativos", key: "patrimonio.assets" },
  { id: "pat-investimentos", key: "nav.investimentos" },
  { id: "pat-passivos", key: "patrimonio.liabilities" },
];

/** Rótulo i18n de cada macro-categoria (abas de Ativos). */
const MACRO_LABEL: Record<string, string> = {
  [MACRO.rendaFixa]: "patrimonio.macroRendaFixa",
  [MACRO.rendaVariavel]: "patrimonio.macroRendaVariavel",
  [MACRO.caixa]: "patrimonio.macroCaixa",
  [MACRO.bens]: "patrimonio.macroBens",
};

export default function Patrimonio() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const data = usePatrimonio();
  const tax = useTaxonomy();
  const rates = useRates((s) => s.rates);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const totalAssets = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const invested = data.assets
      .filter((a) => isInvestedClass(a.classId))
      .reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const byClass = new Map<string, Asset[]>();
    for (const a of data.assets) {
      const arr = byClass.get(a.classId);
      if (arr) arr.push(a);
      else byClass.set(a.classId, [a]);
    }
    const groups = tax.assetClasses
      .filter((c) => byClass.has(c.id))
      .map((c) => {
        const assets = byClass.get(c.id)!;
        return {
          classId: c.id,
          name: c.name,
          count: assets.length,
          total: assets.reduce((s, a) => s + conv(a.amount, a.currency), 0),
        };
      });
    return { totalAssets, totalLiab, netWorth: totalAssets - totalLiab, invested, groups };
  }, [data, disp, rates, tax]);

  const [tab, setTab] = useState(""); // macro ativa (id)
  const [liabOpen, setLiabOpen] = useState(false); // Passivos colapsados por padrão (encurta a aba)
  const openDrawer = useBalanceUpdater((s) => s.openDrawer);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const opts = (items: { id: string; name: string }[]): SelectOption[] =>
    items.map((i) => ({ value: i.id, label: i.name }));
  // Opções de PAÍS com bandeira (a moeda não basta: o € é de vários países).
  const regionOptions: SelectOption[] = tax.regions.map((r) => ({ value: r.id, label: `${REGION_FLAG[r.id] ?? ""} ${r.name}`.trim() }));
  const sym = CURRENCY_SYMBOL[disp];
  const convertedCol = {
    key: "conv",
    type: "computed" as const,
    header: `${t("patrimonio.in")} ${sym}`,
    width: "minmax(80px,0.8fr)",
    align: "right" as const,
  };

  // Abas = MACROS (Renda Fixa · Renda Variável · Caixa · Bens). A linha é (subtype, moeda) DENTRO
  // da macro; o "Tipo" (subtype) define a classe, então composição/alocação/FIRE seguem por classe.
  const activeMacro = ASSET_MACROS.find((m) => m.id === tab) ?? ASSET_MACROS[0];
  const activeAssets = data.assets.filter((a) => macroOf(a.classId) === activeMacro.id);
  const macroTotal = activeAssets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
  const macroCount = (m: AssetMacro) => data.assets.filter((a) => macroOf(a.classId) === m.id).length;

  // Colunas por MACRO: Tipo (sub-categoria) → Moeda → [Aplicado] → Valor atual → [Rent.] → [Em <moeda>].
  const assetColsFor = (macro: AssetMacro): GridColumn<Asset>[] => {
    const invested = macro.classIds.some(isInvestedClass);
    // "Tipo" AGRUPADO por classe (seção = nome da classe; opção = sub-tipo curado, sem prefixo).
    const tipoGroups = macro.classIds
      .map((cid) => ({
        label: tax.assetClasses.find((c) => c.id === cid)?.name ?? "",
        options: tipoSubtypesFor(tax.subtypes, cid).map((s) => ({ value: s.id, label: s.name })),
      }))
      .filter((g) => g.options.length > 0);
    const cols: GridColumn<Asset>[] = [
      { key: "subtypeId", type: "select", header: t("patrimonio.type"), width: "minmax(150px,1.5fr)", placeholder: t("patrimonio.typePlaceholder"), optionGroups: tipoGroups },
      { key: "regionId", type: "select", optional: true, header: t("patrimonio.country"), width: "minmax(112px,1fr)", options: regionOptions, derive: (id) => (REGION_CURRENCY[id] ? { currency: REGION_CURRENCY[id] } : {}) },
      { key: "currency", type: "currency", header: t("common.currency"), width: "minmax(56px,0.45fr)" },
    ];
    if (invested) {
      cols.push({ key: "cost", type: "number", decimals: 2, header: t("patrimonio.applied"), width: "minmax(110px,0.9fr)", align: "right", currencyKey: "currency" });
    }
    cols.push({ key: "amount", type: "money", hideCurrency: true, header: invested ? t("patrimonio.currentValue") : t("patrimonio.amount"), width: "minmax(130px,1fr)", align: "right", currencyKey: "currency" });
    if (invested) {
      cols.push({
        key: "ret",
        type: "computed",
        header: t("patrimonio.return"),
        width: "minmax(80px,0.6fr)",
        align: "right",
        compute: (r: Asset) => {
          const cost = r.cost ?? 0;
          if (cost <= 0) return "—";
          const ret = ((r.amount - cost) / cost) * 100;
          return (
            <span className={ret >= 0 ? "text-accent" : "text-neg"}>
              <Hidden>{(ret >= 0 ? "+" : "") + ret.toFixed(1) + "%"}</Hidden>
            </span>
          );
        },
      });
    }
    // "Em <moeda>" só quando há conversão (algum ativo da macro em moeda ≠ da exibida).
    if (data.assets.some((a) => macroOf(a.classId) === macro.id && a.currency !== disp)) {
      cols.push({ ...convertedCol, compute: (r: Asset) => formatMoney(conv(r.amount, r.currency), disp) });
    }
    return cols;
  };

  // O "Tipo" (subtype) escolhido define a CLASSE-pai (lookup na taxonomia) — os cálculos seguem por classe.
  const commitAsset = (a: Asset) => {
    const st = tax.subtypes.find((s) => s.id === a.subtypeId);
    void actions.putAsset(st ? { ...a, classId: st.classId } : a);
  };
  // Moeda vazia na linha em branco (mostra "—", não pré-seleciona) — o País preenche, ou cai na base ao salvar.
  const newAsset = (): Asset => ({ id: crypto.randomUUID(), name: "", classId: activeMacro.classIds[0], currency: "" as Currency, amount: 0 });

  const liabCols: GridColumn<Liability>[] = [
    { key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.7fr)", placeholder: t("patrimonio.namePlaceholderLiab") },
    { key: "typeId", type: "select", header: t("patrimonio.type"), width: "minmax(160px,1.3fr)", placeholder: t("patrimonio.typePlaceholder"), options: opts(tax.liabilityTypes) },
    { key: "interestRate", type: "number", decimals: 2, header: t("patrimonio.interestRate"), width: "minmax(96px,0.8fr)", align: "right" },
    { key: "installments", type: "number", decimals: 0, header: t("patrimonio.installments"), width: "minmax(92px,0.7fr)", align: "right" },
    { key: "amount", type: "money", header: t("patrimonio.saldo"), width: "minmax(150px,1fr)", align: "right", currencyKey: "currency" },
  ];
  if (data.liabilities.some((l) => l.currency !== disp)) {
    liabCols.push({ ...convertedCol, compute: (r: Liability) => formatMoney(conv(r.amount, r.currency), disp) });
  }
  const newLiab = (): Liability => ({ id: crypto.randomUUID(), name: "", typeId: "", currency: base, amount: 0 });

  const sharePct = view.totalAssets > 0 ? (macroTotal / view.totalAssets) * 100 : 0;

  // Rentabilidade PONDERADA da macro ativa = (Σ valor atual − Σ valor aplicado) / Σ valor aplicado,
  // só sobre os ativos COM valor aplicado (custo). Proporcional ao valor, não média simples dos %.
  // Some um KPI só quando faz sentido (há custo) — exclui Caixa/Bens naturalmente.
  const classReturn = (() => {
    let cost = 0;
    let value = 0;
    for (const a of activeAssets) {
      const c = a.cost ?? 0;
      if (c <= 0) continue;
      cost += conv(c, a.currency);
      value += conv(a.amount, a.currency);
    }
    return cost > 0 ? { has: true, applied: cost, pct: ((value - cost) / cost) * 100 } : { has: false, applied: 0, pct: 0 };
  })();

  // Alocação por classe (todas de uma vez) — diversificação à primeira vista, sem entrar em cada aba.
  const ramp = categoryColors(theme === "dark" ? "dark" : "light");
  const alloc = [...view.groups]
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((g) => ({ ...g, pct: (g.total / view.totalAssets) * 100 }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <CardSubNav
        items={SUBNAV.map((s) => ({ id: s.id, label: t(s.key) }))}
        onSelect={(id) => {
          if (id === "pat-passivos") setLiabOpen(true); // abre o accordion de Passivos ao clicar na aba
        }}
      />
      {/* Alocação — diversificação por classe num relance (barra + KPIs clicáveis que levam à aba) */}
      {alloc.length >= 2 ? (
        <section id="pat-alocacao">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="eyebrow">{t("patrimonio.allocation")}</h3>
            <Money value={view.totalAssets} currency={disp} className="text-[12px] text-faint" />
          </div>
          <div className="flex h-[10px] rounded-full overflow-hidden bg-card2">
            {alloc.map((a, i) => (
              <div
                key={a.classId}
                className="h-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${a.pct}%`, background: ramp[i % ramp.length] }}
                title={`${a.name} · ${a.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          {/* Uma linha só: cartões de largura fixa que ROLAM na horizontal quando há muitas classes
              (em vez de quebrar em várias linhas). */}
          <div className="flex gap-2.5 mt-4 overflow-x-auto no-scrollbar">
            {alloc.map((a, i) => (
              <button
                key={a.classId}
                type="button"
                onClick={() => setTab(macroOf(a.classId))}
                aria-label={`${a.name} ${a.pct.toFixed(1)}%`}
                className={cn(
                  "flex items-start gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors flex-1 min-w-[190px]",
                  macroOf(a.classId) === activeMacro.id ? "border-border-strong bg-card2" : "border-border hover:bg-card-hover",
                )}
              >
                <span className="w-2.5 h-2.5 rounded-[3px] shrink-0 mt-1" style={{ background: ramp[i % ramp.length] }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-muted truncate">{a.name}</span>
                  <span className="block text-[17px] font-semibold tracking-[-0.02em] tabular leading-tight mt-0.5">
                    <Hidden>{a.pct.toFixed(1) + "%"}</Hidden>
                  </span>
                  <Money value={a.total} currency={disp} className="block text-[11.5px] text-faint mt-0.5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Ativos por classe (abas) */}
      <section id="pat-ativos">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="eyebrow">{t("patrimonio.assets")}</h3>
          <div className="flex items-center gap-3">
            <span className="text-[11.5px] text-faint tabular">{t("dashboard.positionsCount", { count: data.assets.length })}</span>
            <button type="button" onClick={openDrawer} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12px] font-medium text-[#08130C] transition hover:opacity-90">
              <Wallet size={14} /> {t("balances.cta")}
            </button>
          </div>
        </div>

        {/* Barra de abas = MACRO-categorias (sempre as 4) */}
        <div className="flex items-center gap-1.5 border-b border-border mb-5 overflow-x-auto no-scrollbar">
          {ASSET_MACROS.map((m) => {
            const on = m.id === activeMacro.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setTab(m.id)}
                className={cn(
                  "relative px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap shrink-0 transition-colors",
                  on ? "text-text" : "text-muted hover:text-text",
                )}
              >
                {t(MACRO_LABEL[m.id])} <span className="text-faint tabular text-[12px]">{macroCount(m)}</span>
                {on ? <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent" /> : null}
              </button>
            );
          })}
        </div>

        {/* KPIs da macro ativa */}
        <div className={cn("grid grid-cols-2 gap-3 mb-5", classReturn.has ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-3")}>
          {classReturn.has ? (
            <Kpi label={t("patrimonio.applied")} value={<Money value={classReturn.applied} currency={disp} />} />
          ) : null}
          <Kpi label={classReturn.has ? t("patrimonio.currentValue") : t("patrimonio.classTotal")} value={<Money value={macroTotal} currency={disp} />} />
          {classReturn.has ? (
            <Kpi
              label={t("investimentos.profitability")}
              tone={classReturn.pct >= 0 ? "accent" : "neg"}
              value={<Hidden>{`${classReturn.pct >= 0 ? "+" : ""}${classReturn.pct.toFixed(1)}%`}</Hidden>}
            />
          ) : null}
          <Kpi label={t("patrimonio.share")} value={`${sharePct.toFixed(1)}%`} tone="accent" ring={sharePct} />
          <Kpi label={t("patrimonio.assetCount")} value={<span className="tabular">{activeAssets.length}</span>} />
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-0 sm:min-w-[720px]">
            <DataGrid<Asset>
              key={activeMacro.id}
              columns={assetColsFor(activeMacro)}
              rows={activeAssets}
              blank={newAsset}
              defaultCurrency={base}
              isComplete={(r) => !!r.subtypeId && r.amount > 0}
              onCommit={commitAsset}
              onDelete={(id) => void actions.removeAsset(id)}
              addPlaceholder={t("patrimonio.addAsset")}
              total={<Money value={macroTotal} currency={disp} />}
            />
          </div>
        </div>
      </section>

      {/* Investimentos — rebalanceamento, rentabilidade e proventos (fundido nesta aba) */}
      <div id="pat-investimentos" className="border-t border-border pt-6">
        <Investimentos />
      </div>

      {/* Passivos — ÚLTIMO item da aba; colapsável: KPIs no cabeçalho; detalhe + cronograma só ao abrir */}
      <section id="pat-passivos" className="border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setLiabOpen((o) => !o)}
          aria-expanded={liabOpen}
          className="w-full flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[10px] py-1"
        >
          <span className="flex items-center gap-2.5">
            <ChevronDown size={18} className={cn("text-muted transition-transform", liabOpen && "rotate-180")} />
            <span className="eyebrow">{t("patrimonio.liabilities")}</span>
          </span>
          <span className="flex items-center gap-5 sm:gap-7 text-[13px]">
            <span className="inline-flex items-center gap-2">
              <span className="eyebrow">{t("patrimonio.totalDebt")}</span>
              <Money value={view.totalLiab} currency={disp} className="font-semibold text-neg tabular" options={{ signDisplay: "never" }} />
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="eyebrow">{t("patrimonio.liabilities")}</span>
              <span className="font-semibold tabular">{data.liabilities.length}</span>
            </span>
          </span>
        </button>
        {liabOpen ? (
          <div className="mt-4 space-y-7">
            <div className="overflow-x-auto">
              <div className="min-w-0 sm:min-w-[760px]">
                <DataGrid<Liability>
                  columns={liabCols}
                  rows={data.liabilities}
                  blank={newLiab}
                  isComplete={(r) => r.name.trim().length > 0 && r.typeId.length > 0 && r.amount > 0}
                  onCommit={(r) => void actions.putLiability(r)}
                  onDelete={(id) => void actions.removeLiability(id)}
                  addPlaceholder={t("patrimonio.addLiability")}
                  total={<Money value={view.totalLiab} currency={disp} className="text-neg" options={{ signDisplay: "never" }} />}
                />
              </div>
            </div>
            <DebtScheduleTile />
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Cronograma de dívidas: parcela, juros e quitação por dívida + saldo agregado caindo a zero. */
function DebtScheduleTile() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const tax = useTaxonomy();
  const data = usePatrimonio();
  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const debts: { id: string; name: string; monthly: number; months: number; interest: number; balances: number[] }[] = [];
    let withoutPlan = 0;
    let maxMonths = 0;
    for (const l of data.liabilities) {
      const plan = debtPlan(l.amount, l.interestRate ?? 0, l.installments ?? 0);
      if (!plan) {
        if (l.amount > 0) withoutPlan++;
        continue;
      }
      const native = amortizationBalances(l.amount, l.interestRate ?? 0, l.installments ?? 0);
      debts.push({
        id: l.id,
        name: l.name || nameById(tax.liabilityTypes, l.typeId) || t("patrimonio.liabilities"),
        monthly: conv(plan.monthly, l.currency),
        months: plan.months,
        interest: conv(plan.totalInterest, l.currency),
        balances: native.map((b) => conv(b, l.currency)),
      });
      maxMonths = Math.max(maxMonths, plan.months);
    }
    if (debts.length === 0) return { empty: true as const };
    const totalMonthly = debts.reduce((s, d) => s + d.monthly, 0);
    const totalInterest = debts.reduce((s, d) => s + d.interest, 0);
    const series: { month: number; balance: number }[] = [];
    for (let k = 0; k <= maxMonths; k++) {
      let bal = 0;
      for (const d of debts) bal += k < d.balances.length ? d.balances[k] : 0;
      series.push({ month: k, balance: bal });
    }
    return { empty: false as const, debts, totalMonthly, totalInterest, maxMonths, withoutPlan, series };
  }, [data, disp, rates, tax, t]);

  if (!view || view.empty) return null;
  const neg = "#f1746a";

  return (
    <Tile className="p-4 sm:p-6 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown size={16} className="text-muted shrink-0" />
          <Eyebrow>{t("debt.title")}</Eyebrow>
        </div>
        <span className="text-[12px] text-muted">
          {t("debt.debtFree")} <span className="text-accent font-semibold">{monthsAheadLabel(view.maxMonths, lang)}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi label={t("debt.monthly")} value={<Money value={view.totalMonthly} currency={disp} options={{ signDisplay: "never" }} />} tone="neg" />
        <Kpi label={t("debt.totalInterest")} value={<Money value={view.totalInterest} currency={disp} options={{ signDisplay: "never" }} />} />
        <Kpi label={t("debt.payoffIn")} value={<span className="tabular">{t("debt.months", { n: view.maxMonths })}</span>} />
      </div>

      {/* Saldo devedor agregado caindo a zero */}
      <div className="w-full h-[150px] mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={view.series} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <defs>
              <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={neg} stopOpacity={0.22} />
                <stop offset="100%" stopColor={neg} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={false} axisLine={false} tickLine={false} height={0} />
            <Tooltip
              formatter={(v) => [formatMoney(Number(v), disp), t("debt.balance")]}
              labelFormatter={(m) => monthsAheadLabel(Number(m), lang)}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
              labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
            />
            <Area type="monotone" dataKey="balance" stroke={neg} strokeWidth={2} fill="url(#debtGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Lista por dívida */}
      <ul className="mt-5 divide-y divide-[var(--grid-line)]">
        {view.debts.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[13.5px] text-text truncate">{d.name}</div>
              <div className="text-[11.5px] text-faint tabular">
                {t("debt.installmentsLeft", { n: d.months })} · {t("debt.until")} {monthsAheadLabel(d.months, lang)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <Money value={d.monthly} currency={disp} className="text-[13.5px] font-medium tabular" options={{ signDisplay: "never" }} />
              <div className="text-[11px] text-faint">
                {t("debt.interestShort")} <Money value={d.interest} currency={disp} options={{ signDisplay: "never" }} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {view.withoutPlan > 0 ? <p className="text-[11.5px] text-faint mt-3">{t("debt.withoutPlan", { n: view.withoutPlan })}</p> : null}
      <p className="text-[11px] text-faint mt-2 leading-relaxed max-w-2xl">{t("debt.hint")}</p>
    </Tile>
  );
}

/** KPIs do cabeçalho do accordion de Patrimônio. */
export function PatrimonioSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const totalAssets = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    // Rentabilidade geral dos investidos (mesmo custo unificado de Investimentos).
    let totalCost = 0;
    let totalCostValue = 0;
    for (const a of data.assets.filter((x) => isInvestedClass(x.classId))) {
      const cost = a.cost ?? 0;
      if (cost > 0) {
        totalCost += conv(cost, a.currency);
        totalCostValue += conv(a.amount, a.currency);
      }
    }
    return {
      totalAssets,
      totalLiab,
      net: totalAssets - totalLiab,
      returnPct: totalCost > 0 ? ((totalCostValue - totalCost) / totalCost) * 100 : null,
    };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("patrimonio.netWorth")} value={<Money value={v.net} currency={disp} />} />
      {v.returnPct != null ? (
        <HeaderKpi
          secondary
          label={t("investimentos.profitability")}
          tone={v.returnPct >= 0 ? "accent" : "neg"}
          value={`${v.returnPct >= 0 ? "+" : ""}${v.returnPct.toFixed(1)}%`}
        />
      ) : null}
      <HeaderKpi secondary label={t("patrimonio.assets")} value={<Money value={v.totalAssets} currency={disp} />} />
      <HeaderKpi secondary label={t("patrimonio.liabilities")} tone={v.totalLiab > 0 ? "neg" : "text"} value={<Money value={v.totalLiab} currency={disp} options={{ signDisplay: "never" }} />} />
    </HeaderKpis>
  );
}
