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

export function IncomeExpenseLine({ rows }: { rows: MonthlyHistoryRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--color-faint-foreground)", fontFamily: "var(--font-mono)" }}
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
          }}
          formatter={(v, name) => {
            const label = name === "income" ? "Entrou" : name === "expense" ? "Saiu" : "Sobra";
            return [formatMoneyCompact(Number(v)), label];
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
          dot={{ r: 3, fill: "var(--color-olive-600)" }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="expense"
          stroke="var(--color-rust-600)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-rust-600)" }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke="var(--color-navy-700)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          dot={{ r: 2.5, fill: "var(--color-navy-700)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
