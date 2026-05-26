"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoneyCompact } from "@/lib/utils/format";
import type { MonthlyHistoryRow } from "@/services/transactions";

/**
 * Dot custom que diferencia visualmente os meses que vêm de previsão:
 * forecast = círculo vazado (apenas borda), real = preenchido.
 */
function makeDot(color: string) {
  return function ForecastAwareDot(props: {
    cx?: number;
    cy?: number;
    payload?: MonthlyHistoryRow;
  }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return <g />;
    const isForecast = !!payload?.isForecast;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isForecast ? 3.5 : 3}
        fill={isForecast ? "var(--color-surface)" : color}
        stroke={color}
        strokeWidth={isForecast ? 1.5 : 0}
      />
    );
  };
}

export function IncomeExpenseLine({ rows }: { rows: MonthlyHistoryRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tick={((p: any) => {
            const idx = (p?.index ?? 0) as number;
            const row = rows[idx];
            const x = Number(p?.x ?? 0);
            const y = Number(p?.y ?? 0);
            return (
              <text
                x={x}
                y={y + 12}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-faint-foreground)"
                fontFamily="var(--font-mono)"
                fontStyle={row?.isForecast ? "italic" : "normal"}
              >
                {row?.label ?? ""}
                {row?.isForecast ? "*" : ""}
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
          width={50}
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
          formatter={(v, name) => {
            const label = name === "income" ? "Entrou" : name === "expense" ? "Saiu" : "Sobra";
            return [formatMoneyCompact(Number(v)), label];
          }}
          labelFormatter={(label, items) => {
            const item = items?.[0]?.payload as MonthlyHistoryRow | undefined;
            return `${label}${item?.isForecast ? " · previsão" : ""}`;
          }}
        />
        <Legend
          iconType="line"
          wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)", paddingTop: 8 }}
          formatter={(v) => (v === "income" ? "Entrou" : v === "expense" ? "Saiu" : "Sobra")}
        />
        <Line
          type="monotone"
          dataKey="income"
          stroke="var(--color-olive-600)"
          strokeWidth={2}
          dot={makeDot("var(--color-olive-600)")}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="expense"
          stroke="var(--color-rust-600)"
          strokeWidth={2}
          dot={makeDot("var(--color-rust-600)")}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke="var(--color-navy-700)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          dot={makeDot("var(--color-navy-700)")}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
