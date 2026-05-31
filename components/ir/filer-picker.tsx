"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables, MarriageRegime, ParticularReason } from "@/types/database";

type Filer = Tables<"ir_filers">;

const PARTICULAR_REASONS: { value: ParticularReason; label: string }[] = [
  { value: "pre_casamento", label: "Adquirido antes do casamento" },
  { value: "heranca", label: "Herança" },
  { value: "doacao", label: "Doação" },
  { value: "sub_rogacao", label: "Sub-rogação (troca por outro particular)" },
  { value: "outros", label: "Outro motivo" },
];

const COMMUNAL_REGIMES: MarriageRegime[] = ["comunhao_parcial", "comunhao_universal"];

/**
 * Selector "De quem é este bem?" usado em sheets de cadastro.
 *
 * - Solo (1 filer): não renderiza nada (input hidden com o filer único).
 * - Couple + regime sem comunhão: só "Titular / Cônjuge" (100% no escolhido).
 * - Couple + comunhão: adiciona opção "Comum (50/50)" + toggle "Particular?".
 *
 * Quando "Comum" é escolhido, owner_filer_id vai pro primário (irrelevante
 * pra valor — o split é 50/50 via regime) e is_particular fica false.
 *
 * Quando "Particular" é marcado, exige um motivo (herança, doação etc.) e
 * o bem é 100% do owner mesmo em comunhão.
 *
 * O componente é "uncontrolled" via FormData — submita 3 campos:
 *   - ownerFilerId (uuid)
 *   - isParticular ("1" ou "0")
 *   - particularReason (string ou vazio)
 */
export function FilerPicker({
  filers,
  regime,
  defaultOwnerFilerId,
  defaultIsParticular,
  defaultParticularReason,
  labelPrefix = "Titular do bem",
  showCommonOption = true,
}: {
  filers: Filer[];
  regime: MarriageRegime;
  defaultOwnerFilerId?: string | null;
  defaultIsParticular?: boolean;
  defaultParticularReason?: ParticularReason | null;
  labelPrefix?: string;
  showCommonOption?: boolean;
}) {
  const primary = filers.find((f) => f.is_primary) ?? filers[0];
  const isCommunal = COMMUNAL_REGIMES.includes(regime);
  const allowCommon = showCommonOption && isCommunal;

  // Estado inicial: se default é "comum" (no schema isso não existe direto —
  // representamos como "owner = primary + ownership_percent ~ não-100").
  // Pra simplicidade na UI, derivamos do owner_filer_id atual.
  const initialChoice: string =
    defaultIsParticular
      ? defaultOwnerFilerId ?? primary?.id ?? ""
      : defaultOwnerFilerId ?? "common";

  // Hooks SEMPRE no topo, antes de qualquer return (rules-of-hooks).
  const [choice, setChoice] = useState<string>(initialChoice);
  const [isParticular, setIsParticular] = useState<boolean>(!!defaultIsParticular);
  const [reason, setReason] = useState<ParticularReason | "">(defaultParticularReason ?? "");

  // Caso solo — não há escolha pra fazer (depois dos hooks).
  if (filers.length <= 1) {
    return filers[0] ? (
      <input type="hidden" name="ownerFilerId" value={filers[0].id} />
    ) : null;
  }

  // O valor "common" é apenas UI — no submit, mandamos owner=primary + particular=false
  const isCommon = choice === "common";
  const ownerForSubmit = isCommon ? primary.id : choice;

  return (
    <div className="space-y-3 rounded-[8px] bg-bone-50 dark:bg-ink-900 border border-border p-3">
      <Field label={labelPrefix} htmlFor="ownerChoice" required>
        <Select value={choice} onValueChange={setChoice}>
          <SelectTrigger id="ownerChoice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowCommon ? (
              <SelectItem value="common">Comum do casal (split por regime)</SelectItem>
            ) : null}
            {filers.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.full_name}
                {f.is_primary ? " · titular" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Hidden — vai pra ação server */}
      <input type="hidden" name="ownerFilerId" value={ownerForSubmit} />

      {/* Particular: só faz sentido em regime de comunhão */}
      {isCommunal && !isCommon ? (
        <label className="flex items-start gap-2 cursor-pointer text-[12.5px]">
          <input
            type="checkbox"
            name="isParticular"
            value="1"
            checked={isParticular}
            onChange={(e) => setIsParticular(e.target.checked)}
            className="mt-0.5 accent-navy-700"
          />
          <span className="text-foreground">
            <b>Bem particular</b>
            <span className="block text-faint-foreground text-[11.5px] mt-0.5">
              100% deste titular mesmo no regime de comunhão (herança, doação, pré-casamento).
            </span>
          </span>
        </label>
      ) : (
        <input type="hidden" name="isParticular" value="0" />
      )}

      {isCommunal && !isCommon && isParticular ? (
        <Field label="Motivo" htmlFor="particularReason" required>
          <Select
            value={reason}
            onValueChange={(v) => setReason(v as ParticularReason)}
            name="particularReason"
          >
            <SelectTrigger id="particularReason">
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {PARTICULAR_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="particularReason" value="" />
      )}
    </div>
  );
}

/**
 * Wrapper que aceita `ownership_percent` opcional. Útil pra contas conjuntas
 * (banco com 2 CPFs) onde o usuário quer registrar 50/50 explícito.
 */
export function FilerPickerWithOwnership({
  filers,
  regime,
  defaultOwnerFilerId,
  defaultIsParticular,
  defaultParticularReason,
  defaultOwnershipPercent,
  labelPrefix,
}: {
  filers: Filer[];
  regime: MarriageRegime;
  defaultOwnerFilerId?: string | null;
  defaultIsParticular?: boolean;
  defaultParticularReason?: ParticularReason | null;
  defaultOwnershipPercent?: number | null;
  labelPrefix?: string;
}) {
  return (
    <>
      <FilerPicker
        filers={filers}
        regime={regime}
        defaultOwnerFilerId={defaultOwnerFilerId}
        defaultIsParticular={defaultIsParticular}
        defaultParticularReason={defaultParticularReason}
        labelPrefix={labelPrefix}
      />
      {filers.length > 1 ? (
        <Field
          label="% de propriedade do titular (opcional)"
          htmlFor="ownershipPercent"
          hint="Override manual. Ex.: conta bancária conjunta = 50. Deixe vazio pra usar a regra do regime."
        >
          <Input
            id="ownershipPercent"
            name="ownershipPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={defaultOwnershipPercent ?? ""}
            placeholder="100"
            className="font-mono"
          />
        </Field>
      ) : null}
    </>
  );
}
