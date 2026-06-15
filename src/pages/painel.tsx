import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight, Plus, Sparkles } from "lucide-react";
import { scrollToSection } from "@/hooks/use-scroll-spy";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { currencyBreakdown, currencyColors } from "@/money/composition";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { actions } from "@/data/actions";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Button } from "@/components/common/button";
import { HeroNumber } from "@/components/common/hero-number";
import { CompositionBar } from "@/components/patrimonio/composition-bar";
import { cn } from "@/lib/utils";

export default function Painel() {
  const { t, i18n } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const { data } = useDashboardData();
  const colors = currencyColors(theme);
  const accent = theme === "dark" ? "#c7f94e" : "#5b7a12";
  const axisColor = theme === "dark" ? "#6b6e76" : "#80858f";
  const CAT_COLORS =
    theme === "dark"
      ? ["#5bd9a4", "#6e8fd6", "#a894ff", "#e0a96d", "#9a9ca3", "#6b6e76"]
      : ["#0f9e72", "#2c63d6", "#6e4fd0", "#b5791f", "#3fb6a0", "#80858f"];

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
    const netWorth = totalAssets - totalLiab;
    const curSegments = currencyBreakdown(data.assets, disp);
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
      netWorth,
      curSegments,
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

  if (!view) return <div className="h-44 rounded-[18px] bg-card border border-border animate-pulse" />;
  if (view.isEmpty) return <PainelEmpty />;

  const money = (v: number) => formatMoney(v, disp);
  const hasTrend = view.trend.length >= 2;

  return (
    <div className="space-y-5">
      {/* ── Âncora + Evolução ───────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">
        <Tile className="col-span-12 lg:col-span-5 p-7">
          <Eyebrow>{t("dashboard.netWorth")}</Eyebrow>
          <HeroNumber
            value={view.netWorth}
            currency={disp}
            className="block text-[clamp(40px,5vw,60px)] mt-3"
          />
          {hasTrend ? (
            <div className="mt-3">
              <Delta pct={view.nwChange} suffix={` ${t("dashboard.vsMonth")}`} />
            </div>
          ) : null}
          {view.curSegments.length > 0 ? (
            <>
              <div className="h-px bg-border my-6" />
              <Eyebrow className="mb-3">{t("dashboard.composition")}</Eyebrow>
              <CompositionBar
                segments={view.curSegments.map((s) => ({
                  label: s.currency,
                  pct: s.pct,
                  color: colors[s.currency],
                }))}
              />
            </>
          ) : null}
        </Tile>

        <Tile className="col-span-12 lg:col-span-7 p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <Eyebrow>{t("dashboard.netWorthTrend")}</Eyebrow>
            {hasTrend ? <Delta pct={view.nwChange} /> : null}
          </div>
          <div className="text-[12px] text-faint mt-1">
            {t("dashboard.last6months")} · {CURRENCY_SYMBOL[disp]}
          </div>
          <div className="w-full flex-1 min-h-[170px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.trend} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  contentStyle={{
                    background: "var(--card-2)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2.5} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Tile>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">
        <StatTile
          label={t("dashboard.assets")}
          value={money(view.totalAssets)}
          sub={t("dashboard.positionsCount", { count: view.assetsDisp.length })}
        />
        <StatTile label={t("dashboard.invested")} value={money(view.invested)} sub={t("dashboard.fixedIncome")} />
        <StatTile
          label={t("dashboard.monthlyIncome")}
          value={money(view.totalInc)}
          sub={t("dashboard.sources", { count: view.incomeCount })}
          positive
        />
        <StatTile
          label={t("dashboard.monthlyBalance")}
          value={money(view.saldoMes)}
          sub={monthLabel}
          positive={view.saldoMes >= 0}
        />
      </div>

      {/* ── Orçamento + Posições ────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">
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
                  <Tooltip
                    formatter={(v) => money(Number(v))}
                    contentStyle={{ background: "var(--card-2)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {view.expDisp.map((e, i) => (
                <div key={e.name} className="flex items-center justify-between text-[13px]">
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
          <div className="mt-2">
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
    </div>
  );
}

function Delta({ pct, suffix }: { pct: number; suffix?: string }) {
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold tabular", up ? "text-accent" : "text-neg")}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {(up ? "+" : "") + pct.toFixed(1)}%{suffix ? <span className="text-faint font-normal">{suffix}</span> : null}
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <Tile className="col-span-6 lg:col-span-3 p-6">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "font-display font-semibold text-[clamp(20px,2vw,26px)] tracking-[-0.02em] tabular mt-2",
          positive ? "text-pos" : "text-text",
        )}
      >
        {value}
      </div>
      {sub ? <div className="text-[11.5px] text-faint mt-1">{sub}</div> : null}
    </Tile>
  );
}

function PainelEmpty() {
  const { t } = useTranslation();
  return (
    <Tile className="p-12 text-center max-w-2xl mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mx-auto mb-5">
        <Sparkles size={22} />
      </div>
      <div className="text-[19px] font-display font-semibold tracking-[-0.01em]">{t("dashboard.empty")}</div>
      <p className="text-[13.5px] text-muted mt-2 max-w-sm mx-auto leading-relaxed">{t("dashboard.emptyDesc")}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        <Button onClick={() => scrollToSection("patrimonio")}>
          <Plus size={15} />
          {t("dashboard.emptyCta")}
        </Button>
        <Button variant="secondary" onClick={() => void actions.loadSample()}>
          {t("data.loadSample")}
        </Button>
      </div>
    </Tile>
  );
}
