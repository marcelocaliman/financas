"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  runMonteCarlo,
  type AssetProjectionParams,
  type Indexers,
} from "@/lib/financial/investment-projection";
import type {
  InvestmentEvent,
  InvestmentHistoryPoint,
} from "@/services/investment-history";

type Mode = "total" | "stocks" | "fixedIncome";

const MODE_LABELS: Record<Mode, string> = {
  total: "Total",
  stocks: "Ações/FIIs",
  fixedIncome: "Renda fixa",
};

const MONTHLY_PRESETS = [0, 500, 1000, 2500, 5000, 10000];

function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

function monthLabel(m: number): string {
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][m - 1];
}

/**
 * Row do chart — combina passado + projeção Monte Carlo num único dataset.
 *   realValue: linha sólida (passado)
 *   projP50: linha tracejada (mediana da projeção)
 *   projP10/projP90: cone de incerteza
 */
type ChartRow = InvestmentHistoryPoint & {
  realValue: number | null;
  projP50: number | null;
  projP10: number | null;
  projP90: number | null;
  /** [p10, p90] como tupla pra Area renderizar a banda */
  projBand: [number, number] | null;
  aportesValue: number;
};

export function InvestmentHistoryChart({
  points,
  events = [],
  projectionParams,
  monthsFuture,
  todayDate,
  initialPortfolioBRL,
}: {
  points: InvestmentHistoryPoint[];
  events?: InvestmentEvent[];
  projectionParams: AssetProjectionParams[];
  /** Indexadores correntes (selic, cdi, ipca) — exibidos em tooltip futuro */
  indexers?: Indexers;
  monthsFuture: number;
  todayDate: string;
  initialPortfolioBRL: number;
}) {
  const [mode, setMode] = useState<Mode>("total");
  const [showProjection, setShowProjection] = useState(true);
  const [showAportes, setShowAportes] = useState(false);
  const [monthlyContribution, setMonthlyContribution] = useState(0);

  // ─── Filtra params pro modo ativo ───
  // Pra "total": usa todos os ativos + aporte cheio.
  // Pra "stocks"/"fixedIncome": usa só os do bucket + aporte proporcional ao peso.
  const projectionForMode = useMemo(() => {
    if (mode === "total") {
      return { assets: projectionParams, contribution: monthlyContribution };
    }
    // Recupera o asset_type via prefix do id... mas não temos no params.
    // Solução: o filtro precisa do asset_type. Vou expor via projectionParams
    // já carregando isMarket — mas isso não distingue stocks vs other.
    // Por enquanto: usa isMarket=true como proxy pra "stocks/FIIs" e
    // isMarket=false como "fixedIncome+other".
    const filtered = projectionParams.filter((p) => {
      if (mode === "stocks") return p.isMarket;
      return !p.isMarket;
    });
    // Aporte proporcional ao peso desse bucket no portfólio total
    const bucketBalance = filtered.reduce((s, a) => s + a.initialBalance, 0);
    const totalBalance = projectionParams.reduce((s, a) => s + a.initialBalance, 0);
    const contribShare = totalBalance > 0 ? bucketBalance / totalBalance : 0;
    return { assets: filtered, contribution: monthlyContribution * contribShare };
  }, [mode, projectionParams, monthlyContribution]);

  // ─── Monte Carlo (rerun quando mode/contribution mudam) ───
  const monteCarlo = useMemo(() => {
    if (projectionForMode.assets.length === 0 || monthsFuture === 0) return [];
    return runMonteCarlo({
      assets: projectionForMode.assets,
      monthsForward: monthsFuture,
      monthlyContribution: projectionForMode.contribution,
      todayDate,
      trials: 500,
    });
  }, [projectionForMode, monthsFuture, todayDate]);

  if (points.length === 0) {
    return (
      <p className="text-center py-12 text-[13px] text-muted-foreground italic">
        Sem investimentos pra plotar histórico ainda.
      </p>
    );
  }

  const hasEstimates = points.some((p) => p.isEstimate);
  const dataKey: keyof InvestmentHistoryPoint = mode;

  // ─── Constrói linha do "hoje" pra bridge entre passado e projeção ───
  const todayPastPoint = points[points.length - 1];
  const todayPastValue = Number(todayPastPoint[dataKey]);

  // ─── Monta dataset combinado: passado + projeção ───
  const pastRows: ChartRow[] = points.map((p, i) => {
    const isLast = i === points.length - 1;
    return {
      ...p,
      realValue: Number(p[dataKey]),
      // O último ponto do passado vira "bridge" — começa também a linha de projeção
      projP50: isLast ? todayPastValue : null,
      projP10: isLast ? todayPastValue : null,
      projP90: isLast ? todayPastValue : null,
      projBand: isLast ? [todayPastValue, todayPastValue] : null,
      aportesValue: p.aportes,
    };
  });

  // Futuro: projeção Monte Carlo
  const futureRows: ChartRow[] = monteCarlo.map((mc) => {
    const [y, m] = mc.date.split("-").map(Number);
    return {
      date: lastDayOfMonth(y, m),
      label: monthLabel(m),
      total: mc.p50,
      stocks: mode === "stocks" ? mc.p50 : 0,
      fixedIncome: mode === "fixedIncome" ? mc.p50 : 0,
      other: 0,
      aportes: todayPastPoint.aportes + projectionForMode.contribution * mc.monthIndex,
      yield: mc.p50 - todayPastPoint.aportes,
      isEstimate: true,
      isProjection: true,
      realValue: null,
      projP50: mc.p50,
      projP10: mc.p10,
      projP90: mc.p90,
      projBand: [mc.p10, mc.p90],
      aportesValue: todayPastPoint.aportes + projectionForMode.contribution * mc.monthIndex,
    };
  });

  const chartData: ChartRow[] = showProjection ? [...pastRows, ...futureRows] : pastRows;

  // ─── Mapa label→data pra alinhar markers ───
  const allRowDates = chartData.map((r) => r.date);

  return (
    <div>
      {/* Toggle de modo */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex items-center gap-1 p-1 bg-surface-muted rounded-[8px]">
          {(["total", "stocks", "fixedIncome"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium tracking-[-0.005em] transition-colors",
                mode === m
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showProjection}
            onChange={(e) => setShowProjection(e.target.checked)}
            className="accent-olive-600"
          />
          Projeção (Monte Carlo)
        </label>
        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showAportes}
            onChange={(e) => setShowAportes(e.target.checked)}
            className="accent-rust-600"
          />
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 bg-rust-600" style={{ borderTop: "1px dashed currentColor" }} />
            Aportes acumulados
          </span>
        </label>
      </div>

      {/* Input de aporte mensal — só faz sentido com projeção ligada */}
      {showProjection ? (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 bg-surface-muted/40 rounded-[8px] border border-border/60">
          <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-faint-foreground">
            Aporte mensal
          </span>
          <div className="inline-flex items-center gap-1">
            {MONTHLY_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMonthlyContribution(v)}
                className={cn(
                  "px-2 py-0.5 rounded-[5px] text-[10.5px] font-mono tabular-nums transition-colors",
                  monthlyContribution === v
                    ? "bg-olive-600 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface",
                )}
              >
                {v === 0 ? "0" : v >= 1000 ? `${v / 1000}k` : v}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            step={100}
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 px-2 py-1 text-[12px] font-mono tabular-nums bg-surface border border-border rounded-[5px] focus:outline-none focus:ring-1 focus:ring-olive-600"
            placeholder="R$"
          />
          <span className="text-[10.5px] text-faint-foreground ml-auto">
            cone p10–p90 · 500 simulações
          </span>
        </div>
      ) : null}

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="invHist-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-olive-600)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-olive-600)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tick={((p: any) => {
              const idx = (p?.index ?? 0) as number;
              const row = chartData[idx];
              if (!row) return <g />;
              const isFuture = row.isProjection;
              const x = Number(p?.x ?? 0);
              const y = Number(p?.y ?? 0);
              const prevYear = idx > 0 ? chartData[idx - 1]?.date.slice(0, 4) : null;
              const showYear = idx === 0 || row.date.slice(0, 4) !== prevYear;
              const yearSuffix = showYear ? `/${row.date.slice(2, 4)}` : "";
              return (
                <text
                  x={x}
                  y={y + 12}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isFuture ? "var(--color-faint-foreground)" : "var(--color-muted-foreground)"}
                  fontFamily="var(--font-mono)"
                  fontStyle={isFuture ? "italic" : "normal"}
                >
                  {row.label}{yearSuffix}
                </text>
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-faint-foreground)", fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatMoneyCompact(Number(v)).replace("R$", "").trim()}
            width={56}
            domain={["dataMin - 5000", "dataMax + 5000"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: 10,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-foreground)",
            }}
            labelStyle={{ color: "var(--color-foreground)", fontWeight: 500 }}
            itemStyle={{ color: "var(--color-foreground)" }}
            labelFormatter={
              ((_label: string, items: Array<{ payload?: ChartRow }>) => {
                const row = items?.[0]?.payload;
                if (!row) return _label;
                const [year, monthNum] = row.date.split("-");
                const monthName = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][parseInt(monthNum, 10) - 1];
                const suffix = row.isProjection
                  ? " · projeção"
                  : row.isEstimate
                    ? " · estimativa"
                    : "";
                return `${monthName} ${year}${suffix}`;
              }) as unknown as (label: React.ReactNode) => React.ReactNode
            }
            formatter={
              ((value: number | [number, number] | null, name: string) => {
                if (value == null) return null;
                if (name === "projBand") {
                  const [lo, hi] = value as [number, number];
                  if (lo === hi) return null; // bridge point sem banda real
                  return [`${formatMoney(lo)} → ${formatMoney(hi)}`, "Cone p10–p90"];
                }
                if (Array.isArray(value)) return null;
                const labelName =
                  name === "realValue" ? MODE_LABELS[mode] :
                  name === "projP50" ? "Mediana projetada" :
                  name === "aportesValue" ? "Aportes acumulados" : name;
                return [formatMoney(value), labelName];
              }) as unknown as (value: unknown, name: unknown) => [string, string]
            }
          />

          {/* Cone p10-p90 (banda de incerteza) */}
          {showProjection ? (
            <Area
              type="monotone"
              dataKey="projBand"
              name="projBand"
              stroke="none"
              fill="var(--color-olive-600)"
              fillOpacity={0.12}
              isAnimationActive={false}
              connectNulls={false}
              activeDot={false}
            />
          ) : null}

          {/* Linha mediana (p50) tracejada */}
          {showProjection ? (
            <Area
              type="monotone"
              dataKey="projP50"
              name="projP50"
              stroke="var(--color-olive-600)"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="none"
              isAnimationActive={false}
              connectNulls={false}
              dot={false}
            />
          ) : null}

          {/* Curva passada (sólida, com fill) */}
          <Area
            type="monotone"
            dataKey="realValue"
            name="realValue"
            stroke="var(--color-olive-600)"
            strokeWidth={2}
            fill="url(#invHist-area)"
            isAnimationActive={false}
            connectNulls={false}
            dot={false}
          />

          {/* Aportes acumulados — rust pra contrastar com olive, traço grosso
              e dots pra ficar legível mesmo por cima do fill da área verde */}
          {showAportes ? (
            <Area
              type="monotone"
              dataKey="aportesValue"
              name="aportesValue"
              stroke="var(--color-rust-600)"
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="none"
              isAnimationActive={false}
              dot={{ r: 2.5, fill: "var(--color-rust-600)", stroke: "var(--color-surface)", strokeWidth: 1 }}
              activeDot={{ r: 4, fill: "var(--color-rust-600)", stroke: "var(--color-surface)", strokeWidth: 2 }}
            />
          ) : null}

          {/* Marcador no ponto "hoje" */}
          {todayPastPoint ? (
            <ReferenceDot
              x={todayPastPoint.date}
              y={todayPastValue}
              r={5}
              fill="var(--color-olive-600)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}

          {/* Marcadores de eventos (buys/sells > R$ 1k) */}
          {events
            .map((ev, idx) => {
              const ym = ev.date.slice(0, 7);
              const point = pastRows.find((p) => p.date.slice(0, 7) === ym);
              if (!point) return null;
              if (!allRowDates.includes(point.date)) return null;
              return (
                <ReferenceDot
                  key={`ev-${idx}`}
                  x={point.date}
                  y={Number(point[dataKey])}
                  r={3}
                  fill={ev.kind === "buy" ? "var(--color-navy-700)" : "var(--color-rust-600)"}
                  stroke="var(--color-surface)"
                  strokeWidth={1}
                />
              );
            })}
        </AreaChart>
      </ResponsiveContainer>

      {/* Resumo numérico da projeção */}
      {showProjection && monteCarlo.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/60">
          <ProjectionStat
            label={`Em ${monthsFuture}m · p10 (pessimista)`}
            value={monteCarlo[monteCarlo.length - 1].p10}
            initial={initialPortfolioBRL}
          />
          <ProjectionStat
            label={`Em ${monthsFuture}m · mediana`}
            value={monteCarlo[monteCarlo.length - 1].p50}
            initial={initialPortfolioBRL}
            highlight
          />
          <ProjectionStat
            label={`Em ${monthsFuture}m · p90 (otimista)`}
            value={monteCarlo[monteCarlo.length - 1].p90}
            initial={initialPortfolioBRL}
          />
        </div>
      ) : null}

      {/* Legenda dos marcadores */}
      {events.length > 0 ? (
        <div className="flex items-center gap-3 mt-3 text-[10.5px] font-mono text-faint-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-navy-700 inline-block" /> compra
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rust-600 inline-block" /> venda
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-olive-600 inline-block" /> hoje
          </span>
          <span className="text-faint-foreground">·</span>
          <span>
            {events.length} evento{events.length === 1 ? "" : "s"} marcado
            {events.length === 1 ? "" : "s"} (≥ R$ 1k)
          </span>
        </div>
      ) : null}

      {hasEstimates ? (
        <p className="text-[11px] text-faint-foreground mt-3 leading-relaxed font-mono">
          ⚠ Pontos passados são parcialmente estimados (renda fixa retrocedida via Selic, ações achatadas onde brapi não tem histórico). Projeção usa Monte Carlo 500 trials com retornos amostrados de N(μ, σ²) por ativo: stocks 6% nom · σ 25%, RF Selic líquida de 15% IR · σ baixa, IPCA+ marked-to-market. Vencimentos viram cash. <em className="italic">Sem reinvestimento automático de dividendos</em>.
        </p>
      ) : null}
    </div>
  );
}

function ProjectionStat({
  label,
  value,
  initial,
  highlight = false,
}: {
  label: string;
  value: number;
  initial: number;
  highlight?: boolean;
}) {
  const delta = initial > 0 ? ((value - initial) / initial) * 100 : 0;
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-faint-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono tabular-nums mt-1",
          highlight ? "text-[18px] text-foreground font-medium" : "text-[15px] text-muted-foreground",
        )}
      >
        {formatMoney(value)}
      </div>
      <div className={cn(
        "text-[10.5px] font-mono tabular-nums mt-0.5",
        delta >= 0 ? "text-olive-600" : "text-rust-600",
      )}>
        {delta >= 0 ? "+" : ""}{delta.toFixed(1).replace(".", ",")}%
      </div>
    </div>
  );
}
