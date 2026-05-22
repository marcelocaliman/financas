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
import type { Currency } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string };

const CURRENCIES: { value: Currency; label: string; hint: string }[] = [
  { value: "BRL", label: "R$ · Real", hint: "Brasil" },
  { value: "EUR", label: "€ · Euro", hint: "Itália, Espanha, França…" },
  { value: "USD", label: "US$ · Dólar", hint: "Estados Unidos" },
];

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
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? "BRL");

  const [state, action, pending] = useActionState<GoalFormState | undefined, FormData>(
    isEdit ? updateGoal : createGoal,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLinkedAccount(goal?.linked_account_id ?? "");
      setCurrency(goal?.currency ?? "BRL");
    }
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

          <Field
            label="Moeda"
            htmlFor="currency"
            hint={
              currency !== "BRL"
                ? `Meta em ${currency} — útil pra viagens, imóveis fora, etc. Valores ficam guardados nessa moeda; conversão pra R$ usa a cotação atual.`
                : "Padrão. Mude se a meta for em outra moeda (ex: comprar imóvel na Itália → EUR)."
            }
          >
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as Currency)}
              name="currency"
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                    <span className="text-faint-foreground ml-1.5 text-[11.5px]">
                      · {c.hint}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor da meta" htmlFor="targetAmount" required>
              <MoneyInput
                name="targetAmount"
                id="targetAmount"
                currency={currency}
                defaultValue={Number(goal?.target_amount ?? 0)}
              />
            </Field>
            <Field label="Já tem" htmlFor="currentAmount">
              <MoneyInput
                name="currentAmount"
                id="currentAmount"
                currency={currency}
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
