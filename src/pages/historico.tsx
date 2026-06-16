import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useHistorico } from "@/hooks/use-historico";
import { actions } from "@/data/actions";
import { convert, formatMoney, type Currency } from "@/money/currency";
import type { NetWorthSnapshot } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { StatBlock } from "@/components/common/stat-block";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";
import { cn } from "@/lib/utils";

export default function Historico() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const data = useHistorico();
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
    const series = sorted.map((s) => ({ m: s.month, v: conv(s.amount, s.currency) }));
    const first = series[0];
    const last = series.at(-1);
    const change = first && last && first.v !== 0 ? ((last.v - first.v) / first.v) * 100 : 0;
    const contributions = sorted.reduce((s, x) => s + conv(x.contribution ?? 0, x.currency), 0);
    return { sorted, series, current: last?.v ?? 0, change, contributions, hasTrend: series.length >= 2 };
  }, [data, disp, rates]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const up = view.change >= 0;

  const cols: GridColumn<NetWorthSnapshot>[] = [
    { key: "month", type: "text", header: t("historico.month"), width: "minmax(110px,1fr)", placeholder: t("historico.monthPlaceholder") },
    { key: "currency", type: "currency", header: "", width: "46px" },
    { key: "amount", type: "money", header: t("historico.networth"), width: "minmax(120px,1.2fr)", align: "right", currencyKey: "currency" },
    { key: "contribution", type: "number", header: t("historico.contribution"), width: "minmax(100px,0.9fr)", align: "right" },
    {
      key: "conv",
      type: "computed",
      header: `${t("patrimonio.in")} ${disp === "BRL" ? "R$" : disp}`,
      width: "minmax(88px,0.8fr)",
      align: "right",
      compute: (r) => formatMoney(conv(r.amount, r.currency), disp),
    },
  ];

  const newSnap = (): NetWorthSnapshot => ({ id: crypto.randomUUID(), month: "", currency: disp, amount: 0 });

  return (
    <div className="space-y-7">
      <Tile className="p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
            <StatBlock label={t("historico.current")}>
              <Money value={view.current} currency={disp} />
            </StatBlock>
            <div>
              <Eyebrow>{t("historico.totalChange")}</Eyebrow>
              <div className={cn("inline-flex items-center gap-1.5 text-[clamp(20px,2.3vw,28px)] font-numeric font-semibold tabular tracking-[-0.02em] mt-1.5", up ? "text-accent" : "text-neg")}>
                {up ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
                {(up ? "+" : "") + view.change.toFixed(1)}%
              </div>
            </div>
            <StatBlock label={t("historico.contributions")}>
              <Money value={view.contributions} currency={disp} />
            </StatBlock>
          </div>
        </div>
        {view.hasTrend ? (
          <div className="w-full h-[200px] mt-6 pt-6 border-t border-border">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.series} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  formatter={(v) => formatMoney(Number(v), disp)}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
                  labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
                />
                <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill="url(#histGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Tile>

      <section>
        <SectionHead title={t("historico.snapshots")} count={data.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <DataGrid<NetWorthSnapshot>
              columns={cols}
              rows={view.sorted}
              blank={newSnap}
              isComplete={(r) => r.month.trim().length > 0 && r.amount > 0}
              onCommit={(r) => void actions.putSnapshot(r)}
              onDelete={(id) => void actions.removeSnapshot(id)}
              addPlaceholder={t("historico.addSnapshot")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
