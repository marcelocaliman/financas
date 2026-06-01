import Link from "next/link";
import { BookText, PiggyBank } from "lucide-react";

export type CategoryView = "vocabulario" | "orcamento";

export function parseCategoryView(v?: string): CategoryView {
  return v === "orcamento" ? "orcamento" : "vocabulario";
}

/**
 * Pills de /categorias. "Vocabulário" (lista/regras de categorias) e "Orçamento"
 * (teto por categoria vs gasto real). Antes Orçamento era rota própria — agora é
 * uma lente da MESMA entidade (categoria + seu teto), via `?view=orcamento`.
 */
export function CategoryViewPills({
  view,
  counts,
}: {
  view: CategoryView;
  counts: { vocabulario: number; orcamento: number };
}) {
  const items: Array<{ value: CategoryView; label: string; count: number; icon: React.ReactNode }> = [
    { value: "vocabulario", label: "Vocabulário", count: counts.vocabulario, icon: <BookText className="w-3 h-3" strokeWidth={1.8} /> },
    { value: "orcamento", label: "Orçamento", count: counts.orcamento, icon: <PiggyBank className="w-3 h-3" strokeWidth={1.8} /> },
  ];

  return (
    <div className="flex items-center gap-1.5 mb-6 overflow-x-auto -mx-1 px-1 pb-1">
      {items.map((it) => {
        const isActive = it.value === view;
        const href = it.value === "vocabulario" ? "/categorias" : `/categorias?view=${it.value}`;
        return (
          <Link
            key={it.value}
            href={href}
            className={
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12.5px] font-medium transition-colors " +
              (isActive
                ? "bg-ink-950 dark:bg-bone-100 text-white dark:text-ink-950 border-ink-950 dark:border-bone-100"
                : "bg-surface border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground")
            }
          >
            {it.icon}
            <span>{it.label}</span>
            <span
              className={
                "font-mono text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full " +
                (isActive ? "bg-white/15 dark:bg-ink-950/15" : "bg-surface-muted text-faint-foreground")
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
