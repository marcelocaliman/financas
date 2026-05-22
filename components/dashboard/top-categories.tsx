import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatMoney } from "@/lib/utils/format";
import type { CategoryBreakdownRow } from "@/services/transactions";

export function TopCategoriesPanel({
  rows,
  monthLabel,
}: {
  rows: CategoryBreakdownRow[];
  monthLabel: string;
}) {
  const top = rows.slice(0, 6);
  return (
    <Panel>
      <PanelHeader
        title="Top categorias"
        meta={monthLabel.toUpperCase().slice(0, 3) + " · " + monthLabel.split(" ").pop()}
      />
      {top.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic py-2">
          Sem despesas registradas ainda esse mês.
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
        {formatMoney(row.total)}
      </div>
      <div className="font-mono text-[11px] text-faint-foreground text-right">
        {(row.pct * 100).toFixed(0)}%
      </div>
    </div>
  );
}
