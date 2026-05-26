"use client";

import { useState } from "react";
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

export function InvestmentHistoryChart({
  points,
  events = [],
}: {
  points: InvestmentHistoryPoint[];
  events?: InvestmentEvent[];
}) {
  const [mode, setMode] = useState<Mode>("total");
  const [showProjection, setShowProjection] = useState(true);
  const [showAportes, setShowAportes] = useState(false);

  if (points.length === 0) {
    return (
      <p className="text-center py-12 text-[13px] text-muted-foreground italic">
        Sem investimentos pra plotar histórico ainda.
      </p>
    );
  }

  // Filtra projeção quando toggle off
  const data = showProjection ? points : points.filter((p) => !p.isProjection);
  const todayIdx = data.findIndex((p) => p.isProjection) - 1;
  const todayPoint = todayIdx >= 0 ? data[todayIdx] : data[data.length - 1];
  const hasEstimates = data.some((p) => p.isEstimate && !p.isProjection);

  // Mapeia chave do mode pra dataKey
  const dataKey: keyof InvestmentHistoryPoint = mode;

  // Events agrupados por mês pra associar aos pontos do gráfico
  const eventByLabel = new Map<string, InvestmentEvent[]>();
  for (const ev of events) {
    const ym = ev.date.slice(0, 7);
    const matchingPoint = data.find((p) => p.date.slice(0, 7) === ym && !p.isProjection);
    if (matchingPoint) {
      const list = eventByLabel.get(matchingPoint.label) ?? [];
      list.push(ev);
      eventByLabel.set(matchingPoint.label, list);
    }
  }

  return (
    <div>
      {/* Toggle de modo */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
          Projeção futura
        </label>
        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showAportes}
            onChange={(e) => setShowAportes(e.target.checked)}
            className="accent-navy-700"
          />
          Aportes acumulados
        </label>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="invHist-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-olive-600)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-olive-600)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="invHist-area-proj" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-olive-600)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--color-olive-600)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tick={((p: any) => {
              const idx = (p?.index ?? 0) as number;
              const point = data[idx];
              const isFuture = point?.isProjection;
              const x = Number(p?.x ?? 0);
              const y = Number(p?.y ?? 0);
              // Mostra label do mês + ano abreviado quando muda de ano OU é o primeiro ponto.
              // Isso desambigua "mai" 2025 vs "mai" 2026 nos eixos quando temos 12+12 = 24 pontos.
              const showYear =
                idx === 0 ||
                (idx > 0 && point?.date.slice(0, 4) !== data[idx - 1]?.date.slice(0, 4));
              const yearSuffix = showYear ? `/${point?.date.slice(2, 4)}` : "";
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
                  {String(p?.payload?.value ?? "")}{yearSuffix}
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
              ((_label: string, items: Array<{ payload?: InvestmentHistoryPoint }>) => {
                const point = items?.[0]?.payload;
                if (!point) return _label;
                const [year, monthNum] = point.date.split("-");
                const monthName = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][parseInt(monthNum, 10) - 1];
                const suffix = point.isProjection
                  ? " · projeção"
                  : point.isEstimate
                    ? " · estimativa"
                    : "";
                return `${monthName} ${year}${suffix}`;
              }) as unknown as (label: React.ReactNode) => React.ReactNode
            }
            formatter={
              ((value: number, name: string) => {
                const labelName =
                  name === "total" ? MODE_LABELS.total :
                  name === "stocks" ? MODE_LABELS.stocks :
                  name === "fixedIncome" ? MODE_LABELS.fixedIncome :
                  name === "aportes" ? "Aportes acumulados" : name;
                return [formatMoney(value), labelName];
              }) as unknown as (value: unknown, name: unknown) => [string, string]
            }
          />
          {/* Curva total (verde — olive) */}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="var(--color-olive-600)"
            strokeWidth={2}
            fill="url(#invHist-area)"
            isAnimationActive={false}
            connectNulls
            strokeDasharray={undefined}
          />
          {/* Aportes acumulados (navy, sem fill) */}
          {showAportes ? (
            <Area
              type="monotone"
              dataKey="aportes"
              stroke="var(--color-navy-700)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
              isAnimationActive={false}
              dot={false}
            />
          ) : null}
          {/* Marcador no ponto "hoje" */}
          {todayPoint ? (
            <ReferenceDot
              x={todayPoint.label}
              y={Number(todayPoint[dataKey])}
              r={5}
              fill="var(--color-olive-600)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
          {/* Marcadores de eventos (buys/sells > R$ 1k) */}
          {events
            .filter((ev) => {
              const point = data.find((p) => p.date.slice(0, 7) === ev.date.slice(0, 7) && !p.isProjection);
              return point != null;
            })
            .map((ev, idx) => {
              const point = data.find((p) => p.date.slice(0, 7) === ev.date.slice(0, 7) && !p.isProjection);
              if (!point) return null;
              return (
                <ReferenceDot
                  key={`ev-${idx}`}
                  x={point.label}
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
        <p className="text-[11px] text-faint-foreground mt-2 leading-relaxed font-mono">
          ⚠ Pontos passados são parcialmente estimados — renda fixa retrocedida via Selic anual média (~13,5%), ações achatadas no último preço conhecido (brapi free só dá 3 meses de histórico). Projeção usa retorno real ~5% a.a. Atualize com datas exatas pra precisão total.
        </p>
      ) : null}
    </div>
  );
}
