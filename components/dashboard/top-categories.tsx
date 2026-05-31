import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { Sparkline } from "@/components/ui/sparkline";
import type { CategoryBreakdownRow } from "@/services/transactions";

export function TopCategoriesPanel({
  rows,
  monthLabel,
  isForecast = false,
  spendHistory,
}: {
  rows: CategoryBreakdownRow[];
  monthLabel: string;
  isForecast?: boolean;
  /** Map category_id → últimos N meses de gasto (mais antigo → recente). */
  spendHistory?: Map<string, number[]>;
}) {
  const top = rows.slice(0, 6);
  return (
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            Top categorias
            {isForecast ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-gold-600/15 text-gold-700 dark:text-gold-500 text-[9.5px] font-mono tracking-[0.12em] uppercase">
                Previsão
              </span>
            ) : null}
          </span>
        }
        meta={monthLabel.toUpperCase().slice(0, 3) + " · " + monthLabel.split(" ").pop()}
        action={
          rows.length > 6 ? (
            <Link
              href="/analise"
              className="text-navy-700 dark:text-navy-300 text-[12.5px] hover:text-navy-900 dark:hover:text-navy-100"
            >
              ver todas ({rows.length}) →
            </Link>
          ) : (
            <Link
              href="/analise"
              className="text-navy-700 dark:text-navy-300 text-[12.5px] hover:text-navy-900 dark:hover:text-navy-100"
            >
              análise →
            </Link>
          )
        }
      />
      {top.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic py-2">
          {isForecast
            ? "Nenhuma despesa prevista das recorrências."
            : "Sem despesas registradas ainda esse mês."}
        </p>
      ) : (
        <div>
          {top.map((row, idx) => (
            <CategoryRow
              key={row.category_id ?? "uncat"}
              row={row}
              maxPct={top[0]?.pct ?? 1}
              highlight={idx === 0}
              spark={spendHistory?.get(row.category_id ?? "uncategorized")}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function CategoryRow({
  row,
  maxPct,
  highlight,
  spark,
}: {
  row: CategoryBreakdownRow;
  maxPct: number;
  highlight?: boolean;
  spark?: number[];
}) {
  const widthPct = maxPct > 0 ? (row.pct / maxPct) * 100 : 0;
  // Tendência: último mês vs média dos meses anteriores (excluindo o último)
  let trendTone: "neutral" | "up" | "down" = "neutral";
  if (spark && spark.length >= 3) {
    const last = spark[spark.length - 1];
    const prior = spark.slice(0, -1);
    const avg = prior.reduce((s, v) => s + v, 0) / prior.length;
    if (avg > 0) {
      const delta = (last - avg) / avg;
      if (delta > 0.1) trendTone = "up";
      else if (delta < -0.1) trendTone = "down";
    }
  }
  const sparkColor =
    trendTone === "up"
      ? "var(--color-rust-600)"
      : trendTone === "down"
        ? "var(--color-olive-600)"
        : "var(--color-faint-foreground)";
  return (
    <div className="grid grid-cols-[1fr_56px_88px_56px] gap-3 items-center py-3 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-foreground tracking-[-0.005em] mb-1.5 truncate">
          {row.category_name}
        </div>
        <div className="h-[3px] bg-surface-muted rounded-full overflow-hidden">
          <div
            className={highlight ? "h-full bg-navy-800 rounded-full" : "h-full bg-navy-600 rounded-full"}
            style={{ width: `${widthPct}%` }}
          />
        </div>
      </div>
      <div className="h-[28px] flex items-center justify-end">
        {spark && spark.length >= 2 ? (
          <Sparkline
            data={spark}
            width={56}
            height={20}
            stroke={sparkColor}
            fill={sparkColor}
            strokeWidth={1.25}
            showDot={false}
          />
        ) : null}
      </div>
      <div className="font-mono text-[13px] font-medium text-right">
        <MoneyMask>{formatMoney(row.total)}</MoneyMask>
      </div>
      <div className="font-mono text-[11px] text-faint-foreground text-right">
        {(row.pct * 100).toFixed(0)}%
      </div>
    </div>
  );
}
