import Link from "next/link";
import { Star } from "lucide-react";

export type RecurrenceView = "all" | "income" | "expense" | "transfer" | "subscriptions";

export const VALID_VIEWS: RecurrenceView[] = [
  "all",
  "income",
  "expense",
  "transfer",
  "subscriptions",
];

/**
 * Pills de filtro pra /recorrentes. Cada pill é um Link que muda
 * `?view=...`. Pill ativa fica destacada.
 *
 * "Assinaturas" tem ícone próprio pra deixar claro que é uma lente
 * especial (sub-categoria visual), não um filtro normal por tipo.
 */
export function ViewPills({
  view,
  counts,
}: {
  view: RecurrenceView;
  counts: {
    all: number;
    income: number;
    expense: number;
    transfer: number;
    subscriptions: number;
  };
}) {
  const items: Array<{
    value: RecurrenceView;
    label: string;
    count: number;
    icon?: React.ReactNode;
  }> = [
    { value: "all", label: "Todas", count: counts.all },
    { value: "income", label: "Receitas", count: counts.income },
    { value: "expense", label: "Despesas", count: counts.expense },
    { value: "transfer", label: "Transferências", count: counts.transfer },
    {
      value: "subscriptions",
      label: "Assinaturas",
      count: counts.subscriptions,
      icon: <Star className="w-3 h-3 fill-current" strokeWidth={0} />,
    },
  ];

  return (
    <div className="flex items-center gap-1.5 mb-6 overflow-x-auto -mx-1 px-1 pb-1">
      {items.map((it) => {
        const isActive = it.value === view;
        const isSubscription = it.value === "subscriptions";
        const href = it.value === "all" ? "/recorrentes" : `/recorrentes?view=${it.value}`;
        return (
          <Link
            key={it.value}
            href={href}
            className={
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12.5px] font-medium transition-colors " +
              (isActive
                ? isSubscription
                  ? "bg-gold-100 dark:bg-gold-900/30 border-gold-600/50 text-gold-700 dark:text-gold-200"
                  : "bg-ink-950 dark:bg-bone-100 text-white dark:text-ink-950 border-ink-950 dark:border-bone-100"
                : isSubscription
                  ? "bg-surface border-gold-600/30 text-gold-700 dark:text-gold-300 hover:bg-gold-50/40 dark:hover:bg-gold-900/15"
                  : "bg-surface border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground")
            }
          >
            {it.icon}
            <span>{it.label}</span>
            <span
              className={
                "font-mono text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full " +
                (isActive
                  ? isSubscription
                    ? "bg-gold-600/20 text-gold-700 dark:text-gold-200"
                    : "bg-white/15 dark:bg-ink-950/15"
                  : "bg-surface-muted text-faint-foreground")
              }
            >
              {it.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
