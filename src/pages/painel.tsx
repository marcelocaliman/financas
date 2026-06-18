import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight, Plus, Sparkles, LineChart } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useVault } from "@/vault/vault-store";
import { convert, formatMoney, type Currency } from "@/money/currency";
import { currencyBreakdown, currencyColors, categoryColors } from "@/money/composition";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLiberdade } from "@/hooks/use-liberdade";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { CLASS, isInvestedClass, nameById } from "@/domain/taxonomy";
import { actions } from "@/data/actions";
import { goToSection } from "@/hooks/use-scroll-spy";
import { Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { ProgressRing } from "@/components/common/progress-ring";
import { Button } from "@/components/common/button";
import { HeroNumber } from "@/components/common/hero-number";
import { CompositionBar } from "@/components/patrimonio/composition-bar";
import { cn } from "@/lib/utils";

function firstName(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}

const CARD = "rounded-[16px] bg-card border border-border";

function usePainelView() {
  const { t, i18n } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const name = firstName(useVault((s) => s.email));
  const { data } = useDashboardData();
  const tax = useTaxonomy();
  const rates = useRates((s) => s.rates);
  const colors = currencyColors(theme);
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";
  const axisColor = theme === "dark" ? "#5f646c" : "#8a8f98";
  const CAT_COLORS = categoryColors(theme);

  const monthLabel = useMemo(() => {
    const m = new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(new Date());
    return m.charAt(0).toUpperCase() + m.slice(1);
  }, [i18n.language]);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (amount: number, from: Currency) => convert(amount, from, disp, rates);
    const assetsDisp = data.assets.map((a) => ({ ...a, disp: conv(a.amount, a.currency) }));
    const totalAssets = assetsDisp.reduce((s, a) => s + a.disp, 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const invested = data.assets
      .filter((a) => isInvestedClass(a.classId))
      .reduce((s, a) => s + conv(a.amount, a.currency), 0);
    // Orçamento do MÊS CORRENTE (entradas agora têm mês) — o dashboard é "agora".
    const now = new Date();
    const mo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthExp = data.expenses.filter((e) => e.month === mo);
    const monthInc = data.incomes.filter((i) => i.month === mo);
    // Gastos agrupados por CATEGORIA (mesmo critério do módulo Orçamento → bate).
    const byCat = new Map<string, number>();
    for (const e of monthExp) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + conv(e.amount, e.currency));
    const expDisp = [...byCat.entries()]
      .map(([id, value]) => ({ id, name: nameById(tax.expenseCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    const totalExp = monthExp.reduce((s, e) => s + conv(e.amount, e.currency), 0);
    const totalInc = monthInc.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const trend = [...data.snapshots]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((s) => ({ m: s.month, v: conv(s.amount, s.currency) }));
    const last = trend.at(-1);
    const prev = trend.at(-2);
    const nwChange = last && prev && prev.v !== 0 ? ((last.v - prev.v) / prev.v) * 100 : 0;
    const isEmpty =
      data.assets.length === 0 &&
      data.liabilities.length === 0 &&
      data.expenses.length === 0 &&
      data.incomes.length === 0 &&
      data.snapshots.length === 0;
    return {
      assetsDisp,
      totalAssets,
      totalLiab,
      netWorth: totalAssets - totalLiab,
      curSegments: currencyBreakdown(data.assets, disp, rates),
      invested,
      expDisp,
      totalExp,
      totalInc,
      incomeCount: monthInc.length,
      saldoMes: totalInc - totalExp,
      // Saúde: taxa de poupança (do que entrou) + cobertura da reserva (caixa ÷ gasto/mês).
      savingsRate: totalInc > 0 ? ((totalInc - totalExp) / totalInc) * 100 : 0,
      reserveMonths: totalExp > 0 ? assetsDisp.filter((a) => a.classId === CLASS.caixa).reduce((s, a) => s + a.disp, 0) / totalExp : null,
      trend,
      nwChange,
      isEmpty,
    };
  }, [data, disp, rates, tax, t]);

  return { t, disp, name, tax, colors, accent, axisColor, CAT_COLORS, monthLabel, view };
}

/** HERO do dashboard — eyebrow mono + manchete + número-herói + composição. */
export function DashboardHero() {
  const { t, disp, colors, view } = usePainelView();
  const lib = useLiberdade();
  if (!view) return <div className="h-[40vh] rounded-[16px] bg-card/40 border border-border animate-pulse" />;
  if (view.isEmpty) return <PainelEmpty />;

  const hasTrend = view.trend.length >= 2;

  return (
    <>
      <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent mb-4">
        {t("dashboard.heroEyebrow")}
      </div>
      <RotatingPhrase />

      <div className="flex flex-wrap items-end gap-x-14 gap-y-7 mt-10 lg:mt-11">
        <div>
          <Eyebrow className="mb-2.5">{t("dashboard.netWorth")}</Eyebrow>
          <HeroNumber
            value={view.netWorth}
            currency={disp}
            className="block whitespace-nowrap text-[clamp(3rem,6.5vw,4.8rem)]"
          />
          {hasTrend ? (
            <div className="mt-3.5">
              <Delta pct={view.nwChange} suffix={` ${t("dashboard.vsMonth")}`} />
            </div>
          ) : null}
        </div>
        {lib?.ready ? (
          <button
            type="button"
            onClick={() => goToSection("liberdade")}
            className="flex items-center gap-3.5 text-left group rounded-[12px] -m-1 p-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label={t("liberdade.title")}
          >
            <ProgressRing pct={lib.freedomPct} size={66} stroke={6}>
              <span className="text-[13px] font-semibold tabular leading-none"><Hidden>{Math.round(lib.freedomPct)}%</Hidden></span>
            </ProgressRing>
            <div className="min-w-0">
              <Eyebrow className="mb-1.5">{t("liberdade.short")}</Eyebrow>
              <div className="text-[13px] text-muted leading-snug max-w-[170px] group-hover:text-text transition-colors">
                {lib.reached
                  ? t("liberdade.headlineReached")
                  : lib.yearsOfFreedom != null
                    ? t("liberdade.heroYears", { n: lib.yearsOfFreedom.toFixed(1) })
                    : t("liberdade.heroNote")}
              </div>
            </div>
          </button>
        ) : null}
        {view.curSegments.length > 0 ? (
          <div className="flex-1 min-w-[280px] max-w-[460px]">
            <Eyebrow className="mb-3">{t("dashboard.composition")}</Eyebrow>
            <CompositionBar
              segments={view.curSegments.map((s) => ({ label: s.currency, pct: s.pct, color: colors[s.currency] }))}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Dashboard (abaixo do hero): gráfico + stats, depois orçamento + posições. */
export function DashboardDetail() {
  const { t, disp, tax, accent, CAT_COLORS, monthLabel, view } = usePainelView();
  if (!view || view.isEmpty) return null;
  const money = (v: number) => formatMoney(v, disp);
  const hasTrend = view.trend.length >= 2;
  const topAssets = [...view.assetsDisp].sort((a, b) => b.disp - a.disp).slice(0, 4);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className={cn("lg:col-span-2 p-6 flex flex-col", CARD)}>
          <div className="flex items-center justify-between mb-5">
            <Eyebrow>{t("dashboard.netWorthTrend")}</Eyebrow>
            {hasTrend ? (
              <span className="text-accent text-[13px] font-semibold tabular">
                <Hidden>{(view.nwChange >= 0 ? "+" : "") + view.nwChange.toFixed(1) + "%"}</Hidden>
              </span>
            ) : null}
          </div>
          {hasTrend ? (
            <>
              <div className="w-full flex-1 min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={view.trend} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                    <defs>
                      <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                      formatter={(v) => money(Number(v))}
                      contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                      labelStyle={{ color: "var(--muted)", marginBottom: 2 }}
                    />
                    <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill="url(#nwGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[11.5px] text-faint mt-3">{t("dashboard.last6months")}</div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-center min-h-[180px] py-6">
              <div>
                <LineChart size={26} className="text-faint mx-auto mb-3" />
                <p className="text-[13px] text-muted max-w-[260px] mx-auto leading-relaxed">{t("dashboard.trendEmpty")}</p>
              </div>
            </div>
          )}
        </div>

        {/* Indicadores compactos — preenchem a coluna ao lado do gráfico (sem buracos) */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t("dashboard.assets")} value={money(view.totalAssets)} sub={t("dashboard.positionsCount", { count: view.assetsDisp.length })} />
          <StatTile label={t("dashboard.invested")} value={money(view.invested)} sub={t("dashboard.financial")} />
          <StatTile label={t("dashboard.monthlyIncome")} value={money(view.totalInc)} sub={t("dashboard.sources", { count: view.incomeCount })} positive />
          <StatTile label={t("dashboard.monthlyBalance")} value={money(view.saldoMes)} sub={monthLabel} positive={view.saldoMes >= 0} />
          <StatTile label={t("dashboard.savingsRate")} value={`${Math.round(view.savingsRate)}%`} sub={t("dashboard.savingsRateSub")} positive={view.savingsRate >= 0} />
          <StatTile
            label={t("dashboard.reserve")}
            value={view.reserveMonths != null ? t("dashboard.reserveMonths", { n: view.reserveMonths.toFixed(1) }) : "—"}
            sub={t("dashboard.reserveSub")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className={cn("p-6", CARD)}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>{t("dashboard.budget")}</Eyebrow>
            <Money value={view.totalExp} currency={disp} className="text-[13px] text-muted" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-[116px] h-[116px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={view.expDisp} dataKey="value" nameKey="name" innerRadius={36} outerRadius={56} paddingAngle={2} stroke="none">
                    {view.expDisp.map((e, i) => (
                      <Cell key={e.id} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {view.expDisp.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-2 text-muted truncate">
                    <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    {e.name}
                  </span>
                  <Money value={e.value} currency={disp} className="font-medium" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={cn("lg:col-span-2 p-6", CARD)}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>{t("dashboard.topPositions")}</Eyebrow>
            <Eyebrow>
              {view.assetsDisp.length} {t(view.assetsDisp.length === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}
            </Eyebrow>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[440px]">
              <div className="grid grid-cols-[1.6fr_1fr_1fr] pb-2 border-b border-border">
                <Eyebrow>{t("patrimonio.name")}</Eyebrow>
                <Eyebrow>{t("patrimonio.class")}</Eyebrow>
                <Eyebrow className="text-right">{t("patrimonio.amount")}</Eyebrow>
              </div>
              {topAssets.map((a, i) => (
                <div
                  key={a.id}
                  className={cn(
                    "grid grid-cols-[1.6fr_1fr_1fr] items-center py-[11px]",
                    i < topAssets.length - 1 && "border-b border-border",
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={cn("chip", `chip-${a.currency}`)}>{a.currency}</span>
                    <span className="text-[13.5px] truncate">{a.name}</span>
                  </span>
                  <span className="text-[13px] text-muted truncate">{nameById(tax.assetClasses, a.classId)}</span>
                  <Money value={a.disp} currency={disp} className="text-[13.5px] font-semibold tabular text-right" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const ROTATE_MS = 6500;

/** Manchete inspiradora que rotaciona com fade — motiva a investir no futuro. */
function RotatingPhrase() {
  const { t } = useTranslation();
  const phrases = t("hero.phrases", { returnObjects: true });
  const list = Array.isArray(phrases) ? (phrases as string[]) : [];
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (list.length < 2 || reduce) return; // sem rotação se o usuário pediu menos movimento
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setI((p) => (p + 1) % list.length);
        setShow(true);
      }, 450);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [list.length]);

  if (!list.length) return null;
  return (
    <div
      className={cn(
        "font-semibold text-[clamp(2.4rem,5vw,3.6rem)] tracking-[-0.035em] leading-[1.04] max-w-[760px] min-h-[2.1em] text-text transition-opacity duration-500 motion-reduce:transition-none",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      {list[i]}
    </div>
  );
}

function Delta({ pct, suffix }: { pct: number; suffix?: string }) {
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[14px] font-semibold tabular", up ? "text-accent" : "text-neg")}>
      {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      <Hidden>{(up ? "+" : "") + pct.toFixed(1) + "%"}</Hidden>{suffix ? <span className="text-faint font-medium">{suffix}</span> : null}
    </span>
  );
}

function StatTile({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  const hidden = useUI((s) => s.numbersHidden);
  return (
    <div className={cn("p-5", CARD)}>
      <Eyebrow>{label}</Eyebrow>
      <div className={cn("font-numeric font-semibold text-[22px] tracking-[-0.02em] tabular mt-2", positive ? "text-accent" : "text-text")}>
        {hidden ? "••••" : value}
      </div>
      {sub ? <div className="text-[11.5px] text-faint mt-1">{sub}</div> : null}
    </div>
  );
}

function PainelEmpty() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center w-full py-10">
      <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-5">
        <Sparkles size={22} />
      </div>
      <div className="text-[clamp(26px,4.5vw,46px)] font-semibold tracking-[-0.025em]">{t("dashboard.empty")}</div>
      <p className="text-[14px] text-muted mt-3 max-w-md leading-relaxed">{t("dashboard.emptyDesc")}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
        <Button onClick={() => goToSection("patrimonio")}>
          <Plus size={15} />
          {t("dashboard.emptyCta")}
        </Button>
        <Button variant="secondary" onClick={() => void actions.loadSample()}>
          {t("data.loadSample")}
        </Button>
      </div>
    </div>
  );
}
