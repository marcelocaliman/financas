import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight, Plus, Sparkles, LineChart } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendArea } from "@/components/charts/trend-area";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useVault } from "@/vault/vault-store";
import { convert, formatMoney, CURRENCIES, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { currencyBreakdown, currencyColors, categoryColors, expenseColors } from "@/money/composition";
import { expenseTotal, expenseLeaves } from "@/finance/statement";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLiberdade } from "@/hooks/use-liberdade";
import { useHealth } from "@/hooks/use-health";
import { useMainCurrency } from "@/hooks/use-main-currency";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { SUPPORTED_LANGS } from "@/i18n";
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
import { DailyFxLine } from "@/components/painel/daily-fx-line";
import { WelcomeBack } from "@/components/painel/welcome-back";
import { MilestoneCelebration } from "@/components/painel/milestone-celebration";
import { MonthWrap } from "@/components/painel/month-wrap";
import { BalanceNudge } from "@/components/painel/balance-nudge";
import { TipOfWeek } from "@/components/painel/tip-of-week";
import { NetWorthInCurrencies } from "@/components/painel/networth-in-currencies";
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
  const health = useHealth();
  const tax = useTaxonomy();
  const rates = useRates((s) => s.rates);
  const colors = currencyColors(theme);
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";
  const axisColor = theme === "dark" ? "#5f646c" : "#8a8f98";
  const CAT_COLORS = categoryColors(theme); // alocação/patrimônio = rampa verde→cinza
  const EXP_COLORS = expenseColors(theme); // gastos = rampa quente/vermelha (dinheiro que SAI)

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
    // Gastos por CATEGORIA (mesmo critério do Orçamento → bate). DESMEMBRA as faturas via
    // expenseLeaves (itens dentro + sobra "não discriminado") — sem dupla contagem.
    const byCat = new Map<string, number>();
    for (const l of expenseLeaves(monthExp, rates)) byCat.set(l.categoryId, (byCat.get(l.categoryId) ?? 0) + conv(l.amount, l.currency));
    const expDisp = [...byCat.entries()]
      .map(([id, value]) => ({ id, name: nameById(tax.expenseCategories, id) || t("orcamento.uncategorized"), value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    const totalExp = expenseTotal(monthExp, disp, rates); // só top-level (faturas + avulsos)
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

  return { t, i18n, disp, name, tax, colors, accent, axisColor, CAT_COLORS, EXP_COLORS, monthLabel, view, health };
}

/** Faixa qualitativa do score de saúde (mesma régua do card da Liberdade). */
function gradeKey(score: number): string {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "weak";
}

/** HERO do dashboard — eyebrow mono + manchete + número-herói + composição. */
export function DashboardHero() {
  const { t, disp, colors, view, health, name } = usePainelView();
  const lib = useLiberdade();
  if (!view) return <div className="h-[40vh] rounded-[16px] bg-card/40 border border-border animate-pulse" />;
  if (view.isEmpty) return <PainelEmpty />;

  const hasTrend = view.trend.length >= 2;

  return (
    <>
      <MonthWrap />
      <BalanceNudge />
      <MilestoneCelebration />
      <WelcomeBack name={name} nwChange={view.nwChange} freedomPct={lib?.ready ? lib.freedomPct : null} hasTrend={hasTrend} />
      <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent mb-4">
        {t("dashboard.heroEyebrow")}
      </div>
      <RotatingPhrase />

      {/* Faixa 1 — patrimônio (esquerda) + conversões nas outras moedas (direita) */}
      <div className="mt-7 sm:mt-10 lg:mt-11 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-10 sm:gap-y-6">
        <div>
          <Eyebrow className="mb-2.5">{t("dashboard.netWorth")}</Eyebrow>
          <HeroNumber
            value={view.netWorth}
            currency={disp}
            className="block whitespace-nowrap text-[clamp(2.3rem,6.5vw,4.8rem)]"
          />
          {hasTrend ? (
            <div className="mt-3.5">
              <Delta pct={view.nwChange} suffix={` ${t("dashboard.vsMonth")}`} />
            </div>
          ) : null}
          <DailyFxLine />
        </div>
        <NetWorthInCurrencies netWorth={view.netWorth} />
      </div>

      {/* Faixa 2 — Liberdade + Saúde + Composição, tudo numa linha */}
      <div className="mt-0 border-t border-border pt-6 sm:mt-8 sm:border-t-0 sm:pt-0 flex flex-wrap items-center gap-x-8 gap-y-5 sm:gap-x-12 sm:gap-y-6">
        {/* Celular: Liberdade + Saúde lado a lado (2 colunas). No desktop, `sm:contents` desfaz o
            wrapper e eles voltam a ser filhos diretos da linha (layout original preservado). */}
        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-5 sm:contents">
        {lib?.ready ? (
          <button
            type="button"
            onClick={() => goToSection("liberdade")}
            className="flex items-center gap-3.5 text-left group rounded-[14px] border border-border bg-card2/40 p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:rounded-[12px] sm:border-0 sm:bg-transparent sm:p-1 sm:-m-1"
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
        {health?.score != null ? (
          <button
            type="button"
            onClick={() => goToSection("liberdade")}
            className="flex items-center gap-3.5 text-left group rounded-[14px] border border-border bg-card2/40 p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:rounded-[12px] sm:border-0 sm:bg-transparent sm:p-1 sm:-m-1"
            aria-label={t("dashboard.health")}
          >
            <ProgressRing pct={health.score} size={66} stroke={6}>
              <span className="text-[14px] font-semibold tabular leading-none"><Hidden>{Math.round(health.score)}</Hidden></span>
            </ProgressRing>
            <div className="min-w-0">
              <Eyebrow className="mb-1.5">{t("dashboard.health")}</Eyebrow>
              <div className="text-[13px] text-muted leading-snug max-w-[150px] group-hover:text-text transition-colors">
                <span className="capitalize">{t(`health.grade.${gradeKey(health.score)}`)}</span>
                <span className="text-faint"> · {Math.round(health.score)}/100</span>
              </div>
            </div>
          </button>
        ) : null}
        </div>
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
  const { t, i18n, disp, tax, accent, axisColor, CAT_COLORS, EXP_COLORS, monthLabel, view } = usePainelView();
  if (!view || view.isEmpty) return null;
  const money = (v: number) => formatMoney(v, disp);
  const hasTrend = view.trend.length >= 2;
  // Alocação por classe (TODAS) — donut + legenda; substitui a lista das "maiores posições".
  const allocMap = new Map<string, number>();
  for (const a of view.assetsDisp) allocMap.set(a.classId, (allocMap.get(a.classId) ?? 0) + a.disp);
  const alloc = [...allocMap.entries()]
    .map(([classId, value]) => ({ classId, name: nameById(tax.assetClasses, classId), value }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((c) => ({ ...c, pct: view.totalAssets > 0 ? (c.value / view.totalAssets) * 100 : 0 }));

  return (
    <>
      <TipOfWeek />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className={cn("lg:col-span-2 p-4 sm:p-6 flex flex-col", CARD)}>
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
              <div className="w-full flex-1 min-h-[200px]">
                <TrendArea data={view.trend} xKey="m" yKey="v" color={accent} axisColor={axisColor} currency={disp} lang={i18n.language} name={t("common.networth")} />
              </div>
              <div className="text-[11.5px] text-faint mt-3">{t("dashboard.last6months")}</div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-center min-h-[180px] py-6">
              <div>
                <LineChart size={26} className="text-faint mx-auto mb-3" />
                <p className="text-[13px] text-muted max-w-[280px] mx-auto leading-relaxed">{t("dashboard.trendEmpty")}</p>
                <button
                  type="button"
                  onClick={() => goToSection("historico")}
                  className="mt-3 text-[12.5px] font-medium text-accent hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
                >
                  {t("dashboard.trendEmptyCta")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Indicadores compactos — preenchem a coluna ao lado do gráfico (sem buracos) */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t("dashboard.assets")} value={money(view.totalAssets)} sub={t("dashboard.positionsCount", { count: view.assetsDisp.length })} />
          <StatTile label={t("dashboard.invested")} value={money(view.invested)} sub={t("dashboard.financial")} />
          <StatTile label={t("dashboard.monthlyIncome")} value={money(view.totalInc)} sub={t("dashboard.sources", { count: view.incomeCount })} positive />
          <StatTile label={t("dashboard.monthlyBalance")} value={money(view.saldoMes)} sub={monthLabel} positive={view.saldoMes > 0} negative={view.saldoMes < 0} />
          <StatTile label={t("dashboard.savingsRate")} value={`${Math.round(view.savingsRate)}%`} sub={t("dashboard.savingsRateSub")} positive={view.savingsRate > 0} negative={view.savingsRate < 0} />
          <StatTile
            label={t("dashboard.reserve")}
            value={view.reserveMonths != null ? t("dashboard.reserveMonths", { n: view.reserveMonths.toFixed(1) }) : "—"}
            sub={t("dashboard.reserveSub")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 items-stretch">
        <div className={cn("p-4 sm:p-6", CARD)}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>{t("dashboard.budget")}</Eyebrow>
            <Eyebrow>
              {view.expDisp.length} {t(view.expDisp.length === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}
            </Eyebrow>
          </div>
          <div className="flex items-start gap-5 sm:gap-6">
            <div className="w-[132px] h-[132px] shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={view.expDisp} dataKey="value" nameKey="name" innerRadius={45} outerRadius={65} paddingAngle={2} stroke="none">
                    {view.expDisp.map((e, i) => (
                      <Cell key={e.id} fill={EXP_COLORS[i % EXP_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center leading-none">
                  <div className="eyebrow mb-1">{t("orcamento.expenses")}</div>
                  <Money value={view.totalExp} currency={disp} className="text-[13.5px] font-semibold tracking-[-0.02em]" />
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {view.expDisp.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-2 text-muted truncate">
                    <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: EXP_COLORS[i % EXP_COLORS.length] }} />
                    {e.name}
                  </span>
                  <Money value={e.value} currency={disp} className="font-medium" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={cn("p-4 sm:p-6", CARD)}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>{t("dashboard.allocation")}</Eyebrow>
            <Eyebrow>
              {view.assetsDisp.length} {t(view.assetsDisp.length === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}
            </Eyebrow>
          </div>
          {alloc.length > 0 ? (
            <div className="flex items-start gap-5 sm:gap-6">
              {/* Donut (anel) por classe, com o total no centro — estilo dos anéis de Liberdade/Saúde */}
              <div className="w-[132px] h-[132px] shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={45} outerRadius={65} paddingAngle={2} stroke="none">
                      {alloc.map((a, i) => (
                        <Cell key={a.classId} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="text-center leading-none">
                    <div className="eyebrow mb-1">{t("dashboard.assets")}</div>
                    <Money value={view.totalAssets} currency={disp} className="text-[13.5px] font-semibold tracking-[-0.02em]" />
                  </div>
                </div>
              </div>
              {/* Legenda = todas as classes (empilhadas, um embaixo do outro): cor · nome · % · valor */}
              <div className="flex-1 min-w-0 flex flex-col gap-y-2">
                {alloc.map((a, i) => (
                  <div key={a.classId} className="flex items-center justify-between gap-3 text-[12.5px] min-w-0">
                    <span className="flex items-center gap-2 text-muted truncate min-w-0">
                      <span className="w-[8px] h-[8px] rounded-[2px] shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <span className="truncate">{a.name}</span>
                    </span>
                    <span className="flex items-baseline gap-1.5 shrink-0">
                      <span className="font-semibold tabular text-text"><Hidden>{a.pct.toFixed(1) + "%"}</Hidden></span>
                      <Money value={a.value} currency={disp} className="text-[11px] text-faint" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-faint py-6">{t("patrimonio.emptyAssets")}</p>
          )}
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
        "font-semibold text-[clamp(1.9rem,5vw,3.6rem)] tracking-[-0.035em] leading-[1.04] max-w-[760px] min-h-[2.1em] text-text transition-opacity duration-500 motion-reduce:transition-none",
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

function StatTile({ label, value, sub, positive, negative, wide }: { label: string; value: string; sub?: string; positive?: boolean; negative?: boolean; wide?: boolean }) {
  const hidden = useUI((s) => s.numbersHidden);
  return (
    <div className={cn("p-4 sm:p-5", CARD, wide && "col-span-2")}>
      <Eyebrow>{label}</Eyebrow>
      <div className={cn("font-numeric font-semibold text-[22px] tracking-[-0.02em] tabular mt-2", negative ? "text-neg" : positive ? "text-accent" : "text-text")}>
        {hidden ? "••••" : value}
      </div>
      {sub ? <div className="text-[11.5px] text-faint mt-1">{sub}</div> : null}
    </div>
  );
}

function SetupPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        active ? "bg-accent text-[#0A0B0D] border-accent" : "border-border text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function PainelEmpty() {
  const { t, i18n } = useTranslation();
  const { baseCurrency, setMainCurrency } = useMainCurrency();
  const steps: { n: number; label: string; section: string }[] = [
    { n: 1, label: t("dashboard.step1"), section: "patrimonio" },
    { n: 2, label: t("dashboard.step2"), section: "orcamento" },
    { n: 3, label: t("dashboard.step3"), section: "liberdade" },
  ];
  return (
    <div className="flex flex-col items-center text-center w-full py-10">
      <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-5">
        <Sparkles size={22} />
      </div>
      <div className="text-[clamp(26px,4.5vw,46px)] font-semibold tracking-[-0.025em]">{t("dashboard.empty")}</div>
      <p className="text-[14px] text-muted mt-3 max-w-md leading-relaxed">{t("dashboard.emptyDesc")}</p>

      {/* Primeiro acesso: idioma + moeda principal (toques rápidos, sem atrito) */}
      <div className="w-full max-w-2xl rounded-[14px] border border-border bg-card2 p-5 mt-7 text-left">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <span className="eyebrow block mb-2.5">{t("common.language")}</span>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_LANGS.map((lng) => (
                <SetupPill key={lng} active={i18n.resolvedLanguage === lng} onClick={() => void i18n.changeLanguage(lng)}>
                  {lng.toUpperCase()}
                </SetupPill>
              ))}
            </div>
          </div>
          <div>
            <span className="eyebrow block mb-2.5">{t("common.baseCurrency")}</span>
            <div className="flex flex-wrap gap-1.5">
              {CURRENCIES.map((c) => (
                <SetupPill key={c} active={baseCurrency === c} onClick={() => setMainCurrency(c)}>
                  {CURRENCY_SYMBOL[c]} {c}
                </SetupPill>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Como começar — 3 passos clicáveis (orienta o recém-chegado) */}
      <div className="grid sm:grid-cols-3 gap-3 mt-6 w-full max-w-2xl text-left">
        {steps.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => goToSection(s.section)}
            className="p-4 rounded-[12px] border border-border bg-card2 hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className="grid place-items-center w-6 h-6 rounded-full bg-accent-soft text-accent text-[12px] font-bold mb-2.5">{s.n}</span>
            <div className="text-[12.5px] text-muted leading-snug">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
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
