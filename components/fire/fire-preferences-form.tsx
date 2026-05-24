"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { saveFirePreferences, type SaveFireState } from "@/services/fire.actions";
import type { FirePreferences } from "@/services/fire";

export function FirePreferencesForm({
  defaults,
  isAdmin,
}: {
  defaults: FirePreferences;
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState<
    SaveFireState | undefined,
    FormData
  >(saveFirePreferences, undefined);

  useEffect(() => {
    if (state?.ok) toast.success("Preferências salvas.");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-7">
      {/* HOUSEHOLD-LEVEL */}
      <div>
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Compartilhado · plano do casal
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
          {isAdmin
            ? "Esses números afetam vc e qualquer membro do household."
            : "Só admin do household pode editar (vc vê em modo leitura)."}
        </p>

        <div className="space-y-4">
          <Field
            label="Renda passiva alvo (R$/mês)"
            htmlFor="targetMonthlyIncome"
            hint="Quanto vc quer ter de renda mensal quando 'aposentar'. Se vazio, usamos sua despesa atual."
          >
            <MoneyInput
              name="targetMonthlyIncome"
              id="targetMonthlyIncome"
              currency="BRL"
              defaultValue={defaults.targetMonthlyIncome ?? 0}
              disabled={!isAdmin}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Retorno real anual (%)"
              htmlFor="expectedReturnPct"
              hint="Já descontada inflação. 6% = conservador BR mista."
            >
              <Input
                type="number"
                name="expectedReturnPct"
                id="expectedReturnPct"
                step={0.1}
                min={0}
                max={50}
                defaultValue={defaults.expectedReturnPct}
                disabled={!isAdmin}
              />
            </Field>
            <Field
              label="Inflação esperada (% a.a.)"
              htmlFor="inflationPct"
              hint="IPCA médio. 4% é projeção de longo prazo."
            >
              <Input
                type="number"
                name="inflationPct"
                id="inflationPct"
                step={0.1}
                min={0}
                max={50}
                defaultValue={defaults.inflationPct}
                disabled={!isAdmin}
              />
            </Field>
          </div>

          <Field
            label="Safe Withdrawal Rate (% a.a.)"
            htmlFor="swrPct"
            hint="4% = clássico Trinity (90% sucesso em 30 anos). 3.5% = conservador pra prazos > 30 anos. 3% = ultra-conservador."
          >
            <Input
              type="number"
              name="swrPct"
              id="swrPct"
              step={0.1}
              min={0.1}
              max={20}
              defaultValue={defaults.swrPct}
              disabled={!isAdmin}
            />
          </Field>
        </div>
      </div>

      {/* USER-LEVEL */}
      <div className="border-t border-border pt-7">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Pessoal · só vc
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
          Esses dados são individuais — cada membro do household tem os seus.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Data de nascimento"
              htmlFor="birthDate"
              hint="Opcional · usado pra mostrar idade ao FIRE"
            >
              <Input
                type="date"
                name="birthDate"
                id="birthDate"
                defaultValue={defaults.birthDate ?? ""}
              />
            </Field>
            <Field
              label="Idade alvo de aposentadoria"
              htmlFor="targetRetirementAge"
              hint="Opcional · ex: 55"
            >
              <Input
                type="number"
                name="targetRetirementAge"
                id="targetRetirementAge"
                min={18}
                max={100}
                defaultValue={defaults.targetRetirementAge ?? ""}
                placeholder="55"
              />
            </Field>
          </div>

          <Field
            label="INSS mensal estimado (R$)"
            htmlFor="inssMonthlyEstimate"
            hint="Opcional · se preenchido, reduz patrimônio necessário (FIRE considera INSS cobrindo parte da renda). Use valor REAL hoje, não corrigido."
          >
            <MoneyInput
              name="inssMonthlyEstimate"
              id="inssMonthlyEstimate"
              currency="BRL"
              defaultValue={defaults.inssMonthlyEstimate ?? 0}
            />
          </Field>
        </div>
      </div>

      {state?.error ? (
        <p className="text-[12.5px] text-rust-600">{state.error}</p>
      ) : null}

      <div className="flex justify-end pt-4 border-t border-border">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar preferências"}
        </Button>
      </div>
    </form>
  );
}
