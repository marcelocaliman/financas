"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createGoal,
  updateGoal,
  type GoalFormState,
} from "@/services/goals.actions";
import type { Goal } from "@/services/goals";

type AccountLite = { id: string; name: string; institution: string };

export function GoalSheet({
  open,
  onOpenChange,
  goal,
  accounts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goal?: Goal | null;
  accounts: AccountLite[];
}) {
  const isEdit = !!goal;
  const [linkedAccount, setLinkedAccount] = useState(goal?.linked_account_id ?? "");

  const [state, action, pending] = useActionState<GoalFormState | undefined, FormData>(
    isEdit ? updateGoal : createGoal,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLinkedAccount(goal?.linked_account_id ?? "");
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Meta atualizada." : "Meta criada.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar meta" : "Nova meta"}
          title={isEdit ? "Editar meta." : "Adicionar uma meta."}
          description="Casa, viagem, reserva, um zero a mais no patrimônio — dá um nome, um valor e (se quiser) uma data."
        />

        <form action={action} className="space-y-5">
          {isEdit ? <input type="hidden" name="id" value={goal.id} /> : null}

          <Field label="Nome" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={goal?.name ?? ""}
              placeholder="Casa nova, viagem ao Japão, reserva de emergência…"
              autoFocus
            />
            {state?.fieldErrors?.name ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.name}</p>
            ) : null}
          </Field>

          <Field label="Descrição" htmlFor="description" hint="Opcional. O “porquê” por trás da meta.">
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={goal?.description ?? ""}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor da meta" htmlFor="targetAmount" required>
              <MoneyInput
                name="targetAmount"
                id="targetAmount"
                defaultValue={Number(goal?.target_amount ?? 0)}
              />
            </Field>
            <Field label="Já tem" htmlFor="currentAmount">
              <MoneyInput
                name="currentAmount"
                id="currentAmount"
                defaultValue={Number(goal?.current_amount ?? 0)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data desejada" htmlFor="targetDate" hint="Opcional">
              <Input
                id="targetDate"
                name="targetDate"
                type="date"
                defaultValue={goal?.target_date ?? ""}
              />
            </Field>
            <Field label="Conta vinculada" htmlFor="linkedAccountId" hint="Opcional">
              <Select
                value={linkedAccount}
                onValueChange={setLinkedAccount}
                name="linkedAccountId"
              >
                <SelectTrigger id="linkedAccountId">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.institution}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar meta" : "Criar meta"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
