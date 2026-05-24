"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrajectoryPoint } from "@/lib/financial/fire";

export function FireTrajectoryChart({
  points,
  targetNetWorth,
  currentAge,
}: {
  points: TrajectoryPoint[];
  targetNetWorth: number;
  currentAge?: number;
}) {
  // Reduz amostragem pra performance — pega cada 3 meses se > 100 pontos
  const sampled = points.length > 100
    ? points.filter((_, i) => i % 3 === 0 || i === points.length - 1)
    : points;

  // Tick label: anos ou idade
  const xKey: keyof TrajectoryPoint = "month";

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sampled} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="gradFire" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-olive-600)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-olive-600)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
          <XAxis
            dataKey={xKey}
            stroke="var(--color-faint-foreground)"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            tickFormatter={(m: number) => {
              if (currentAge != null) {
                return `${Math.round(currentAge + m / 12)}a`;
              }
              return `${Math.round(m / 12)}a`;
            }}
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
              fontSize: 12,
            }}
            labelFormatter={((m: number) =>
              currentAge != null
                ? `${(currentAge + m / 12).toFixed(1)} anos`
                : `${(m / 12).toFixed(1)} anos a partir de hoje`) as unknown as (label: React.ReactNode) => React.ReactNode}
            formatter={((v: number) => [
              new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v),
              "Patrimônio",
            ]) as unknown as (value: unknown) => [string, string]}
          />
          <ReferenceLine
            y={targetNetWorth}
            stroke="var(--color-rust-600)"
            strokeDasharray="4 4"
            label={{
              value: "Target FIRE",
              position: "insideTopRight",
              fill: "var(--color-rust-600)",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="var(--color-olive-600)"
            strokeWidth={2}
            fill="url(#gradFire)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
