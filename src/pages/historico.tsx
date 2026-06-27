import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useHistorico } from "@/hooks/use-historico";
import { useBudget } from "@/hooks/use-budget";
import { goToSection } from "@/hooks/use-scroll-spy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { budgetSaldoForMonth } from "@/finance/budget-saldo";
import type { NetWorthSnapshot } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { Hidden } from "@/components/common/hidden";
import { Kpi } from "@/components/common/kpi";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

const LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };
/** "AAAA-MM" → "mmm/aa" no idioma corrente (rótulos discretos do eixo). */
function shortMonth(ym: string, lang: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE[lang] ?? "pt-BR", { month: "short", year: "2-digit" });
}

export default function Historico() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const theme = useUI((s) => s.theme);
  const rates = useRates((s) => s.rates);
  const data = useHistorico();
  const budget = useBudget();
  const accent = theme === "dark" ? "#3ecf8e" : "#15976a";

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
    const series = sorted.map((s) => ({ m: s.month, v: conv(s.amount, s.currency), label: shortMonth(s.month, lang) }));
    const first = series[0];
    const last = series.at(-1);
    const current = last?.v ?? 0;
    const growth = first && last ? last.v - first.v : 0;
    const change = first && last && first.v !== 0 ? (growth / first.v) * 100 : 0;
    // Aporte do 1º mês NÃO entra: ele é o ponto de partida (o crescimento é medido A PARTIR dele).
    const contributions = sorted.slice(1).reduce((s, x) => s + conv(x.contribution ?? 0, x.currency), 0);
    // Rendimento = crescimento que NÃO veio de aporte (o "trabalho do dinheiro").
    const yieldGain = growth - contributions;
    const hasTrend = series.length >= 2;
    // "Não reconciliado": você poupou (aporte > 0) MAIS do que o patrimônio capturado cresceu.
    // Aí o rendimento negativo seria só o aporte que ainda não apareceu nos ativos — não uma
    // perda de mercado. Não dá pra separar aporte de rendimento com honestidade; sinalizamos.
    const unreconciled = hasTrend && contributions > 0.5 && contributions > growth + 0.5;
    // Sobra que você poupou mas que ainda não apareceu no patrimônio (a "aplicar"/registrar).
    const unreflected = unreconciled ? contributions - growth : 0;
    return { sorted, series, current, growth, change, contributions, yieldGain, months: series.length, first, last, hasTrend, unreconciled, unreflected };
  }, [data, disp, rates, lang]);

  if (!data || !view) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);

  // Histórico é passado/presente: o seletor de mês não deixa escolher mês futuro.
  const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const cols: GridColumn<NetWorthSnapshot>[] = [
    { key: "month", type: "month", header: t("historico.month"), width: "minmax(120px,1fr)", maxMonth: thisMonth },
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

  const up = view.change >= 0;
  const yieldUp = view.yieldGain >= 0;
  return (
    <div className="space-y-7">
      {/* Indicadores da evolução: atual · crescimento · aporte vs rendimento · período */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label={t("historico.current")} value={<Money value={view.current} currency={disp} />} sub={view.last?.label} />
        <Kpi
          label={t("historico.growth")}
          value={<Money value={view.growth} currency={disp} options={{ signDisplay: "always" }} />}
          tone={up ? "accent" : "neg"}
          sub={view.hasTrend ? <Hidden>{`${up ? "+" : ""}${view.change.toFixed(1)}%`}</Hidden> : "—"}
        />
        <Kpi label={t("historico.contributions")} value={view.hasTrend ? <Money value={view.contributions} currency={disp} /> : "—"} sub={t("historico.contributionsSub")} />
        <Kpi
          // Não reconciliado: o card vira "A aplicar" e mostra a SOBRA que ficou de fora do
          // patrimônio (acionável: aplicar/registrar), em vez de um "rendimento" vermelho enganoso.
          label={view.unreconciled ? t("historico.unapplied") : t("historico.return")}
          value={
            view.unreconciled ? (
              <Money value={view.unreflected} currency={disp} />
            ) : view.hasTrend ? (
              <Money value={view.yieldGain} currency={disp} options={{ signDisplay: "always" }} />
            ) : (
              "—"
            )
          }
          tone={view.unreconciled ? "text" : yieldUp ? "accent" : "neg"}
          sub={view.unreconciled ? t("historico.unappliedSub") : t("historico.returnSub")}
          title={view.unreconciled ? t("historico.reconcileHint") : undefined}
          // Atalho: leva ao Patrimônio pra registrar/aplicar a sobra que ficou de fora.
          onClick={view.unreconciled ? () => goToSection("patrimonio") : undefined}
        />
        <Kpi label={t("historico.period")} value={t("historico.monthsValue", { n: view.months })} sub={view.first && view.last ? `${view.first.label} → ${view.last.label}` : "—"} />
      </div>

      {view.hasTrend ? (
        <Tile className="p-6 md:p-7">
          <Eyebrow className="mb-4">{t("dashboard.netWorthTrend")}</Eyebrow>
          <div className="w-full h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.series} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10.5, fill: "var(--faint)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  formatter={(v) => formatMoney(Number(v), disp)}
                  labelFormatter={(_l, p) => (p && p[0] ? p[0].payload.label : "")}
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
              onCommit={(r) => {
                const next: NetWorthSnapshot = { ...r, auto: false };
                // Ponte com o orçamento: aporte em branco → sugere o saldo do mês — mas só se houver
                // um mês ANTERIOR (o aporte decompõe o crescimento; no 1º mês não faz sentido).
                if (next.contribution == null && data.some((s) => s.id !== next.id && s.month < next.month)) {
                  const saldo = budgetSaldoForMonth(next.month, budget, next.currency, rates);
                  if (saldo != null) next.contribution = saldo;
                }
                void actions.putSnapshot(next);
              }}
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
    // Aporte do 1º mês NÃO entra: ele é o ponto de partida (o crescimento é medido A PARTIR dele).
    const contributions = sorted.slice(1).reduce((s, x) => s + conv(x.contribution ?? 0, x.currency), 0);
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
