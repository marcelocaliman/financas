import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useBudget } from "@/hooks/use-budget";
import { convert, CURRENCIES, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { currencyCostIndex } from "@/data/cost-of-living";
import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { Card, CardHead, PageTitle, SectionGroup, CardGrid, StatCard, Label } from "../ui";

/** Exposição cambial do patrimônio: líquido por moeda, convertido pra principal. (mesma lógica da V1) */
function useFxExposure() {
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  return useMemo(() => {
    if (!data) return { rows: [] as { currency: Currency; principal: number }[], total: 0, foreign: 0, magnitude: 0 };
    const net = new Map<Currency, number>();
    for (const a of data.assets) net.set(a.currency, (net.get(a.currency) ?? 0) + a.amount);
    for (const l of data.liabilities) net.set(l.currency, (net.get(l.currency) ?? 0) - l.amount);
    const rows = [...net.entries()]
      .map(([currency, native]) => ({ currency, principal: convert(native, currency, base, rates) }))
      .filter((x) => Math.abs(x.principal) > 0.5)
      .sort((a, b) => Math.abs(b.principal) - Math.abs(a.principal));
    const total = rows.reduce((s, x) => s + x.principal, 0);
    const foreign = rows.filter((x) => x.currency !== base).reduce((s, x) => s + x.principal, 0);
    const magnitude = rows.reduce((s, x) => s + Math.abs(x.principal), 0);
    return { rows, total, foreign, magnitude };
  }, [data, base, rates]);
}

const FISCAL = ["crs", "brExit", "irpf", "quadroRw", "dichiarazione", "forfettario"];

export default function CrossBorderV2() {
  const { t } = useTranslation();
  return (
    <div>
      <PageTitle title={t("nav.crossborder")} subtitle={t("crossborder.fxHint")} />
      <SectionGroup title={t("crossborder.fxTitle")}>
        <FxImpact />
      </SectionGroup>
      <SectionGroup title={t("crossborder.colTitle")} desc={t("crossborder.colHint")}>
        <CostOfLiving />
      </SectionGroup>
      <SectionGroup title={t("crossborder.fiscalTitle")} desc={t("crossborder.fiscalHint")}>
        <FiscalReminders />
      </SectionGroup>
    </div>
  );
}

/* ── 1. Exposição cambial ──────────────────────────────────────────────── */

function FxImpact() {
  const { t } = useTranslation();
  const base = useUI((s) => s.baseCurrency);
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const fx = useFxExposure();
  const [pct, setPct] = useState(10);
  const toDisp = (v: number) => convert(v, base, disp, rates);

  if (fx.rows.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-[13px] text-faint">{t("crossborder.fxEmpty")}</p>
      </Card>
    );
  }

  const foreignDisp = toDisp(fx.foreign);
  const swing = Math.abs(foreignDisp) * (pct / 100); // impacto de ±pct% nas moedas estrangeiras
  const totalDisp = toDisp(fx.total);
  const foreignPct = fx.magnitude > 0 ? (Math.abs(fx.foreign) / fx.magnitude) * 100 : 0;

  return (
    <CardGrid>
      {/* Exposição por moeda */}
      <Card className="p-6 xl:col-span-2">
        <CardHead>{t("crossborder.fxTitle")}</CardHead>
        <div className="space-y-3.5">
          {fx.rows.map((r) => {
            const share = fx.magnitude > 0 ? (Math.abs(r.principal) / fx.magnitude) * 100 : 0;
            const foreign = r.currency !== base;
            const negative = r.principal < 0; // líquido devedor nessa moeda
            return (
              <div key={r.currency}>
                <div className="flex items-center justify-between gap-3 mb-1.5 text-[13px]">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn("chip", `chip-${r.currency}`)}>{CURRENCY_SYMBOL[r.currency]}</span>
                    <span className="truncate">{r.currency}</span>
                    {!foreign ? <Label>{t("crossborder.principal")}</Label> : null}
                  </span>
                  <span className="flex items-center gap-2 tabular shrink-0">
                    <Money value={toDisp(r.principal)} currency={disp} className={cn("font-medium", negative && "text-neg")} />
                    <span className={cn("w-12 text-right", foreign ? "text-muted" : "text-faint")}>{Math.round(share)}%</span>
                  </span>
                </div>
                <div className="h-[7px] rounded-full bg-card2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${share}%`, background: negative ? "var(--neg)" : foreign ? "#8a8f98" : "var(--accent)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Sensibilidade ao câmbio + KPIs */}
      <Card className="p-6">
        <CardHead
          right={<span className="tabular text-[14px] font-semibold w-12 text-right">±{pct}%</span>}
        >
          {t("crossborder.sensitivity")}
        </CardHead>
        <p className="text-[12px] text-muted -mt-2 mb-3 leading-relaxed">{t("crossborder.sensitivityHint", { pct })}</p>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-label={t("crossborder.move")}
          className="w-full accent-accent"
        />
        <div className="grid grid-cols-1 gap-1.5 mt-5">
          <Row label={t("crossborder.foreignExposure")} value={<Money value={foreignDisp} currency={disp} className="font-semibold" />} />
          <Row label={t("crossborder.foreignShare")} value={<span className="tabular font-semibold">{Math.round(foreignPct)}%</span>} />
          <Row
            label={t("crossborder.swing")}
            value={
              <span className="tabular font-semibold">
                <span className="text-muted">±</span>
                <Money value={swing} currency={disp} />
              </span>
            }
          />
          <div className="mt-2 pt-3 border-t border-border">
            <Label>{t("crossborder.range")}</Label>
            <div className="text-[14px] mt-1">
              <Money value={totalDisp - swing} currency={disp} className="text-neg font-medium" /> –{" "}
              <Money value={totalDisp + swing} currency={disp} className="text-accent font-medium" />
            </div>
          </div>
        </div>
      </Card>
    </CardGrid>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[14px]">{value}</span>
    </div>
  );
}

/* ── 2. Custo de vida ──────────────────────────────────────────────────── */

function CostOfLiving() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const budget = useBudget();
  const [from, setFrom] = useState<Currency>(base);
  const [to, setTo] = useState<Currency>(base === "EUR" ? "BRL" : "EUR");

  // Gasto MENSAL: média sobre os meses COM lançamento (o rótulo é "/mês", não a soma de tudo).
  const monthly = useMemo(() => {
    if (!budget) return 0;
    const months = new Set(budget.expenses.map((e) => e.month));
    if (months.size === 0) return 0;
    const total = budget.expenses.reduce((s, e) => s + convert(e.amount, e.currency, disp, rates), 0);
    return total / months.size;
  }, [budget, disp, rates]);

  // Custo de vida por MOEDA. Equivalente na moeda destino: converte os gastos pelo câmbio
  // e aplica o índice de custo de vida.
  const ratio = currencyCostIndex(to) / currencyCostIndex(from);
  const diff = (ratio - 1) * 100;
  const fromExpenses = convert(monthly, disp, from, rates);
  const equivalent = convert(monthly, disp, to, rates) * ratio;

  return (
    <>
      <Card className="p-6 mb-4">
        <CardHead>{t("crossborder.colTitle")}</CardHead>
        <p className="text-[12px] text-muted -mt-2 mb-4 leading-relaxed">{t("crossborder.colHint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <CurrencySelect value={from} onChange={setFrom} />
          <span className="text-faint">→</span>
          <CurrencySelect value={to} onChange={setTo} />
        </div>
        <p className="text-[11px] text-faint mt-4 leading-relaxed">{t("crossborder.colDisclaimer")}</p>
      </Card>
      <CardGrid>
        <StatCard label={t("crossborder.yourExpenses")} value={<Money value={fromExpenses} currency={from} />} sub={t("crossborder.colHint")} />
        <StatCard label={t("crossborder.equivalentCur", { cur: to })} tone="accent" value={<Money value={equivalent} currency={to} />} />
        <StatCard
          label={t("crossborder.difference")}
          tone={diff > 0 ? "neg" : "accent"}
          value={`${diff >= 0 ? "+" : ""}${Math.round(diff)}%`}
        />
      </CardGrid>
    </>
  );
}

function CurrencySelect({ value, onChange }: { value: Currency; onChange: (v: Currency) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Currency)}
      className="h-10 px-3 rounded-[10px] border border-border bg-card text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)] cursor-pointer tabular"
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c} className="bg-card">
          {CURRENCY_SYMBOL[c]} {c}
        </option>
      ))}
    </select>
  );
}

/* ── 3. Obrigações fiscais ─────────────────────────────────────────────── */

function FiscalReminders() {
  const { t } = useTranslation();
  return (
    <>
      <CardGrid>
        {FISCAL.map((k) => (
          <Card key={k} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-[13.5px] font-semibold">{t(`crossborder.fiscal.${k}.title`)}</h4>
              <span className="text-[11px] font-medium text-accent shrink-0 bg-accent-soft px-2 py-0.5 rounded-full whitespace-nowrap">
                {t(`crossborder.fiscal.${k}.when`)}
              </span>
            </div>
            <p className="text-[12px] text-muted leading-relaxed mt-2">{t(`crossborder.fiscal.${k}.desc`)}</p>
          </Card>
        ))}
      </CardGrid>
      <p className="text-[11px] text-faint leading-relaxed mt-4">{t("crossborder.fiscalDisclaimer")}</p>
    </>
  );
}
