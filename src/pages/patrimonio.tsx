import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useQuotes } from "@/store/quotes";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { CLASS, isInvestedClass } from "@/domain/taxonomy";
import type { Asset, Liability } from "@/domain/types";
import { Money } from "@/components/common/money";
import { Kpi } from "@/components/common/kpi";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn, type SelectOption } from "@/components/grid/data-grid";
import { cn } from "@/lib/utils";

/** Classes cujos ativos têm ticker/cotação (mostram colunas Ticker + Qtd). */
const QUOTABLE = new Set<string>([
  CLASS.acoes,
  CLASS.fiis,
  CLASS.cripto,
  CLASS.commodities,
  CLASS.multimercado,
  CLASS.previdencia,
  CLASS.privateEquity,
]);

export default function Patrimonio() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const data = usePatrimonio();
  const tax = useTaxonomy();
  const rates = useRates((s) => s.rates);
  const prices = useQuotes((s) => s.prices);

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
    const cols: GridColumn<Asset>[] = [
      { key: "currency", type: "currency", header: "", width: "46px" },
      { key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.6fr)", placeholder: t("patrimonio.namePlaceholder") },
      { key: "subtypeId", type: "select", optional: true, header: t("patrimonio.subtype"), width: "minmax(140px,1.1fr)", optionsFor: (r) => opts(tax.subtypes.filter((s) => s.classId === r.classId)) },
    ];
    if (classId === CLASS.rendaFixa) {
      cols.push({ key: "indexerId", type: "select", optional: true, header: t("patrimonio.indexer"), width: "minmax(104px,0.9fr)", options: opts(tax.indexers) });
    }
    if (QUOTABLE.has(classId)) {
      // Visão de posição: Ticker · Qtd · Preço médio · Cotação · Rentabilidade · Valor atual.
      cols.push({ key: "ticker", type: "text", header: t("patrimonio.ticker"), width: "minmax(88px,0.8fr)", placeholder: "—" });
      cols.push({ key: "quantity", type: "number", header: t("patrimonio.quantity"), width: "minmax(72px,0.6fr)", align: "right" });
      cols.push({ key: "avgPrice", type: "number", header: t("patrimonio.avgPrice"), width: "minmax(96px,0.8fr)", align: "right" });
      cols.push({
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
      cols.push({
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
              {(ret >= 0 ? "+" : "") + ret.toFixed(1)}%
            </span>
          );
        },
      });
      cols.push({ key: "regionId", type: "select", optional: true, header: t("patrimonio.region"), width: "minmax(110px,0.9fr)", options: opts(tax.regions) });
      cols.push({ key: "institution", type: "text", header: t("patrimonio.institution"), width: "minmax(108px,0.9fr)", placeholder: "—" });
      cols.push({ ...convertedCol, header: t("patrimonio.currentValue"), compute: (r: Asset) => formatMoney(conv(r.amount, r.currency), disp) });
      return cols;
    }
    cols.push({ key: "regionId", type: "select", optional: true, header: t("patrimonio.region"), width: "minmax(116px,1fr)", options: opts(tax.regions) });
    cols.push({ key: "institution", type: "text", header: t("patrimonio.institution"), width: "minmax(112px,1fr)", placeholder: "—" });
    cols.push({ key: "amount", type: "money", header: t("patrimonio.amount"), width: "minmax(104px,0.9fr)", align: "right", currencyKey: "currency" });
    cols.push({ ...convertedCol, compute: (r: Asset) => formatMoney(conv(r.amount, r.currency), disp) });
    return cols;
  };

  const commitAsset = (a: Asset) => {
    const next = { ...a };
    if (next.subtypeId && !tax.subtypes.some((s) => s.id === next.subtypeId && s.classId === next.classId)) {
      next.subtypeId = undefined;
    }
    if (next.classId !== CLASS.rendaFixa) next.indexerId = undefined;
    // Cotáveis: valor = quantidade × (cotação do dia, se houver; senão preço médio = custo).
    if (QUOTABLE.has(next.classId) && next.ticker && (next.quantity ?? 0) > 0) {
      const unit = priceOf(next.ticker)?.price ?? next.avgPrice ?? 0;
      if (unit > 0) next.amount = (next.quantity ?? 0) * unit;
    }
    void actions.putAsset(next);
  };
  const newAsset = (): Asset => ({ id: crypto.randomUUID(), name: "", classId: activeId, currency: disp, amount: 0 });

  const liabCols: GridColumn<Liability>[] = [
    { key: "currency", type: "currency", header: "", width: "46px" },
    { key: "name", type: "text", header: t("patrimonio.name"), width: "minmax(150px,1.7fr)", placeholder: t("patrimonio.namePlaceholderLiab") },
    { key: "typeId", type: "select", header: t("patrimonio.type"), width: "minmax(160px,1.3fr)", placeholder: t("patrimonio.typePlaceholder"), options: opts(tax.liabilityTypes) },
    { key: "interestRate", type: "number", header: t("patrimonio.interestRate"), width: "minmax(96px,0.8fr)", align: "right" },
    { key: "installments", type: "number", header: t("patrimonio.installments"), width: "minmax(92px,0.7fr)", align: "right" },
    { key: "amount", type: "money", header: t("patrimonio.saldo"), width: "minmax(110px,1fr)", align: "right", currencyKey: "currency" },
    { ...convertedCol, compute: (r: Liability) => formatMoney(conv(r.amount, r.currency), disp) },
  ];
  const newLiab = (): Liability => ({ id: crypto.randomUUID(), name: "", typeId: "", currency: disp, amount: 0 });

  const sharePct = view.totalAssets > 0 ? ((activeGroup?.total ?? 0) / view.totalAssets) * 100 : 0;

  return (
    <div className="space-y-8">
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
              <div className={cn(QUOTABLE.has(activeId) ? "min-w-[1180px]" : "min-w-[880px]")}>
                <DataGrid<Asset>
                  key={activeId}
                  columns={assetColsFor(activeId)}
                  rows={activeAssets}
                  blank={newAsset}
                  isComplete={(r) =>
                    r.name.trim().length > 0 &&
                    r.classId.length > 0 &&
                    (QUOTABLE.has(r.classId) ? (r.quantity ?? 0) > 0 && (r.avgPrice ?? 0) > 0 : r.amount > 0)
                  }
                  onCommit={commitAsset}
                  onDelete={(id) => void actions.removeAsset(id)}
                  addPlaceholder={t("patrimonio.addAsset")}
                  total={<Money value={activeGroup?.total ?? 0} currency={disp} />}
                />
              </div>
            </div>
            {QUOTABLE.has(activeId) ? (
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
    </div>
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
    return { totalAssets, totalLiab, net: totalAssets - totalLiab };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("patrimonio.netWorth")} value={<Money value={v.net} currency={disp} />} />
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
