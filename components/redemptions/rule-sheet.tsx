"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PillGroup } from "@/components/ui/pill-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createYieldRule,
  updateYieldRule,
  type RuleFormState,
} from "@/services/redemptions.actions";
import type { YieldRuleMode } from "@/types/database";
import type { YieldRule } from "@/services/redemptions";

type AccountLite = { id: string; name: string; institution: string };
type InvestmentLite = { id: string; ticker: string; name: string };

export function RuleSheet({
  open,
  onOpenChange,
  rule,
  investments,
  destinations,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rule?: YieldRule | null;
  investments: InvestmentLite[];
  destinations: AccountLite[];
}) {
  const isEdit = !!rule;
  const [mode, setMode] = useState<YieldRuleMode>(rule?.mode ?? "fixed_amount");
  const [investmentId, setInvestmentId] = useState(rule?.investment_id ?? investments[0]?.id ?? "");
  const [destAccountId, setDestAccountId] = useState(
    rule?.destination_account_id ?? destinations[0]?.id ?? "",
  );

  const [state, action, pending] = useActionState<RuleFormState | undefined, FormData>(
    isEdit ? updateYieldRule : createYieldRule,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMode(rule?.mode ?? "fixed_amount");
      setInvestmentId(rule?.investment_id ?? investments[0]?.id ?? "");
      setDestAccountId(rule?.destination_account_id ?? destinations[0]?.id ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Regra atualizada." : "Regra criada.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar regra" : "Nova regra"}
          title={isEdit ? "Editar saque mensal." : "Configurar saque mensal."}
          description="O app vai lembrar você no dia certo. Você decide o valor exato na hora."
        />

        <form action={action} className="space-y-5">
          {isEdit ? <input type="hidden" name="id" value={rule.id} /> : null}

          <Field label="Ativo de origem" htmlFor="investmentId" required>
            <Select value={investmentId} onValueChange={setInvestmentId} name="investmentId">
              <SelectTrigger id="investmentId">
                <SelectValue placeholder="Ativo" />
              </SelectTrigger>
              <SelectContent>
                {investments.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.ticker} <span className="ml-1 text-faint-foreground">· {i.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Conta de destino" htmlFor="destinationAccountId" required>
            <Select
              value={destAccountId}
              onValueChange={setDestAccountId}
              name="destinationAccountId"
            >
              <SelectTrigger id="destinationAccountId">
                <SelectValue placeholder="Pra onde vai o dinheiro" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.institution}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Modo">
            <PillGroup
              options={[
                { value: "fixed_amount", label: "Valor sugerido", hint: "editável a cada mês" },
                { value: "percentage", label: "% rendimento", hint: "flexível com Selic" },
                { value: "reinvest", label: "Reinvestir", hint: "acumulação pura" },
              ]}
              value={mode}
              onChange={(v) => setMode(v as YieldRuleMode)}
              name="mode"
            />
          </Field>

          {mode === "fixed_amount" ? (
            <Field label="Valor sugerido" htmlFor="suggestedAmount">
              <MoneyInput
                name="suggestedAmount"
                id="suggestedAmount"
                defaultValue={Number(rule?.suggested_amount ?? 0)}
              />
            </Field>
          ) : null}

          {mode === "percentage" ? (
            <Field label="Porcentagem do rendimento (%)" htmlFor="percentage" hint="Ex.: 80 = sacar 80% do que rendeu no mês">
              <Input
                id="percentage"
                name="percentage"
                type="number"
                step="1"
                min="0"
                max="100"
                defaultValue={rule?.percentage ?? 80}
                className="font-mono"
              />
            </Field>
          ) : null}

          <Field
            label="Dia do mês"
            htmlFor="dayOfMonth"
            hint="Se o ativo tiver liquidez, o lembrete cai nesse dia"
          >
            <Input
              id="dayOfMonth"
              name="dayOfMonth"
              type="number"
              min={1}
              max={31}
              defaultValue={rule?.day_of_month ?? 5}
              className="font-mono"
            />
          </Field>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar regra" : "Criar regra"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
