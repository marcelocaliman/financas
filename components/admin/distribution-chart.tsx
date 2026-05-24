"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { label: string; count: number };

const COLORS = [
  "var(--color-navy-700)",
  "var(--color-olive-600)",
  "var(--color-gold-600)",
  "var(--color-rust-600)",
  "var(--color-ink-500)",
];

export function DistributionChart({
  data,
}: {
  data: Slice[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const filtered = data.filter((d) => d.count > 0);

  if (total === 0 || filtered.length === 0) {
    return (
      <div className="text-[12.5px] text-muted-foreground italic h-[200px] grid place-items-center">
        Sem dados pra exibir.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="count"
              nameKey="label"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {filtered.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={
                ((v: number, name: string) => [
                  `${v} (${((v / total) * 100).toFixed(0)}%)`,
                  name,
                ]) as unknown as (value: unknown, name: unknown) => [string, string]
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-[12.5px] font-mono">
        {filtered.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-foreground">{d.label}</span>
            <span className="text-faint-foreground tabular-nums">
              {d.count} · {((d.count / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
