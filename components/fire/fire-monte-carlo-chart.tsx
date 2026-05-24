"use client";

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonteCarloPoint } from "@/lib/financial/fire";

export function FireMonteCarloChart({
  points,
  targetNetWorth,
}: {
  points: MonteCarloPoint[];
  targetNetWorth: number;
}) {
  // Reduz amostragem pra performance
  const sampled =
    points.length > 100
      ? points.filter((_, i) => i % 3 === 0 || i === points.length - 1)
      : points;

  // Pra usar Area como banda, calculamos p10-base + (p90-p10) como altura
  const enriched = sampled.map((p) => ({
    month: p.month,
    p10: p.p10,
    p50: p.p50,
    p90: p.p90,
    band: [p.p10, p.p90] as [number, number], // pra area p10→p90
  }));

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={enriched} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="gradMC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="month"
            stroke="var(--color-faint-foreground)"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            tickFormatter={(m: number) => `${Math.round(m / 12)}a`}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            stroke="var(--color-faint-foreground)"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1000
                  ? `${Math.round(v / 1000)}k`
                  : String(Math.round(v))
            }
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelFormatter={((m: number) => `${(m / 12).toFixed(1)} anos`) as unknown as (label: React.ReactNode) => React.ReactNode}
            formatter={((v: number, name: string) => {
              const formatted = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              }).format(v);
              const labelMap: Record<string, string> = {
                p10: "Pessimista (10%)",
                p50: "Mediana",
                p90: "Otimista (90%)",
              };
              return [formatted, labelMap[name] ?? name];
            }) as unknown as (value: unknown, name: unknown) => [string, string]}
          />
          <ReferenceLine
            y={targetNetWorth}
            stroke="var(--color-rust-600)"
            strokeDasharray="4 4"
            label={{
              value: "Target",
              position: "insideTopRight",
              fill: "var(--color-rust-600)",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          />
          {/* Área banda p10→p90 */}
          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="url(#gradMC)"
            connectNulls
          />
          {/* Linha do mediana */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke="var(--color-navy-700)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
