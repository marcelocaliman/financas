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
import { formatMoney, formatMoneyCompact } from "@/lib/utils/format";
import type { InvestmentHistoryPoint } from "@/services/investment-history";

export function InvestmentHistoryChart({ points }: { points: InvestmentHistoryPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-center py-12 text-[13px] text-muted-foreground italic">
        Sem investimentos pra plotar histórico ainda.
      </p>
    );
  }

  const lastReal = [...points].reverse().find((p) => !p.isEstimate);
  const hasEstimates = points.some((p) => p.isEstimate);

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={points} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="invHist-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            formatter={
              ((value: number, name: string, item: { payload?: InvestmentHistoryPoint }) => {
                const point = item.payload;
                const label = name === "total" ? "Total" : "—";
                const suffix = point?.isEstimate ? " · est" : "";
                return [`${formatMoney(value)}${suffix}`, label];
              }) as unknown as (value: unknown, name: unknown) => [string, string]
            }
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--color-navy-800)"
            strokeWidth={2}
            fill="url(#invHist-area)"
          />
        </AreaChart>
      </ResponsiveContainer>
      {hasEstimates ? (
        <p className="text-[11px] text-faint-foreground mt-2 leading-relaxed font-mono">
          ⚠ Pontos antes de {lastReal?.label ?? "agora"} são estimativas — renda fixa retrocedida via Selic anual média (~13,5%), ações achatadas no último preço conhecido (brapi free só dá 3 meses de histórico). Atualizando com datas/aportes exatos depois fica preciso.
        </p>
      ) : null}
    </div>
  );
}
