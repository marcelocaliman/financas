"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { upsertBudget } from "@/services/budgets.actions";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Currency } from "@/types/database";

/**
 * Editor inline de orçamento — aparece na linha da categoria em /categorias.
 * Estados:
 *   - Sem budget: mostra "—" + lápis pra criar
 *   - Com budget: mostra "R$ X /mês" + lápis pra editar
 *   - Editando: input inline + check/x
 */
export function BudgetInlineEditor({
  categoryId,
  currentAmount,
  currency = "BRL",
}: {
  categoryId: string;
  currentAmount: number;
  currency?: Currency;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(currentAmount);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    startTransition(async () => {
      const r = await upsertBudget({
        categoryId,
        amount,
        currency,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(amount === 0 ? "Orçamento removido." : "Orçamento atualizado.");
      setEditing(false);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-[120px]">
          <MoneyInput
            name="budget-amount"
            currency={currency}
            defaultValue={amount}
            onValueChange={setAmount}
            autoFocus
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={pending}
          aria-label="Salvar"
        >
          <Check className="w-3.5 h-3.5 text-olive-700" strokeWidth={1.8} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setAmount(currentAmount);
          }}
          disabled={pending}
          aria-label="Cancelar"
        >
          <X className="w-3.5 h-3.5 text-faint-foreground" strokeWidth={1.8} />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 text-[12px] font-mono tabular-nums text-faint-foreground hover:text-foreground transition-colors group/budget"
      aria-label="Editar orçamento"
    >
      {currentAmount > 0 ? (
        <>
          <span className="text-muted-foreground">
            <MoneyMask>{formatMoney(currentAmount, currency)}</MoneyMask>
          </span>
          <span className="text-faint-foreground text-[10px]">/mês</span>
        </>
      ) : (
        <span className="italic">+ orçamento</span>
      )}
      <Pencil
        className="w-2.5 h-2.5 opacity-0 group-hover/budget:opacity-100 transition-opacity"
        strokeWidth={1.7}
      />
    </button>
  );
}
