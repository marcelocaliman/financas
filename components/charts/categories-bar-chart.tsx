"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils/format";
import type { CategoryBreakdownRow } from "@/services/transactions";

export function CategoriesBarChart({ rows }: { rows: CategoryBreakdownRow[] }) {
  const data = rows.slice(0, 10).map((r) => ({
    name: r.category_name,
    total: r.total,
  }));

  if (data.length === 0) {
    return (
      <p className="text-center py-12 text-[13px] text-muted-foreground italic">
        Sem dados pra esse período.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-muted)" }}
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
          formatter={(v) => [formatMoney(Number(v)), "Total"]}
        />
        <Bar dataKey="total" radius={[0, 3, 3, 0]}>
          {data.map((_, idx) => (
            <Cell
              key={idx}
              fill={idx === 0 ? "var(--color-navy-800)" : "var(--color-navy-600)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
