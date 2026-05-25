"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateRegime, type FilerFormState } from "@/services/ir/filers.actions";
import type { Tables, MarriageRegime, DeclarationStrategy, CommonAssetsStrategy } from "@/types/database";

type IRSettings = Tables<"ir_settings">;

const REGIME_OPTIONS: { value: MarriageRegime; label: string; hint: string }[] = [
  { value: "solteiro", label: "Solteiro(a)", hint: "Não casado(a). Sem regime de bens." },
  { value: "comunhao_parcial", label: "Comunhão parcial (padrão BR)", hint: "Bens adquiridos depois do casamento são 50/50. Bens prévios, herdados ou doados ficam com o dono." },
  { value: "comunhao_universal", label: "Comunhão universal", hint: "Tudo é 50/50, exceto exceções legais (herança/doação com cláusula)." },
  { value: "separacao_total", label: "Separação total (pacto antenupcial)", hint: "Cada um é dono exclusivo do que adquire. Nada é comum." },
  { value: "separacao_obrigatoria", label: "Separação obrigatória", hint: "Imposto por lei (>70 anos, certos casos). Equivale a separação total no IR." },
  { value: "participacao_final_aquestos", label: "Participação final nos aquestos", hint: "Durante o casamento: separação. Na dissolução: meação dos aquestos. No IR: trata como separação." },
];

const STRATEGY_OPTIONS: { value: DeclarationStrategy; label: string; hint: string }[] = [
  { value: "auto", label: "Decidir automaticamente (comparador)", hint: "App calcula imposto pelas 2 vias e recomenda a que paga menos." },
  { value: "separada", label: "Declarações separadas", hint: "Cada cônjuge faz sua declaração. Comum quando ambos têm renda significativa." },
  { value: "conjunta", label: "Declaração conjunta", hint: "1 declaração só; cônjuge entra como dependente. Vale quando um dos dois ganha pouco/nada." },
];

const COMMON_STRATEGY_OPTIONS: { value: CommonAssetsStrategy; label: string; hint: string }[] = [
  { value: "split_50_50", label: "Dividir 50/50 (recomendado)", hint: "Cada cônjuge declara metade de cada bem comum." },
  { value: "all_in_primary", label: "Tudo no titular principal", hint: "Bens comuns 100% na sua declaração." },
  { value: "all_in_secondary", label: "Tudo no cônjuge", hint: "Bens comuns 100% na declaração dela." },
];

export function RegimeForm({ settings }: { settings: IRSettings | null }) {
  const [regime, setRegime] = useState<MarriageRegime>(settings?.marriage_regime ?? "solteiro");
  const [strategy, setStrategy] = useState<DeclarationStrategy>(settings?.declaration_strategy ?? "auto");
  const [commonStrategy, setCommonStrategy] = useState<CommonAssetsStrategy>(
    settings?.common_assets_strategy ?? "split_50_50",
  );

  const [state, action, pending] = useActionState<FilerFormState | undefined, FormData>(
    updateRegime,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Regime atualizado.");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const showMarriageDate = regime === "comunhao_parcial" || regime === "comunhao_universal";
  const showCommonStrategy = strategy !== "conjunta" && regime !== "solteiro" && regime !== "separacao_total" && regime !== "separacao_obrigatoria";

  const regimeMeta = REGIME_OPTIONS.find((r) => r.value === regime)!;

  return (
    <form action={action} className="space-y-5">
      <Field label="Estado civil / regime de bens" htmlFor="marriageRegime" required>
        <Select value={regime} onValueChange={(v) => setRegime(v as MarriageRegime)} name="marriageRegime">
          <SelectTrigger id="marriageRegime">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGIME_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11.5px] text-faint-foreground mt-1.5">{regimeMeta.hint}</p>
      </Field>

      {showMarriageDate ? (
        <Field
          label="Data do casamento"
          htmlFor="marriageDate"
          required={regime === "comunhao_parcial"}
          hint="Bens adquiridos antes desta data são particulares de cada cônjuge."
        >
          <Input
            id="marriageDate"
            name="marriageDate"
            type="date"
            defaultValue={settings?.marriage_date ?? ""}
          />
          {state?.fieldErrors?.marriageDate ? (
            <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.marriageDate}</p>
          ) : null}
        </Field>
      ) : null}

      <Field label="Estratégia da declaração" htmlFor="declarationStrategy" required>
        <Select
          value={strategy}
          onValueChange={(v) => setStrategy(v as DeclarationStrategy)}
          name="declarationStrategy"
        >
          <SelectTrigger id="declarationStrategy">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11.5px] text-faint-foreground mt-1.5">
          {STRATEGY_OPTIONS.find((o) => o.value === strategy)?.hint}
        </p>
      </Field>

      {showCommonStrategy ? (
        <Field
          label="Como dividir bens comuns"
          htmlFor="commonAssetsStrategy"
          hint="Vale para contas, investimentos e imóveis em comum (não exclusivos)."
        >
          <Select
            value={commonStrategy}
            onValueChange={(v) => setCommonStrategy(v as CommonAssetsStrategy)}
            name="commonAssetsStrategy"
          >
            <SelectTrigger id="commonAssetsStrategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_STRATEGY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11.5px] text-faint-foreground mt-1.5">
            {COMMON_STRATEGY_OPTIONS.find((o) => o.value === commonStrategy)?.hint}
          </p>
        </Field>
      ) : (
        <input type="hidden" name="commonAssetsStrategy" value={commonStrategy} />
      )}

      <div className="flex justify-end pt-3 border-t border-border">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar regime"}
        </Button>
      </div>
    </form>
  );
}
