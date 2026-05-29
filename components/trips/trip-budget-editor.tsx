"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertBudgetItem, deleteBudgetItem } from "@/services/trips.actions";
import { formatCurrency } from "@/lib/financial/currency";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { DEFAULT_TRIP_CATEGORIES } from "@/types/trips";
import type { Currency } from "@/types/database";

type BudgetRow = {
  category: string;
  planned: number;
  actual: number;
  id?: string; // só pra linhas existentes em trip_budget_items
};

/**
 * Editor de orçamento da viagem. Lista categoria × planejado × realizado.
 * Permite adicionar/editar/remover linhas inline.
 */
export function TripBudgetEditor({
  tripId,
  currency,
  rows,
  budgetItemIds,
}: {
  tripId: string;
  currency: Currency;
  rows: BudgetRow[];
  /** Map category → trip_budget_items.id (pra delete) */
  budgetItemIds: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<number>(0);
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<string>(
    DEFAULT_TRIP_CATEGORIES[0],
  );
  const [newAmount, setNewAmount] = useState<number>(0);
  const confirm = useConfirm();

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  const handleSave = async (category: string, amount: number) => {
    startTransition(async () => {
      const r = await upsertBudgetItem({
        tripId,
        category,
        plannedAmount: amount,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Orçamento atualizado.");
        setEditing(null);
        setAdding(false);
        setNewAmount(0);
      }
    });
  };

  const handleDelete = async (category: string) => {
    const id = budgetItemIds[category];
    if (!id) {
      toast.error("Categoria não tem orçamento (só realizado). Edite a transação pra remover.");
      return;
    }
    const ok = await confirm({
      title: `Remover orçamento de ${category}?`,
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteBudgetItem(id, tripId);
      if (r.error) toast.error(r.error);
    });
  };

  // Categorias que ainda não foram adicionadas
  const usedCategories = new Set(rows.map((r) => r.category));
  const availableCategories = DEFAULT_TRIP_CATEGORIES.filter(
    (c) => !usedCategories.has(c),
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em] border-b border-border">
              <th className="text-left py-2 font-medium">Categoria</th>
              <th className="text-right py-2 pr-3 font-medium w-[140px]">Planejado</th>
              <th className="text-right py-2 pr-3 font-medium w-[140px]">Realizado</th>
              <th className="text-right py-2 pr-3 font-medium w-[100px]">Restante</th>
              <th className="text-right py-2 pr-2 font-medium w-[60px]">%</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const remaining = r.planned - r.actual;
              const pct = r.planned > 0 ? (r.actual / r.planned) * 100 : 0;
              const isEditing = editing === r.category;
              const tone = pct > 100 ? "text-rust-600" : pct > 80 ? "text-gold-700 dark:text-gold-400" : "text-olive-700 dark:text-olive-400";

              return (
                <tr key={r.category} className="border-b border-border last:border-b-0">
                  <td className="py-2.5 pr-3 font-medium">{r.category}</td>
                  <td className="text-right pr-3">
                    {isEditing ? (
                      <MoneyInput
                        name={`planned-${r.category}`}
                        currency={currency}
                        defaultValue={r.planned}
                        onValueChange={setDraft}
                      />
                    ) : (
                      <span className="font-mono tabular-nums">
                        {formatCurrency(r.planned, currency)}
                      </span>
                    )}
                  </td>
                  <td className="text-right pr-3 font-mono tabular-nums text-muted-foreground">
                    {formatCurrency(r.actual, currency)}
                  </td>
                  <td className={`text-right pr-3 font-mono tabular-nums ${remaining < 0 ? "text-rust-600" : ""}`}>
                    {formatCurrency(remaining, currency)}
                  </td>
                  <td className={`text-right pr-2 font-mono tabular-nums text-[12px] ${tone}`}>
                    {r.planned > 0 ? `${pct.toFixed(0)}%` : "—"}
                  </td>
                  <td className="text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <Tooltip content="Salvar">
                          <button
                            type="button"
                            onClick={() => handleSave(r.category, draft)}
                            disabled={pending}
                            className="p-1 rounded text-olive-700 hover:bg-olive-100/40"
                            aria-label="Salvar"
                          >
                            <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </Tooltip>
                        <Tooltip content="Cancelar">
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="p-1 rounded text-faint-foreground hover:bg-surface-muted"
                            aria-label="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </Tooltip>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1 opacity-60 hover:opacity-100">
                        <Tooltip content="Editar orçamento">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(r.category);
                              setDraft(r.planned);
                            }}
                            className="p-1 rounded hover:bg-surface-muted"
                            aria-label="Editar"
                          >
                            <Pencil className="w-3 h-3" strokeWidth={2} />
                          </button>
                        </Tooltip>
                        {budgetItemIds[r.category] ? (
                          <Tooltip content="Remover categoria">
                            <button
                              type="button"
                              onClick={() => handleDelete(r.category)}
                              disabled={pending}
                              className="p-1 rounded text-rust-600 hover:bg-rust-100/40"
                              aria-label="Remover"
                            >
                              <Trash2 className="w-3 h-3" strokeWidth={2} />
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {adding ? (
              <tr className="border-b border-border">
                <td className="py-2.5 pr-3">
                  <Select
                    value={newCategory}
                    onValueChange={setNewCategory}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom">Outra (digitar)</SelectItem>
                    </SelectContent>
                  </Select>
                  {newCategory === "__custom" ? (
                    <Input
                      placeholder="Digite a categoria"
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="mt-1"
                    />
                  ) : null}
                </td>
                <td className="text-right pr-3">
                  <MoneyInput
                    name="planned-new"
                    currency={currency}
                    defaultValue={0}
                    onValueChange={setNewAmount}
                  />
                </td>
                <td colSpan={3}></td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSave(newCategory, newAmount)}
                      disabled={pending || !newCategory || newCategory === "__custom"}
                      className="p-1 rounded text-olive-700 hover:bg-olive-100/40"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setNewAmount(0);
                      }}
                      className="p-1 rounded text-faint-foreground hover:bg-surface-muted"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}

            <tr className="font-medium border-t-2 border-border-strong">
              <td className="py-2.5 pr-3">TOTAL</td>
              <td className="text-right pr-3 font-mono tabular-nums">
                {formatCurrency(totalPlanned, currency)}
              </td>
              <td className="text-right pr-3 font-mono tabular-nums text-muted-foreground">
                {formatCurrency(totalActual, currency)}
              </td>
              <td className={`text-right pr-3 font-mono tabular-nums ${totalPlanned - totalActual < 0 ? "text-rust-600" : ""}`}>
                {formatCurrency(totalPlanned - totalActual, currency)}
              </td>
              <td className="text-right pr-2 font-mono tabular-nums text-[12px]">
                {totalPlanned > 0 ? `${((totalActual / totalPlanned) * 100).toFixed(0)}%` : "—"}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {!adding && availableCategories.length > 0 ? (
        <Button
          variant="ghost"
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3"
          size="sm"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
          Adicionar categoria
        </Button>
      ) : null}
    </div>
  );
}
