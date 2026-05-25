"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatMoneyCompact } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

type Row = {
  month: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

export function IncomeVsExpenseChart({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return null;
  }

  const lastNet = data[data.length - 1]?.net ?? 0;
  const avgNet =
    data.reduce((s, r) => s + r.net, 0) / data.length;

  return (
    <Panel>
      <PanelHeader
        title="Receitas vs despesas"
        meta={`Últimos ${data.length} meses`}
      />
      <div className="flex items-baseline gap-4 mb-3 text-[11.5px] font-mono text-faint-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-olive-600 inline-block" />
          Receita
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-rust-600 inline-block" />
          Despesa
        </span>
        <span className="ml-auto text-faint-foreground">
          Sobra média:{" "}
          <span className="text-foreground tabular-nums">
            <MoneyMask>{formatMoneyCompact(avgNet)}</MoneyMask>
          </span>
        </span>
      </div>
      <div className="w-full h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="2 4"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--color-faint-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-faint-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={
                ((v: number) => formatMoneyCompact(v)) as unknown as (
                  v: unknown,
                ) => string
              }
            />
            <Tooltip
              cursor={{ fill: "var(--color-surface-muted)", opacity: 0.35 }}
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              itemStyle={{ color: "var(--color-foreground)" }}
              labelStyle={{ color: "var(--color-muted-foreground)" }}
              labelFormatter={
                ((label: string, payload: readonly { payload?: Row }[]) => {
                  const p = payload?.[0]?.payload;
                  return p?.month ? `${label} · ${p.month}` : label;
                }) as unknown as (
                  label: unknown,
                  payload: readonly unknown[],
                ) => string
              }
              formatter={
                ((v: number, name: string) => [
                  formatMoneyCompact(v),
                  name === "income" ? "Receita" : "Despesa",
                ]) as unknown as (value: unknown, name: unknown) => [string, string]
              }
            />
            <Bar
              dataKey="income"
              fill="var(--color-olive-600)"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="expense"
              fill="var(--color-rust-600)"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 pt-3 border-t border-border text-[11.5px] text-muted-foreground flex items-center justify-between flex-wrap gap-2">
        <span>
          Sobra do último mês:{" "}
          <span
            className={
              "font-mono tabular-nums " +
              (lastNet >= 0 ? "text-olive-600" : "text-rust-600")
            }
          >
            <MoneyMask>{formatMoneyCompact(lastNet)}</MoneyMask>
          </span>
        </span>
        {data.length >= 2 ? (
          (() => {
            const prevNet = data[data.length - 2]?.net ?? 0;
            const diff = lastNet - prevNet;
            const pct = prevNet !== 0 ? (diff / Math.abs(prevNet)) * 100 : 0;
            if (Math.abs(diff) < 0.01) return null;
            const positive = diff > 0;
            return (
              <span className="font-mono text-[11px] tracking-[0.02em]">
                <span className="text-faint-foreground">vs mês anterior:</span>{" "}
                <span
                  className={
                    "tabular-nums " +
                    (positive ? "text-olive-600" : "text-rust-600")
                  }
                >
                  {positive ? "+" : ""}
                  <MoneyMask>{formatMoneyCompact(diff)}</MoneyMask>
                  {prevNet !== 0
                    ? ` (${positive ? "+" : ""}${pct.toFixed(0)}%)`
                    : ""}
                </span>
              </span>
            );
          })()
        ) : null}
      </div>
    </Panel>
  );
}
