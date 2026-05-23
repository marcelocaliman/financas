import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Money } from "@/components/ui/money";
import { formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { BudgetVsActual } from "@/services/budgets";
import { cn } from "@/lib/utils/cn";

/**
 * Card "Saúde dos orçamentos" — top categorias mais estouradas/próximas
 * do limite no mês corrente. Exibido no /dashboard quando há pelo menos
 * 1 categoria com budget.
 */
export function BudgetStatusCard({ rows }: { rows: BudgetVsActual[] }) {
  const withBudget = rows.filter((r) => r.status !== "no_budget");
  if (withBudget.length === 0) return null;

  const overCount = withBudget.filter((r) => r.status === "over").length;
  const warningCount = withBudget.filter((r) => r.status === "warning").length;
  // Pega top 4 mais críticas
  const top = withBudget.slice(0, 4);

  const summary =
    overCount > 0
      ? `${overCount} estourada${overCount === 1 ? "" : "s"}${warningCount > 0 ? ` · ${warningCount} no limite` : ""}`
      : warningCount > 0
        ? `${warningCount} próxima${warningCount === 1 ? "" : "s"} do limite`
        : "tudo no verde";

  return (
    <Panel className="!p-6">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            {overCount > 0 ? (
              <AlertCircle className="w-4 h-4 text-rust-600" strokeWidth={1.8} />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-olive-700 dark:text-olive-500" strokeWidth={1.8} />
            )}
            Orçamentos do mês
          </span>
        }
        meta={summary}
        action={
          <Link
            href="/analise"
            className="text-navy-700 dark:text-navy-300 text-[12.5px] hover:text-navy-900 dark:hover:text-navy-100"
          >
            Análise completa →
          </Link>
        }
      />
      <ul className="space-y-3 -mt-2">
        {top.map((r) => (
          <BudgetRow key={r.categoryId} row={r} />
        ))}
      </ul>
      {withBudget.length > top.length ? (
        <Link
          href="/analise"
          className="block mt-4 text-[12px] text-faint-foreground hover:text-navy-700 dark:text-navy-300"
        >
          + {withBudget.length - top.length} outras categorias →
        </Link>
      ) : null}
    </Panel>
  );
}

function BudgetRow({ row }: { row: BudgetVsActual }) {
  const pct = Math.min(100, Math.round(row.ratio * 100));
  const overPct = row.ratio > 1 ? Math.round((row.ratio - 1) * 100) : 0;

  const barColor =
    row.status === "over"
      ? "bg-rust-600"
      : row.status === "warning"
        ? "bg-gold-600"
        : "bg-olive-600";

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex items-center gap-2">
          {row.categoryIcon ? (
            <span
              className="font-mono text-[13px]"
              style={row.categoryColor ? { color: row.categoryColor } : undefined}
            >
              {row.categoryIcon}
            </span>
          ) : null}
          <span className="text-[13px] font-medium text-foreground truncate">
            {row.categoryName}
          </span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <Money
            value={row.actualSpent}
            currency={row.budgetCurrency}
            className="font-mono text-[12.5px] tabular-nums text-foreground inline-flex !flex-row !items-baseline"
          />
          <span className="text-faint-foreground text-[10.5px]">/</span>
          <Money
            value={row.budgetAmount}
            currency={row.budgetCurrency}
            className="font-mono text-[11.5px] tabular-nums text-muted-foreground inline-flex !flex-row !items-baseline"
          />
        </div>
      </div>
      <div className="relative h-[5px] bg-bone-100 dark:bg-ink-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-[width] duration-700 ease-out", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between mt-1 font-mono text-[10.5px] tabular-nums">
        <span
          className={cn(
            "tracking-[0.04em]",
            row.status === "over"
              ? "text-rust-600 font-medium"
              : row.status === "warning"
                ? "text-gold-700 dark:text-gold-500"
                : "text-faint-foreground",
          )}
        >
          {row.status === "over"
            ? `+${overPct}% acima`
            : `${pct}% usado`}
        </span>
        {row.vsPrevMonthRatio != null ? (
          <span
            className={
              "text-[10.5px] " +
              (row.vsPrevMonthRatio > 0.05
                ? "text-rust-600"
                : row.vsPrevMonthRatio < -0.05
                  ? "text-olive-700 dark:text-olive-500"
                  : "text-faint-foreground")
            }
          >
            {row.vsPrevMonthRatio > 0 ? "+" : ""}
            {formatPercent(row.vsPrevMonthRatio, 0)} vs mês anterior
          </span>
        ) : null}
      </div>
    </li>
  );
}

// Re-export usado implicitamente
export { MoneyMask };
