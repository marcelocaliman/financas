"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyCompact } from "@/lib/utils/format";
import type { ProjectionPoint } from "@/lib/financial/projection";

export function ProjectionChart({ points }: { points: ProjectionPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="proj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: "var(--color-faint-foreground)", fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          ticks={[0, 12, 24, 36, 48, 60]}
          tickFormatter={(v) => (v === 0 ? "hoje" : `+${Math.round(Number(v) / 12)}a`)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-faint-foreground)", fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatMoneyCompact(Number(v)).replace("R$", "").trim()}
          width={56}
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
          formatter={(v) => [formatMoneyCompact(Number(v)), "Patrimônio"]}
          labelFormatter={(m) => `+${m} meses`}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--color-navy-800)"
          strokeWidth={2}
          fill="url(#proj-area)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
