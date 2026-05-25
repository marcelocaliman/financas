"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

/**
 * Confirmação dupla pra deletar ano IR.
 *
 * Lista o que será apagado + exige digitar o ano-base no campo pra liberar
 * o botão de confirmação. Operação é irreversível.
 */
export function DeleteYearConfirmDialog({
  open,
  onOpenChange,
  year,
  hasSnapshot,
  hasAnyData,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  hasSnapshot: boolean;
  hasAnyData: boolean;
  /** Retorna true se a operação foi bem-sucedida; false abort. */
  onConfirm: () => Promise<boolean>;
}) {
  const [yearInput, setYearInput] = useState("");
  const [pending, setPending] = useState(false);

  const canConfirm = yearInput === String(year);

  function reset() {
    setYearInput("");
    setPending(false);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setPending(true);
    const ok = await onConfirm();
    setPending(false);
    if (ok) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(440px,calc(100vw-2rem))] rounded-[var(--radius-xl)] bg-surface border border-border shadow-xl p-6 outline-none data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-rust-100 dark:bg-rust-700/30 grid place-items-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rust-600 dark:text-rust-100" strokeWidth={1.7} />
            </div>
            <div>
              <DialogPrimitive.Title className="font-display text-[18px] tracking-[-0.015em] text-foreground">
                Excluir ano-base {year}?
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                Operação <b>irreversível</b>. Vai apagar permanentemente os dados abaixo.
              </DialogPrimitive.Description>
            </div>
          </div>

          {hasAnyData ? (
            <div className="rounded-[8px] bg-rust-50 dark:bg-rust-900/20 border border-rust-200 dark:border-rust-700/40 px-3 py-2.5 mb-4 text-[12.5px]">
              <div className="font-medium text-rust-700 dark:text-rust-200 mb-1.5">Vai apagar:</div>
              <ul className="text-rust-700 dark:text-rust-100 space-y-0.5 leading-relaxed list-disc list-inside">
                {hasSnapshot ? <li>Snapshot fechado (Bens e totais)</li> : null}
                <li>DARFs gerados pra esse ano</li>
                <li>Pagamentos dedutíveis</li>
                <li>Rendas manuais (other_incomes)</li>
                <li>Lançamentos do carnê-leão</li>
                <li>Anotações do contador</li>
                <li>Saldos de abertura (31/12/{year - 1})</li>
              </ul>
              <p className="text-[11.5px] text-rust-600 dark:text-rust-200 mt-2 leading-relaxed">
                NÃO apaga transações, contas, investimentos ou bens físicos — esses são do dia-a-dia.
              </p>
            </div>
          ) : (
            <div className="rounded-[8px] bg-bone-50 dark:bg-ink-800 border border-border px-3 py-2.5 mb-4 text-[12.5px] text-muted-foreground">
              Esse ano não tem nenhum dado salvo — exclusão limpa.
            </div>
          )}

          <Field
            label={`Digite "${year}" para confirmar`}
            htmlFor="delete-year-confirm"
            required
          >
            <Input
              id="delete-year-confirm"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={String(year)}
              className={cn(
                "font-mono",
                yearInput.length > 0 && !canConfirm && "border-rust-400",
              )}
              maxLength={4}
              autoFocus
            />
          </Field>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }} disabled={pending}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || pending}
              className="!bg-rust-600 !text-white hover:!bg-rust-700 !border-rust-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Apagando…" : "Excluir definitivamente"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
