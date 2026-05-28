"use client";

import { useOptimistic, useState, useTransition, startTransition } from "react";
import { toast } from "sonner";
import { CategoryRow } from "./category-row";
import { MergeCategoryDialog } from "./merge-category-dialog";
import { reorderCategories } from "@/services/categories.actions";
import type { Tables } from "@/types/database";
import type { CategoryStats } from "@/services/categories";

type Category = Tables<"categories">;

/**
 * Lista de categorias com reordenação via setas (sobe/desce uma posição).
 * Drag-and-drop seria mais bonito mas exige libs maiores — setas funcionam
 * em mobile e teclado sem complexidade adicional.
 *
 * Optimistic update: a UI muda imediatamente; servidor confirma no background.
 * Se falhar, mostra toast e React re-renderiza com a ordem do server.
 */
export function ReorderableCategoryList({
  initial,
  statsMap,
  budgetMap,
}: {
  initial: Category[];
  statsMap: Map<string, CategoryStats>;
  /** Map<categoryId, {amount, currency}> com budget vigente */
  budgetMap?: Map<string, { amount: number; currency: "BRL" | "EUR" | "USD" | "GBP" }>;
}) {
  const [, isPending] = useTransition();
  void isPending;
  const [items, setItems] = useState<Category[]>(initial);
  const [optimisticItems, applyOptimistic] = useOptimistic<Category[], Category[]>(
    items,
    (_, next) => next,
  );
  const [mergingId, setMergingId] = useState<string | null>(null);

  const move = (idx: number, dir: "up" | "down") => {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= optimisticItems.length) return;
    const next = [...optimisticItems];
    [next[idx], next[target]] = [next[target], next[idx]];

    startTransition(async () => {
      applyOptimistic(next);
      setItems(next);
      const r = await reorderCategories(next.map((c) => c.id));
      if (r.error) {
        toast.error(r.error);
        // Reverte
        setItems(optimisticItems);
      }
    });
  };

  const mergeSource = optimisticItems.find((c) => c.id === mergingId) ?? null;
  const mergeCandidates = mergeSource
    ? optimisticItems.filter(
        (c) => c.id !== mergeSource.id && c.kind === mergeSource.kind && !c.is_archived,
      )
    : [];

  return (
    <>
      <ul>
        {optimisticItems.map((c, idx) => (
          <li key={c.id}>
            <CategoryRow
              category={c}
              stats={statsMap.get(c.id)}
              budgetAmount={budgetMap?.get(c.id)?.amount}
              budgetCurrency={budgetMap?.get(c.id)?.currency}
              canMoveUp={idx > 0}
              canMoveDown={idx < optimisticItems.length - 1}
              onMoveUp={() => move(idx, "up")}
              onMoveDown={() => move(idx, "down")}
              onMerge={() => setMergingId(c.id)}
            />
          </li>
        ))}
      </ul>

      {mergeSource ? (
        <MergeCategoryDialog
          source={mergeSource}
          candidates={mergeCandidates}
          open={true}
          onOpenChange={(open) => {
            if (!open) setMergingId(null);
          }}
        />
      ) : null}
    </>
  );
}
