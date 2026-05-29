"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Split, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setTransactionSplits,
  deleteTransactionSplits,
} from "@/services/transaction-splits.actions";
import { createClient } from "@/lib/supabase/client";
import { Tooltip } from "@/components/ui/tooltip";
import type { Transaction } from "@/services/transactions";

type Cat = { id: string; name: string; kind: "income" | "expense" | "transfer" };

type Split = {
  id?: string;
  categoryId: string | null;
  amount: number;
  description: string;
};

export function SplitsDialog({
  open,
  onOpenChange,
  transaction,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: Transaction;
  categories: Cat[];
}) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [pending, startTransition] = useTransition();
  const txAmount = Number(transaction.amount);
  const filteredCats = categories.filter((c) => c.kind === transaction.kind);

  useEffect(() => {
    if (!open) return;
    // Carrega splits existentes
    const supabase = createClient();
    supabase
      .from("transaction_splits")
      .select("id, category_id, amount, description")
      .eq("transaction_id", transaction.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSplits(
            data.map((s) => ({
              id: s.id as string,
              categoryId: s.category_id as string | null,
              amount: Number(s.amount),
              description: (s.description as string) ?? "",
            })),
          );
        } else {
          // Default: 2 splits vazios, primeiro com category atual da tx
          setSplits([
            {
              categoryId: transaction.category_id ?? null,
              amount: 0,
              description: "",
            },
            { categoryId: null, amount: 0, description: "" },
          ]);
        }
      });
  }, [open, transaction.id, transaction.category_id]);

  const total = splits.reduce((s, x) => s + x.amount, 0);
  const diff = txAmount - total;
  const balanced = Math.abs(diff) < 0.01;

  const addSplit = () => {
    setSplits((s) => [...s, { categoryId: null, amount: 0, description: "" }]);
  };

  const removeSplit = (i: number) => {
    if (splits.length <= 2) return;
    setSplits((s) => s.filter((_, idx) => idx !== i));
  };

  const updateSplit = (i: number, patch: Partial<Split>) => {
    setSplits((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  // Auto-completar: clicar no botão "Completar X em Y" preenche o split Y com o diff
  const completeWith = (i: number) => {
    updateSplit(i, { amount: splits[i].amount + diff });
  };

  const handleSave = () => {
    if (!balanced) {
      toast.error(
        `Faltam R$ ${Math.abs(diff).toFixed(2)} pra fechar (${diff > 0 ? "menos" : "mais"} que o total).`,
      );
      return;
    }
    startTransition(async () => {
      const r = await setTransactionSplits({
        transactionId: transaction.id,
        splits: splits.map((s) => ({
          categoryId: s.categoryId,
          amount: s.amount,
          description: s.description || null,
        })),
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${splits.length} splits salvos.`);
      onOpenChange(false);
    });
  };

  const handleRemoveAll = () => {
    startTransition(async () => {
      const r = await deleteTransactionSplits(transaction.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Splits removidos.");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow="Dividir em categorias"
          title={
            <>
              <Split className="inline w-4 h-4 mr-2 -mt-0.5" strokeWidth={1.8} />
              Splits
            </>
          }
          description={`"${transaction.description}" · R$ ${txAmount.toFixed(2).replace(".", ",")}. Use pra detalhar mercado, viagem, fatura cartão.`}
        />

        <div className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {splits.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_140px_120px_36px] gap-2 items-start">
              <Select
                value={s.categoryId ?? "none"}
                onValueChange={(v) => updateSplit(i, { categoryId: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem categoria</SelectItem>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={s.description}
                onChange={(e) => updateSplit(i, { description: e.target.value })}
                placeholder="Descrição (opcional)"
                className="text-[12px]"
              />
              <MoneyInput
                name={`split-${i}`}
                defaultValue={s.amount}
                onValueChange={(v) => updateSplit(i, { amount: v })}
              />
              <Tooltip content="Remover split">
                <button
                  type="button"
                  onClick={() => removeSplit(i)}
                  disabled={splits.length <= 2}
                  className="p-2 rounded text-faint-foreground hover:text-rust-600 hover:bg-rust-100/50 dark:hover:bg-rust-700/30 disabled:opacity-30 self-center"
                  aria-label="Remover split"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                </button>
              </Tooltip>
            </div>
          ))}

          <button
            type="button"
            onClick={addSplit}
            className="w-full py-2 border border-dashed border-border rounded-[8px] text-[12.5px] text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
            Adicionar split
          </button>
        </div>

        {/* Sumário + alerta de balanço */}
        <div
          className={
            "mt-4 px-4 py-3 rounded-[8px] border " +
            (balanced
              ? "border-olive-700/30 bg-olive-100/30 dark:bg-olive-700/15"
              : "border-rust-600/30 bg-rust-100/30 dark:bg-rust-700/15")
          }
        >
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">
              Soma dos splits / Total da transaction:
            </span>
            <span className="font-mono tabular-nums">
              R$ {total.toFixed(2).replace(".", ",")} / R$ {txAmount.toFixed(2).replace(".", ",")}
            </span>
          </div>
          {!balanced ? (
            <div className="flex items-center justify-between mt-1.5 text-[12px] text-rust-700 dark:text-rust-300">
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
                {diff > 0 ? "Faltam" : "Excede"}: R$ {Math.abs(diff).toFixed(2).replace(".", ",")}
              </span>
              {splits.length > 0 ? (
                <button
                  type="button"
                  onClick={() => completeWith(splits.length - 1)}
                  className="text-navy-700 dark:text-navy-300 hover:underline"
                >
                  Auto-completar último →
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleRemoveAll}
            disabled={pending}
            className="text-rust-600 hover:text-rust-700"
          >
            Remover todos
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={pending || !balanced}
          >
            {pending ? "Salvando…" : "Salvar splits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
