import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
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
import { convert, formatMoney, type Currency } from "@/money/currency";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Panel } from "@/components/common/panel";
import { StatCard } from "@/components/common/stat-card";
import { Money } from "@/components/common/money";
import { CurrencyBadge } from "@/components/common/currency-badge";

const CAT_COLORS = ["#2C7A7B", "#5B7B9A", "#7FB2B2", "#9FB3C8", "#C5D2DD", "#E2E8EE"];
const TEAL = "#2C7A7B";
const EUR = "#5B7B9A";

export default function Painel() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const { data } = useDashboardData();

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (amount: number, from: Currency) => convert(amount, from, disp);

    const assetsDisp = data.assets.map((a) => ({ ...a, disp: conv(a.amount, a.currency) }));
    const totalNW = assetsDisp.reduce((s, a) => s + a.disp, 0);
    const brlOrigin = data.assets
      .filter((a) => a.currency === "BRL")
      .reduce((s, a) => s + conv(a.amount, "BRL"), 0);
    const brlPct = totalNW > 0 ? Math.round((brlOrigin / totalNW) * 100) : 0;
    const eurPct = 100 - brlPct;
    const invested = data.assets
      .filter((a) => a.type === "investment")
      .reduce((s, a) => s + conv(a.amount, a.currency), 0);

    const expDisp = data.expenses.map((e) => ({ name: e.name, value: conv(e.amount, e.currency) }));
    const totalExp = expDisp.reduce((s, e) => s + e.value, 0);
    const totalInc = data.incomes.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const saldoMes = totalInc - totalExp;

    const trend = data.snapshots.map((s) => ({ m: s.month, v: conv(s.amount, s.currency) }));
    const last = data.snapshots.at(-1);
    const prev = data.snapshots.at(-2);
    const nwChange = last && prev && prev.amount !== 0
      ? ((last.amount - prev.amount) / prev.amount) * 100
      : 0;

    return { assetsDisp, totalNW, brlPct, eurPct, invested, expDisp, totalExp, totalInc, saldoMes, trend, nwChange };
  }, [data, disp]);

  if (!view) {
    return <div className="h-40 rounded-2xl bg-card border border-border animate-pulse" />;
  }

  const money = (v: number) => formatMoney(v, disp);

  return (
    <div className="space-y-5">
      {/* Hero: patrimônio líquido + split de moeda */}
      <Panel className="p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[13px] text-muted font-medium">{t("dashboard.netWorth")}</div>
            <Money
              value={view.totalNW}
              currency={disp}
              className="block text-[40px] font-bold tracking-[-0.02em] leading-tight mt-1"
            />
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-soft text-teal text-[13px] font-semibold">
            <ArrowUpRight size={15} />
            <span className="tabular-nums">
              +{t("dashboard.monthChange", { value: view.nwChange.toFixed(1) })}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex rounded-full overflow-hidden h-[10px] bg-border">
            <div style={{ width: `${view.brlPct}%`, background: TEAL }} />
            <div style={{ width: `${view.eurPct}%`, background: EUR }} />
          </div>
          <div className="flex items-center gap-5 mt-3 text-[13px]">
            <Legend color={TEAL} label={t("dashboard.real")} pct={view.brlPct} />
            <Legend color={EUR} label={t("dashboard.euro")} pct={view.eurPct} />
          </div>
        </div>
      </Panel>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("dashboard.assets")}
          value={money(view.totalNW)}
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
          sub={t("dashboard.sources", { count: view.totalInc > 0 ? 2 : 0 })}
          positive
        />
        <StatCard
          label={t("dashboard.monthlyBalance")}
          value={money(view.saldoMes)}
          sub={t("common.sampleMonth")}
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
                    {view.expDisp.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {view.expDisp.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-[13px]">
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
            <span className="text-[13px] text-teal font-semibold tabular-nums">
              +{view.nwChange.toFixed(1)}%
            </span>
          </div>
          <div className="text-[12px] text-faint mb-3">
            {t("dashboard.last6months")} · {disp === "BRL" ? "R$" : "€"}
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
                borderBottom:
                  i < view.assetsDisp.length - 1 ? "1px solid var(--border)" : "none",
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

function Legend({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}
