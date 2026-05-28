"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/ui/money-input";
import { Money } from "@/components/ui/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertBudget } from "@/services/budgets.actions";
import type { BudgetVsActual } from "@/services/budgets";

type CatLite = { id: string; name: string; color: string | null };

const STATUS_COLOR: Record<string, { bar: string; text: string }> = {
  ok: { bar: "bg-olive-600", text: "text-olive-700 dark:text-olive-500" },
  warning: { bar: "bg-gold-600", text: "text-gold-700 dark:text-gold-500" },
  over: { bar: "bg-rust-600", text: "text-rust-600" },
  no_budget: { bar: "bg-surface-muted", text: "text-faint-foreground" },
};

export function BudgetManager({
  rows,
  allCategories,
}: {
  rows: BudgetVsActual[];
  allCategories: CatLite[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [newCategoryId, setNewCategoryId] = useState<string>("");
  const [newAmount, setNewAmount] = useState<number>(0);

  // Categorias sem orçamento
  const withBudgetIds = new Set(rows.filter((r) => r.status !== "no_budget").map((r) => r.categoryId));
  const withoutBudget = allCategories.filter((c) => !withBudgetIds.has(c.id));

  const handleSave = (categoryId: string, amount: number) => {
    startTransition(async () => {
      const r = await upsertBudget({ categoryId, amount });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(amount === 0 ? "Orçamento removido." : "Orçamento salvo.");
      setEditing(null);
      router.refresh();
    });
  };

  const handleAdd = () => {
    if (!newCategoryId || newAmount <= 0) {
      toast.error("Selecione categoria e valor.");
      return;
    }
    handleSave(newCategoryId, newAmount);
    setNewCategoryId("");
    setNewAmount(0);
  };

  return (
    <div className="space-y-1">
      {rows.length === 0 ? (
        <div className="text-center py-6 text-[13px] text-muted-foreground italic">
          Sem categorias de despesa. Cadastre em /categorias primeiro.
        </div>
      ) : (
        rows.map((r) => {
          const colors = STATUS_COLOR[r.status];
          const pct = r.budgetAmount > 0 ? Math.min(1, r.actualSpent / r.budgetAmount) : 0;
          const isEditing = editing === r.categoryId;

          return (
            <div
              key={r.categoryId}
              className="grid grid-cols-[20px_1fr_140px_100px_120px_36px] gap-3 items-center py-2.5 px-1 border-b border-border-strong/30 last:border-b-0"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: r.categoryColor ?? "#999" }}
              />
              <span className="font-medium text-[13.5px] truncate">{r.categoryName}</span>

              {/* Coluna orçamento */}
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <MoneyInput
                    name={`b-${r.categoryId}`}
                    defaultValue={r.budgetAmount}
                    onValueChange={(v) => {
                      // Salva no blur via callback no botão Check
                      (window as unknown as { __budget: number }).__budget = v;
                    }}
                    size="md"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleSave(r.categoryId, (window as unknown as { __budget?: number }).__budget ?? r.budgetAmount)
                    }
                    disabled={pending}
                    className="p-1.5 text-olive-700 hover:bg-olive-100"
                    aria-label="Salvar"
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="p-1.5 text-faint-foreground hover:text-foreground"
                    aria-label="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(r.categoryId)}
                  className="text-right font-mono tabular-nums text-[13px] hover:text-navy-700 dark:hover:text-navy-300 transition-colors"
                >
                  {r.budgetAmount > 0 ? (
                    <Money value={r.budgetAmount} />
                  ) : (
                    <span className="text-faint-foreground italic">— sem orçamento</span>
                  )}
                </button>
              )}

              <span className={`text-right font-mono tabular-nums text-[12.5px] ${colors.text}`}>
                <Money value={r.actualSpent} />
              </span>

              {/* Barra de progresso */}
              <div>
                {r.budgetAmount > 0 ? (
                  <div className="relative">
                    <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                      <div
                        className={`h-full ${colors.bar} transition-all`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-mono tabular-nums ${colors.text} block mt-1 text-right`}>
                      {(pct * 100).toFixed(0)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-faint-foreground italic">—</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSave(r.categoryId, 0)}
                disabled={pending || r.budgetAmount === 0}
                className="p-1 text-faint-foreground hover:text-rust-600 disabled:opacity-30"
                title="Remover orçamento"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.7} />
              </button>
            </div>
          );
        })
      )}

      {/* Adicionar nova categoria */}
      {withoutBudget.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground mb-2">
            Adicionar orçamento
          </div>
          <div className="flex items-center gap-2">
            <Select value={newCategoryId} onValueChange={setNewCategoryId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Escolha uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {withoutBudget.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-[140px]">
              <MoneyInput name="new-budget" defaultValue={0} onValueChange={setNewAmount} />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={pending || !newCategoryId || newAmount <= 0}
              className="px-3 py-1.5 rounded text-[12.5px] font-medium bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-30 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
              Adicionar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
