import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useQuotes } from "@/store/quotes";
import { useIsAdmin } from "@/admin/use-admin";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { categoryColors } from "@/money/composition";
import { CLASS, isInvestedClass, isQuotableClass, nameById } from "@/domain/taxonomy";
import { debtPlan, amortizationBalances } from "@/finance/debt";
import type { Asset, Liability } from "@/domain/types";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { Kpi } from "@/components/common/kpi";
import { Tile, Eyebrow } from "@/components/common/tile";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
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

export default function Patrimonio() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const data = usePatrimonio();
  const tax = useTaxonomy();
  const rates = useRates((s) => s.rates);
  const prices = useQuotes((s) => s.prices);
  // Cotação automática (brapi) é exclusiva do super-admin — uso pessoal do tier free.
  const { isAdmin } = useIsAdmin();

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

  const [tab, setTab] = useState("");
  const [extra, setExtra] = useState<string | null>(null);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const opts = (items: { id: string; name: string }[]): SelectOption[] =>
    items.map((i) => ({ value: i.id, label: i.name }));
  const sym = CURRENCY_SYMBOL[disp];
  const convertedCol = {
    key: "conv",
    type: "computed" as const,
    header: `${t("patrimonio.in")} ${sym}`,
    width: "minmax(80px,0.8fr)",
    align: "right" as const,
  };

  const presentIds = view.groups.map((g) => g.classId);
  const tabIds = extra && !presentIds.includes(extra) ? [...presentIds, extra] : presentIds;
  const activeId = tabIds.includes(tab) ? tab : (tabIds[0] ?? "");
  const activeGroup = view.groups.find((g) => g.classId === activeId);
  const activeAssets = data.assets.filter((a) => a.classId === activeId);
  const absentClasses = tax.assetClasses.filter((c) => !presentIds.includes(c.id));

  const priceOf = (ticker?: string) => prices[(ticker ?? "").toUpperCase()];

  // Colunas sob medida por classe (sem a coluna "Classe" — é o contexto da aba).
  const assetColsFor = (classId: string): GridColumn<Asset>[] => {
    const quotable = isQuotableClass(classId);
    const cols: GridColumn<Asset>[] = [];
    // Cotáveis não têm campo de valor (vem de qtd × cotação) → mantêm o seletor de moeda como selo.
    if (quotable) {
      cols.push({ key: "currency", type: "currency", header: "", width: "46px" });
    }
    cols.push({ key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.6fr)", placeholder: t("patrimonio.namePlaceholder") });
    cols.push({ key: "subtypeId", type: "select", optional: true, header: t("patrimonio.subtype"), width: "minmax(140px,1.1fr)", optionsFor: (r) => opts(tax.subtypes.filter((s) => s.classId === r.classId)) });
    if (classId === CLASS.rendaFixa) {
      cols.push({ key: "indexerId", type: "select", optional: true, header: t("patrimonio.indexer"), width: "minmax(104px,0.9fr)", options: opts(tax.indexers) });
    }
    if (quotable) {
      // Visão de posição: Ticker · Qtd · Preço médio · [Cotação · Rentabilidade ao vivo] · Valor atual.
      // As colunas AO VIVO só aparecem pro super-admin (cotação automática = uso pessoal do free
      // brapi). Não-admin fica manual: valor = quantidade × preço médio.
      cols.push({ key: "ticker", type: "text", header: t("patrimonio.ticker"), width: "minmax(88px,0.8fr)", placeholder: "—" });
      cols.push({ key: "quantity", type: "number", header: t("patrimonio.quantity"), width: "minmax(72px,0.6fr)", align: "right" });
      cols.push({ key: "avgPrice", type: "number", decimals: 2, header: t("patrimonio.avgPrice"), width: "minmax(96px,0.8fr)", align: "right" });
      if (isAdmin) cols.push({
        key: "price",
        type: "computed",
        header: t("patrimonio.price"),
        width: "minmax(92px,0.8fr)",
        align: "right",
        compute: (r: Asset) => {
          const q = priceOf(r.ticker);
          return q ? formatMoney(q.price, r.currency, { maximumFractionDigits: 2 }) : "—";
        },
      });
      if (isAdmin) cols.push({
        key: "ret",
        type: "computed",
        header: t("patrimonio.return"),
        width: "minmax(86px,0.7fr)",
        align: "right",
        compute: (r: Asset) => {
          const q = priceOf(r.ticker);
          const cost = (r.quantity ?? 0) * (r.avgPrice ?? 0);
          if (!q || cost <= 0) return "—";
          const ret = (((r.quantity ?? 0) * q.price - cost) / cost) * 100;
          return (
            <span className={ret >= 0 ? "text-accent" : "text-neg"}>
              <Hidden>{(ret >= 0 ? "+" : "") + ret.toFixed(1) + "%"}</Hidden>
            </span>
          );
        },
      });
      cols.push({ ...convertedCol, header: t("patrimonio.currentValue"), compute: (r: Asset) => formatMoney(conv(r.amount, r.currency), disp) });
      return cols;
    }
    cols.push({ key: "regionId", type: "select", optional: true, header: t("patrimonio.region"), width: "minmax(116px,1fr)", options: opts(tax.regions) });
    cols.push({ key: "institution", type: "text", header: t("patrimonio.institution"), width: "minmax(112px,1fr)", placeholder: "—" });
    // Classes INVESTIDAS sem ticker (renda fixa, outros): aplicado → atual → rentabilidade.
    const invested = isInvestedClass(classId);
    if (invested) {
      cols.push({ key: "cost", type: "number", decimals: 2, header: t("patrimonio.applied"), width: "minmax(120px,1fr)", align: "right", currencyKey: "currency" });
    }
    cols.push({ key: "amount", type: "money", header: invested ? t("patrimonio.currentValue") : t("patrimonio.amount"), width: "minmax(150px,1fr)", align: "right", currencyKey: "currency" });
    if (invested) {
      cols.push({
        key: "ret",
        type: "computed",
        header: t("patrimonio.return"),
        width: "minmax(86px,0.7fr)",
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
    // "Em <moeda>" só quando há conversão (algum ativo da classe em moeda ≠ da exibida).
    if (data.assets.some((a) => a.classId === classId && a.currency !== disp)) {
      cols.push({ ...convertedCol, compute: (r: Asset) => formatMoney(conv(r.amount, r.currency), disp) });
    }
    return cols;
  };

  const commitAsset = (a: Asset) => {
    const next = { ...a };
    if (next.subtypeId && !tax.subtypes.some((s) => s.id === next.subtypeId && s.classId === next.classId)) {
      next.subtypeId = undefined;
    }
    if (next.classId !== CLASS.rendaFixa) next.indexerId = undefined;
    // Cotáveis: valor = quantidade × (cotação do dia, se houver; senão preço médio = custo).
    // SEM exigir ticker — um cotável sem ticker ainda vale qtd × preço médio (custo),
    // senão ficaria com valor 0 (rentabilidade −100% e patrimônio subestimado).
    if (isQuotableClass(next.classId) && (next.quantity ?? 0) > 0) {
      const unit = priceOf(next.ticker)?.price ?? next.avgPrice ?? 0;
      if (unit > 0) next.amount = (next.quantity ?? 0) * unit;
    }
    void actions.putAsset(next);
    // Ticker novo/alterado → busca a cotação NA HORA (force ignora o TTL). Só pro super-admin;
    // não-admin mantém o valor manual (qtd × preço médio).
    if (isAdmin && next.ticker) {
      const assets = [...data.assets.filter((x) => x.id !== next.id), next];
      void useQuotes.getState().refresh(assets, true);
    }
  };
  const newAsset = (): Asset => ({ id: crypto.randomUUID(), name: "", classId: activeId, currency: base, amount: 0 });

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

  const sharePct = view.totalAssets > 0 ? ((activeGroup?.total ?? 0) / view.totalAssets) * 100 : 0;

  // Alocação por classe (todas de uma vez) — diversificação à primeira vista, sem entrar em cada aba.
  const ramp = categoryColors(theme === "dark" ? "dark" : "light");
  const alloc = [...view.groups]
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((g) => ({ ...g, pct: (g.total / view.totalAssets) * 100 }));

  return (
    <div className="space-y-8">
      {/* Alocação — diversificação por classe num relance (barra + KPIs clicáveis que levam à aba) */}
      {alloc.length >= 2 ? (
        <section>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-4">
            {alloc.map((a, i) => (
              <button
                key={a.classId}
                type="button"
                onClick={() => {
                  setTab(a.classId);
                  setExtra(null);
                }}
                aria-label={`${a.name} ${a.pct.toFixed(1)}%`}
                className={cn(
                  "flex items-start gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors",
                  a.classId === activeId ? "border-border-strong bg-card2" : "border-border hover:bg-card-hover",
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
      <section>
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="eyebrow">{t("patrimonio.assets")}</h3>
          <span className="text-[11.5px] text-faint tabular">{t("dashboard.positionsCount", { count: data.assets.length })}</span>
        </div>

        {/* Barra de abas + "adicionar classe" */}
        <div className="flex items-center gap-1.5 border-b border-border mb-5 overflow-x-auto no-scrollbar">
          {tabIds.map((id) => {
            const g = view.groups.find((x) => x.classId === id);
            const name = g?.name ?? tax.assetClasses.find((c) => c.id === id)?.name ?? id;
            const on = id === activeId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setTab(id); setExtra(null); }}
                className={cn(
                  "relative px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap shrink-0 transition-colors",
                  on ? "text-text" : "text-muted hover:text-text",
                )}
              >
                {name} <span className="text-faint tabular text-[12px]">{g?.count ?? 0}</span>
                {on ? <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent" /> : null}
              </button>
            );
          })}
          {absentClasses.length > 0 ? <AddClassMenu classes={absentClasses} onPick={(id) => { setExtra(id); setTab(id); }} /> : null}
        </div>

        {activeId ? (
          <>
            {/* KPIs da classe ativa */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <Kpi label={t("patrimonio.classTotal")} value={<Money value={activeGroup?.total ?? 0} currency={disp} />} />
              <Kpi label={t("patrimonio.share")} value={`${sharePct.toFixed(1)}%`} tone="accent" bar={sharePct} />
              <Kpi label={t("patrimonio.assetCount")} value={<span className="tabular">{activeGroup?.count ?? 0}</span>} />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <DataGrid<Asset>
                  key={activeId}
                  columns={assetColsFor(activeId)}
                  rows={activeAssets}
                  blank={newAsset}
                  isComplete={(r) =>
                    r.name.trim().length > 0 &&
                    r.classId.length > 0 &&
                    (isQuotableClass(r.classId) ? (r.quantity ?? 0) > 0 && (r.avgPrice ?? 0) > 0 : r.amount > 0)
                  }
                  onCommit={commitAsset}
                  onDelete={(id) => void actions.removeAsset(id)}
                  addPlaceholder={t("patrimonio.addAsset")}
                  total={<Money value={activeGroup?.total ?? 0} currency={disp} />}
                />
              </div>
            </div>
            {isQuotableClass(activeId) && isAdmin ? (
              <p className="text-[11.5px] text-faint mt-2 px-1 leading-relaxed">{t("patrimonio.tickerHint")}</p>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-faint py-6">{t("patrimonio.emptyAssets")}</p>
        )}
      </section>

      {/* Passivos */}
      <section>
        <SectionHead title={t("patrimonio.liabilities")} count={data.liabilities.length} />
        {data.liabilities.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <Kpi label={t("patrimonio.totalDebt")} value={<Money value={view.totalLiab} currency={disp} options={{ signDisplay: "never" }} />} tone="neg" />
            <Kpi label={t("patrimonio.liabilities")} value={<span className="tabular">{data.liabilities.length}</span>} />
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
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
      </section>

      {/* Cronograma de dívidas */}
      <DebtScheduleTile />

      {/* Investimentos — rebalanceamento, rentabilidade e proventos (fundido nesta aba) */}
      <div className="border-t border-border pt-6">
        <Investimentos />
      </div>
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
    <Tile className="p-6 md:p-7">
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
      const cost = isQuotableClass(a.classId) ? (a.quantity ?? 0) * (a.avgPrice ?? 0) : (a.cost ?? 0);
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

/**
 * Menu "+" pra começar uma classe ainda sem ativos. O dropdown vai por PORTAL no body
 * (posição calculada do botão) pra não ser recortado pelo overflow das abas/accordion.
 */
function AddClassMenu({ classes, onPick }: { classes: { id: string; name: string }[]; onPick: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
    setOpen(true);
  };

  return (
    <div className="shrink-0 ml-1">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 px-2.5 py-2 text-[13px] text-muted hover:text-text transition-colors whitespace-nowrap"
      >
        <Plus size={14} />
        {t("patrimonio.addClass")}
        <ChevronDown size={13} className="text-faint" />
      </button>
      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
              <div
                className="fixed z-[56] w-56 max-h-[320px] overflow-y-auto rounded-[12px] border border-border bg-card shadow-[var(--shadow-float)] p-1.5"
                style={{ top: pos.top, left: pos.left }}
              >
                {classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onPick(c.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-[8px] text-[13.5px] text-muted hover:text-text hover:bg-card-hover transition-colors"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
