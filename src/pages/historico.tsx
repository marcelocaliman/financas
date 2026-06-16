import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useHistorico } from "@/hooks/use-historico";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import type { NetWorthSnapshot } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

export default function Historico() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
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

  const cols: GridColumn<NetWorthSnapshot>[] = [
    { key: "month", type: "text", header: t("historico.month"), width: "minmax(110px,1fr)", placeholder: t("historico.monthPlaceholder") },
    { key: "amount", type: "money", header: t("historico.networth"), width: "minmax(160px,1.2fr)", align: "right", currencyKey: "currency" },
    { key: "contribution", type: "number", decimals: 2, header: t("historico.contribution"), width: "minmax(100px,0.9fr)", align: "right" },
  ];
  // "Em <moeda>" só aparece quando há de fato conversão (algum registro em moeda ≠ da exibida).
  if (view.sorted.some((s) => s.currency !== disp)) {
    cols.push({
      key: "conv",
      type: "computed",
      header: `${t("patrimonio.in")} ${CURRENCY_SYMBOL[disp]}`,
      width: "minmax(88px,0.8fr)",
      align: "right",
      compute: (r) => formatMoney(conv(r.amount, r.currency), disp),
    });
  }

  const newSnap = (): NetWorthSnapshot => ({ id: crypto.randomUUID(), month: "", currency: base, amount: 0 });

  return (
    <div className="space-y-7">
      {view.hasTrend ? (
        <Tile className="p-6 md:p-7">
          <Eyebrow className="mb-4">{t("dashboard.netWorthTrend")}</Eyebrow>
          <div className="w-full h-[210px]">
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
        </Tile>
      ) : null}

      <section>
        <SectionHead title={t("historico.snapshots")} count={data.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <DataGrid<NetWorthSnapshot>
              columns={cols}
              rows={view.sorted}
              blank={newSnap}
              isComplete={(r) => r.month.trim().length > 0 && r.amount > 0}
              onCommit={(r) => void actions.putSnapshot({ ...r, auto: false })}
              onDelete={(id) => void actions.removeSnapshot(id)}
              addPlaceholder={t("historico.addSnapshot")}
            />
          </div>
        </div>
        <p className="text-[11.5px] text-faint mt-2 px-1 leading-relaxed">{t("historico.autoHint")}</p>
      </section>
    </div>
  );
}

/** KPIs do cabeçalho do accordion de Histórico. */
export function HistoricoSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useHistorico();
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
    const series = sorted.map((s) => conv(s.amount, s.currency));
    const first = series[0];
    const last = series.at(-1) ?? 0;
    const change = first && first !== 0 ? ((last - first) / first) * 100 : 0;
    const contributions = sorted.reduce((s, x) => s + conv(x.contribution ?? 0, x.currency), 0);
    return { current: last, change, contributions };
  }, [data, disp, rates]);
  if (!v) return null;
  const up = v.change >= 0;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("historico.current")} value={<Money value={v.current} currency={disp} />} />
      <HeaderKpi
        secondary
        label={t("historico.totalChange")}
        tone={up ? "accent" : "neg"}
        value={
          <span className="inline-flex items-center gap-0.5">
            {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {(up ? "+" : "") + v.change.toFixed(1)}%
          </span>
        }
      />
      <HeaderKpi secondary label={t("historico.contributions")} value={<Money value={v.contributions} currency={disp} />} />
    </HeaderKpis>
  );
}
