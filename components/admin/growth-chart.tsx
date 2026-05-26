"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; count: number };

export function GrowthChart({
  data,
  label,
  color = "var(--color-navy-700)",
  cumulative = false,
}: {
  data: Point[];
  label: string;
  color?: string;
  cumulative?: boolean;
}) {
  // Cumulativo: acumular o count
  let cum = 0;
  const series = cumulative
    ? data.map((d) => {
        cum += d.count;
        return { ...d, value: cum };
      })
    : data.map((d) => ({ ...d, value: d.count }));

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            stroke="var(--color-faint-foreground)"
            tick={{ fontSize: 9, fontFamily: "monospace" }}
            tickFormatter={(d: string) => {
              const dt = new Date(d);
              return `${dt.getDate()}/${dt.getMonth() + 1}`;
            }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            stroke="var(--color-faint-foreground)"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--color-foreground)",
            }}
            labelStyle={{ color: "var(--color-foreground)", fontWeight: 500 }}
            itemStyle={{ color: "var(--color-foreground)" }}
            labelFormatter={
              ((d: string) =>
                new Date(d).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })) as unknown as (label: React.ReactNode) => React.ReactNode
            }
            formatter={
              ((v: number) => [v, label]) as unknown as (
                value: unknown,
                name: unknown,
              ) => [string, string]
            }
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${label})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
