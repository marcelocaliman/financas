import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Plus, Sparkles } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from "recharts";
import { useUI } from "@/store/ui";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { currencyBreakdown, CUR_COLOR } from "@/money/composition";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { actions } from "@/data/actions";
import { Panel } from "@/components/common/panel";
import { StatCard } from "@/components/common/stat-card";
import { Money } from "@/components/common/money";
import { Button } from "@/components/common/button";
import { CurrencyBadge } from "@/components/common/currency-badge";
import { CompositionBar } from "@/components/patrimonio/composition-bar";
import { cn } from "@/lib/utils";

const CAT_COLORS = ["#2C7A7B", "#5B7B9A", "#7FB2B2", "#9FB3C8", "#C5D2DD", "#E2E8EE"];
const TEAL = "#2C7A7B";

export default function Painel() {
  const { t, i18n } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const { data } = useDashboardData();

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
    const saldoMes = totalInc - totalExp;

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
      saldoMes,
      trend,
      nwChange,
      isEmpty,
    };
  }, [data, disp]);

  if (!view) {
    return <div className="h-40 rounded-2xl bg-card border border-border animate-pulse" />;
  }

  if (view.isEmpty) return <PainelEmpty />;

  const money = (v: number) => formatMoney(v, disp);
  const up = view.nwChange >= 0;
  const changeText = `${up ? "+" : ""}${view.nwChange.toFixed(1)}`;

  return (
    <div className="space-y-5">
      {/* Hero: patrimônio líquido + composição por moeda */}
      <Panel className="p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[13px] text-muted font-medium">{t("dashboard.netWorth")}</div>
            <Money
              value={view.netWorth}
              currency={disp}
              className={cn(
                "block text-[40px] font-bold tracking-[-0.02em] leading-tight mt-1",
                view.netWorth < 0 && "text-neg",
              )}
            />
          </div>
          {view.trend.length >= 2 ? (
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold",
                up ? "bg-teal-soft text-teal" : "bg-neg-soft text-neg",
              )}
            >
              {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              <span className="tabular-nums">{t("dashboard.monthChange", { value: changeText })}</span>
            </div>
          ) : null}
        </div>

        {view.curSegments.length > 0 ? (
          <div className="mt-6">
            <CompositionBar
              segments={view.curSegments.map((s) => ({
                label: s.currency,
                pct: s.pct,
                color: CUR_COLOR[s.currency],
              }))}
            />
          </div>
        ) : null}
      </Panel>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("dashboard.assets")}
          value={money(view.totalAssets)}
          sub={t("dashboard.positionsCount", { count: view.assetsDisp.length })}
        />
        <StatCard
          label={t("dashboard.invested")}
          value={money(view.invested)}
          sub={t("dashboard.fixedIncome")}
        />
        <StatCard
          label={t("dashboard.monthlyIncome")}
          value={money(view.totalInc)}
          sub={t("dashboard.sources", { count: view.incomeCount })}
          positive
        />
        <StatCard
          label={t("dashboard.monthlyBalance")}
          value={money(view.saldoMes)}
          sub={monthLabel}
          positive={view.saldoMes >= 0}
        />
      </div>

      {/* Orçamento + Evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-[15px]">{t("dashboard.budget")}</span>
            <Money value={view.totalExp} currency={disp} className="text-[13px] text-muted" />
          </div>
          <div className="text-[12px] text-faint mb-2">{t("dashboard.byCategory")}</div>
          <div className="flex items-center gap-4">
            <div className="w-[130px] h-[130px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={view.expDisp}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={62}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {view.expDisp.map((e, i) => (
                      <Cell key={e.name} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {view.expDisp.map((e, i) => (
                <div key={e.name} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-muted truncate">
                    <span
                      className="w-2 h-2 rounded-[2px] shrink-0"
                      style={{ background: CAT_COLORS[i % CAT_COLORS.length] }}
                    />
                    {e.name}
                  </span>
                  <Money value={e.value} currency={disp} className="font-medium" />
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-[15px]">{t("dashboard.netWorthTrend")}</span>
            {view.trend.length >= 2 ? (
              <span
                className={cn("text-[13px] font-semibold tabular-nums", up ? "text-teal" : "text-neg")}
              >
                {changeText}%
              </span>
            ) : null}
          </div>
          <div className="text-[12px] text-faint mb-3">
            {t("dashboard.last6months")} · {CURRENCY_SYMBOL[disp]}
          </div>
          <div className="w-full h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#90A0B3" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Area type="monotone" dataKey="v" stroke={TEAL} strokeWidth={2.5} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Posições */}
      <Panel className="p-6">
        <div className="font-semibold text-[15px] mb-3">{t("dashboard.positionsTitle")}</div>
        <div>
          {view.assetsDisp.map((a, i) => (
            <div
              key={a.id}
              className="flex items-center justify-between py-2"
              style={{
                borderBottom: i < view.assetsDisp.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <CurrencyBadge currency={a.currency} />
                <span className="text-[14px] truncate">{a.name}</span>
              </div>
              <Money value={a.disp} currency={disp} className="text-[14px] font-semibold" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function PainelEmpty() {
  const { t } = useTranslation();
  return (
    <Panel className="p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-teal-soft text-teal flex items-center justify-center mx-auto mb-4">
        <Sparkles size={22} />
      </div>
      <div className="text-[17px] font-semibold tracking-[-0.01em]">{t("dashboard.empty")}</div>
      <p className="text-[13px] text-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
        {t("dashboard.emptyDesc")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        <Link to="/patrimonio">
          <Button>
            <Plus size={15} />
            {t("dashboard.emptyCta")}
          </Button>
        </Link>
        <Button variant="secondary" onClick={() => void actions.loadSample()}>
          {t("data.loadSample")}
        </Button>
      </div>
    </Panel>
  );
}
