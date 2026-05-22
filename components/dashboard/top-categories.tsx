import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { CategoryBreakdownRow } from "@/services/transactions";

export function TopCategoriesPanel({
  rows,
  monthLabel,
  isForecast = false,
}: {
  rows: CategoryBreakdownRow[];
  monthLabel: string;
  isForecast?: boolean;
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
            <CategoryRow key={row.category_id ?? "uncat"} row={row} maxPct={top[0]?.pct ?? 1} highlight={idx === 0} />
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
}: {
  row: CategoryBreakdownRow;
  maxPct: number;
  highlight?: boolean;
}) {
  const widthPct = maxPct > 0 ? (row.pct / maxPct) * 100 : 0;
  return (
    <div className="grid grid-cols-[1fr_88px_56px] gap-4 items-center py-3 border-b border-border last:border-b-0">
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
      <div className="font-mono text-[13px] font-medium text-right">
        <MoneyMask>{formatMoney(row.total)}</MoneyMask>
      </div>
      <div className="font-mono text-[11px] text-faint-foreground text-right">
        {(row.pct * 100).toFixed(0)}%
      </div>
    </div>
  );
}
