"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Calendar, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { saveFirePreferences, type SaveFireState } from "@/services/fire.actions";
import type { FirePreferences } from "@/services/fire";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

export function FirePreferencesForm({
  defaults,
  isAdmin,
  currentMonthlyExpense,
}: {
  defaults: FirePreferences;
  isAdmin: boolean;
  /** Despesa atual usada como fallback quando renda alvo está vazia */
  currentMonthlyExpense: number;
}) {
  const [state, action, pending] = useActionState<
    SaveFireState | undefined,
    FormData
  >(saveFirePreferences, undefined);

  // Estado local pra preview live
  const [targetIncome, setTargetIncome] = useState<number>(
    defaults.targetMonthlyIncome ?? 0,
  );
  const [returnPct, setReturnPct] = useState<number>(defaults.expectedReturnPct);
  const [swrPct, setSwrPct] = useState<number>(defaults.swrPct);

  useEffect(() => {
    if (state?.ok) toast.success("Plano atualizado.");
    if (state?.error) toast.error(state.error);
  }, [state]);

  const effectiveTarget = targetIncome > 0 ? targetIncome : currentMonthlyExpense;
  const fireTargetNetWorth =
    swrPct > 0 ? (effectiveTarget * 12) / (swrPct / 100) : 0;

  return (
    <form action={action} className="space-y-8">
      {/* ============ SEÇÃO 1: SUAS METAS ============ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-gold-600" strokeWidth={1.7} />
          <h3 className="font-display text-[18px] tracking-[-0.015em] text-foreground">
            Suas metas
          </h3>
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
          O número que importa pra vc: <b className="text-foreground">quanto quer
          receber por mês quando não precisar mais trabalhar</b>.
        </p>

        <div className="space-y-4">
          <Field
            label="Renda mensal desejada na aposentadoria"
            htmlFor="targetMonthlyIncome"
            hint={
              targetIncome > 0
                ? "Esse será o número que o app usa pra calcular quanto vc precisa ter."
                : `Se vc deixar em branco/zero, vamos usar sua despesa atual (${formatMoney(currentMonthlyExpense)}/mês) como aproximação.`
            }
          >
            <MoneyInput
              name="targetMonthlyIncome"
              id="targetMonthlyIncome"
              currency="BRL"
              defaultValue={defaults.targetMonthlyIncome ?? 0}
              onValueChange={setTargetIncome}
              disabled={!isAdmin}
              size="lg"
            />
          </Field>

          {/* Sugestões rápidas (presets) */}
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-faint-foreground self-center mr-1">
                Sugestões:
              </span>
              {[
                { label: "Lean (60%)", value: currentMonthlyExpense * 0.6 },
                { label: "Atual (100%)", value: currentMonthlyExpense },
                { label: "Confortável (150%)", value: currentMonthlyExpense * 1.5 },
                { label: "Fat (200%)", value: currentMonthlyExpense * 2 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setTargetIncome(Math.round(p.value / 100) * 100)}
                  className="text-[11.5px] px-2.5 py-1 rounded-[6px] border border-border hover:border-navy-500 hover:bg-surface-muted transition-colors"
                >
                  {p.label} · {formatMoney(p.value)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ============ SEÇÃO 2: PREMISSAS DE MERCADO ============ */}
      <section className="border-t border-border pt-7">
        <h3 className="font-display text-[18px] tracking-[-0.015em] text-foreground mb-1">
          Premissas de mercado
        </h3>
        <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
          O que vc espera do mercado nos próximos anos. <b className="text-foreground">Mantenha o
          padrão se não tem certeza</b> — são valores conservadores pra o Brasil.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field
            label="Retorno esperado por ano"
            htmlFor="expectedReturnPct"
            hint="% acima da inflação. Carteira mista BR rende ~6% real."
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                name="expectedReturnPct"
                id="expectedReturnPct"
                step="any"
                min={0}
                max={50}
                defaultValue={defaults.expectedReturnPct}
                onChange={(e) => setReturnPct(Number(e.target.value))}
                disabled={!isAdmin}
              />
              <span className="font-mono text-[12px] text-faint-foreground">% a.a.</span>
            </div>
          </Field>

          <Field
            label="Inflação esperada"
            htmlFor="inflationPct"
            hint="IPCA. Média histórica BR ~4%."
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                name="inflationPct"
                id="inflationPct"
                step="any"
                min={0}
                max={50}
                defaultValue={defaults.inflationPct}
                disabled={!isAdmin}
              />
              <span className="font-mono text-[12px] text-faint-foreground">% a.a.</span>
            </div>
          </Field>

          <Field
            label="Quanto vc vai sacar por ano"
            htmlFor="swrPct"
            hint="4% = padrão. Menor = mais conservador, precisa de mais patrimônio."
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                name="swrPct"
                id="swrPct"
                step="any"
                min={0.1}
                max={20}
                defaultValue={defaults.swrPct}
                onChange={(e) => setSwrPct(Number(e.target.value))}
                disabled={!isAdmin}
              />
              <span className="font-mono text-[12px] text-faint-foreground">% a.a.</span>
            </div>
          </Field>
        </div>
      </section>

      {/* ============ SEÇÃO 3: SOBRE VOCÊ ============ */}
      <section className="border-t border-border pt-7">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
          <h3 className="font-display text-[18px] tracking-[-0.015em] text-foreground">
            Sobre você
          </h3>
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
          Dados individuais — cada membro do household tem os seus.
          Tudo opcional, mas preencher melhora as projeções (mostra idade ao se aposentar, etc).
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Quando vc nasceu?"
              htmlFor="birthDate"
              hint="O app mostra com quantos anos vc atinge a independência"
            >
              <Input
                type="date"
                name="birthDate"
                id="birthDate"
                defaultValue={defaults.birthDate ?? ""}
              />
            </Field>
            <Field
              label="Com quantos anos vc quer se aposentar?"
              htmlFor="targetRetirementAge"
              hint="Ex: 55. Mostra se sua trajetória bate ou atrasa essa meta."
            >
              <Input
                type="number"
                name="targetRetirementAge"
                id="targetRetirementAge"
                step="any"
                min={18}
                max={100}
                defaultValue={defaults.targetRetirementAge ?? ""}
                placeholder="55"
              />
            </Field>
          </div>

          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-faint-foreground" strokeWidth={1.7} />
                Estimativa de INSS quando se aposentar
              </span>
            }
            htmlFor="inssMonthlyEstimate"
            hint="Se vc espera receber INSS, isso REDUZ quanto vc precisa juntar. Use o valor que valeria hoje (não corrigido pra futuro). Consulte sua simulação no Meu INSS."
          >
            <MoneyInput
              name="inssMonthlyEstimate"
              id="inssMonthlyEstimate"
              currency="BRL"
              defaultValue={defaults.inssMonthlyEstimate ?? 0}
            />
          </Field>
        </div>
      </section>

      {/* ============ PREVIEW LIVE ============ */}
      <section className="border-t border-border pt-5">
        <div className="rounded-[10px] bg-bone-100 dark:bg-ink-800 border border-border px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2">
            Resumo do seu plano
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground">
                Renda mensal alvo
              </div>
              <div className="font-mono text-[16px] tabular-nums text-foreground mt-1">
                <MoneyMask>{formatMoney(effectiveTarget)}</MoneyMask>/mês
              </div>
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground">
                Renda anual alvo
              </div>
              <div className="font-mono text-[16px] tabular-nums text-foreground mt-1">
                <MoneyMask>{formatMoney(effectiveTarget * 12)}</MoneyMask>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground">
                Patrimônio necessário
              </div>
              <div className="font-mono text-[16px] tabular-nums text-navy-700 dark:text-navy-300 mt-1">
                <MoneyMask>{formatMoney(fireTargetNetWorth)}</MoneyMask>
              </div>
              <div className="font-mono text-[10px] text-faint-foreground mt-0.5">
                = renda anual ÷ {swrPct}%
              </div>
            </div>
          </div>
          {!isAdmin ? (
            <div className="mt-3 pt-3 border-t border-border">
              <Badge tone="neutral">Modo leitura</Badge>
              <span className="ml-2 text-[11.5px] text-muted-foreground">
                Só admin do household altera renda alvo / retorno / inflação / SWR.
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {state?.error ? (
        <p className="text-[12.5px] text-rust-600">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (window.location.href = "/independencia")}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar e ver minha trajetória"}
        </Button>
      </div>
    </form>
  );
}
