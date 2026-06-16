import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight, Plus, Sparkles } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { currencyBreakdown, currencyColors } from "@/money/composition";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { actions } from "@/data/actions";
import { scrollToSection } from "@/hooks/use-scroll-spy";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Button } from "@/components/common/button";
import { HeroNumber } from "@/components/common/hero-number";
import { CompositionBar } from "@/components/patrimonio/composition-bar";
import { cn } from "@/lib/utils";

function firstName(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}

function usePainelView() {
  const { t, i18n } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const name = firstName(useVault((s) => s.email));
  const { data } = useDashboardData();
  const colors = currencyColors(theme);
  const accent = theme === "dark" ? "#3fa7a0" : "#2c7a7b";
  const axisColor = theme === "dark" ? "#5e6e80" : "#8696a8";
  const CAT_COLORS =
    theme === "dark"
      ? ["#3FA7A0", "#5B82A8", "#C9A86A", "#6E8BA0", "#3E6E6A", "#9FB0BF"]
      : ["#2C7A7B", "#3A6EA5", "#9A7B3F", "#5D7184", "#2F6E6A", "#8696A8"];

  const monthLabel = useMemo(() => {
    const m = new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(new Date());
    return m.charAt(0).toUpperCase() + m.slice(1);
  }, [i18n.language]);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (amount: number, from: Currency) => convert(amount, from, disp);
    const assetsDisp = data.assets.map((a) => ({ ...a, disp: conv(a.amount, a.currency) }));
    const totalAssets = assetsDisp.reduce((s, a) => s + a.disp, 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const invested = data.assets
      .filter((a) => a.type === "investment")
      .reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const expDisp = data.expenses.map((e) => ({ name: e.name, value: conv(e.amount, e.currency) }));
    const totalExp = expDisp.reduce((s, e) => s + e.value, 0);
    const totalInc = data.incomes.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const trend = data.snapshots.map((s) => ({ m: s.month, v: conv(s.amount, s.currency) }));
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
      curSegments: currencyBreakdown(data.assets, disp),
      invested,
      expDisp,
      totalExp,
      totalInc,
      incomeCount: data.incomes.length,
      saldoMes: totalInc - totalExp,
      trend,
      nwChange,
      isEmpty,
    };
  }, [data, disp]);

  return { t, disp, name, colors, accent, axisColor, CAT_COLORS, monthLabel, view };
}

/** HERO do dashboard — conteúdo (sem box; o degradê full-bleed vem da OnePage). */
export function DashboardHero() {
  const { t, disp, colors, accent, axisColor, monthLabel, view } = usePainelView();
  if (!view) return <div className="h-[50vh] rounded-[18px] bg-card/40 border border-border animate-pulse" />;
  if (view.isEmpty) return <PainelEmpty />;

  const money = (v: number) => formatMoney(v, disp);
  const hasTrend = view.trend.length >= 2;

  return (
    <>
      {/* Manchete inspiradora (rotaciona) */}
      <RotatingPhrase />

      {/* Patrimônio líquido (número menor) + composição AO LADO */}
      <div className="mt-6 lg:mt-8 flex flex-wrap items-end justify-between gap-x-12 gap-y-7">
        <div>
          <div className="text-[13px] uppercase tracking-[0.16em] text-muted font-semibold">
            {t("dashboard.netWorth")}
          </div>
          <HeroNumber
            value={view.netWorth}
            currency={disp}
            className="block whitespace-nowrap text-[clamp(28px,4.6vw,58px)] mt-1.5"
          />
          {hasTrend ? (
            <div className="mt-3">
              <Delta pct={view.nwChange} suffix={` ${t("dashboard.vsMonth")}`} />
            </div>
          ) : null}
        </div>
        {view.curSegments.length > 0 ? (
          <div className="flex-1 min-w-[260px] max-w-md">
            <Eyebrow className="mb-3">{t("dashboard.composition")}</Eyebrow>
            <CompositionBar
              segments={view.curSegments.map((s) => ({ label: s.currency, pct: s.pct, color: colors[s.currency] }))}
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-12 gap-5 mt-14 lg:mt-20">
        <div className="col-span-12 lg:col-span-7 rounded-[18px] glass border border-border p-6 lg:p-7">
          <div className="flex items-center justify-between">
            <Eyebrow>{t("dashboard.netWorthTrend")}</Eyebrow>
            {hasTrend ? <Delta pct={view.nwChange} /> : null}
          </div>
          <div className="text-[12px] text-faint mt-1">
            {t("dashboard.last6months")} · {CURRENCY_SYMBOL[disp]}
          </div>
          <div className="w-full h-[200px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.trend} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} dy={4} />
                <Tooltip
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                  formatter={(v) => money(Number(v))}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                  labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
                />
                <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-4">
          <StatTile label={t("dashboard.assets")} value={money(view.totalAssets)} sub={t("dashboard.positionsCount", { count: view.assetsDisp.length })} />
          <StatTile label={t("dashboard.invested")} value={money(view.invested)} sub={t("dashboard.fixedIncome")} />
          <StatTile label={t("dashboard.monthlyIncome")} value={money(view.totalInc)} sub={t("dashboard.sources", { count: view.incomeCount })} positive />
          <StatTile label={t("dashboard.monthlyBalance")} value={money(view.saldoMes)} sub={monthLabel} positive={view.saldoMes >= 0} />
        </div>
      </div>

    </>
  );
}

/** Detalhe do dashboard (logo abaixo do hero): orçamento + posições. */
export function DashboardDetail() {
  const { t, disp, colors, CAT_COLORS, view } = usePainelView();
  if (!view || view.isEmpty) return null;
  const money = (v: number) => formatMoney(v, disp);

  return (
    <div className="grid grid-cols-12 gap-5 pt-14 lg:pt-16">
      <Tile className="col-span-12 lg:col-span-5 p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>{t("dashboard.budget")}</Eyebrow>
          <Money value={view.totalExp} currency={disp} className="text-[12.5px] text-muted" />
        </div>
        <div className="flex items-center gap-5 mt-4">
          <div className="w-[120px] h-[120px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={view.expDisp} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
                  {view.expDisp.map((e, i) => (
                    <Cell key={e.name} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {view.expDisp.map((e, i) => (
              <div key={e.name} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2 text-muted truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  {e.name}
                </span>
                <Money value={e.value} currency={disp} className="font-medium" />
              </div>
            ))}
          </div>
        </div>
      </Tile>

      <Tile className="col-span-12 lg:col-span-7 p-6">
        <div className="flex items-center justify-between mb-1">
          <Eyebrow>{t("dashboard.positionsTitle")}</Eyebrow>
          <span className="text-[11.5px] text-faint tabular">
            {view.assetsDisp.length} {t(view.assetsDisp.length === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}
          </span>
        </div>
        <div className="mt-2 grid sm:grid-cols-2 gap-x-8">
          {view.assetsDisp.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 py-2.5 pl-3 border-l-2"
              style={{ borderColor: colors[a.currency] }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[10.5px] font-semibold tabular text-faint w-7 shrink-0">{a.currency}</span>
                <span className="text-[13.5px] truncate">{a.name}</span>
              </div>
              <Money value={a.disp} currency={disp} className="text-[13.5px] font-semibold tabular" />
            </div>
          ))}
        </div>
      </Tile>
    </div>
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
    if (list.length < 2) return;
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
    <p
      className={cn(
        "font-display font-semibold text-[clamp(24px,3.6vw,46px)] tracking-[-0.02em] leading-[1.12] max-w-3xl min-h-[2.4em] text-text transition-opacity duration-500",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      {list[i]}
    </p>
  );
}

function Delta({ pct, suffix }: { pct: number; suffix?: string }) {
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold tabular", up ? "text-gold" : "text-neg")}>
      {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
      {(up ? "+" : "") + pct.toFixed(1)}%{suffix ? <span className="text-faint font-normal">{suffix}</span> : null}
    </span>
  );
}

function StatTile({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  const hidden = useUI((s) => s.numbersHidden);
  return (
    <div className="rounded-[16px] bg-card/55 border border-border p-5 backdrop-blur-sm">
      <Eyebrow>{label}</Eyebrow>
      <div className={cn("font-numeric font-semibold text-[clamp(20px,2vw,28px)] tracking-[-0.02em] tabular mt-2", positive ? "text-pos" : "text-text")}>
        {hidden ? "••••" : value}
      </div>
      {sub ? <div className="text-[11.5px] text-faint mt-1">{sub}</div> : null}
    </div>
  );
}

function PainelEmpty() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center w-full">
      <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-5">
        <Sparkles size={22} />
      </div>
      <div className="text-[clamp(26px,4.5vw,46px)] font-display font-semibold tracking-[-0.02em]">{t("dashboard.empty")}</div>
      <p className="text-[14px] text-muted mt-3 max-w-md leading-relaxed">{t("dashboard.emptyDesc")}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
        <Button onClick={() => scrollToSection("patrimonio")}>
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
