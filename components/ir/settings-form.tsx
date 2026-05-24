"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertIRSettings, type IRFormState } from "@/services/ir/actions";
import type { Tables } from "@/types/database";

export function IRSettingsForm({
  settings,
}: {
  settings: Tables<"ir_settings"> | null;
}) {
  const [state, action, pending] = useActionState<IRFormState | undefined, FormData>(
    upsertIRSettings,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Configurações salvas.");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="grid lg:grid-cols-[1fr_1fr_auto] gap-3 items-end">
      <Field label="CPF do titular" htmlFor="cpf_titular">
        <Input
          id="cpf_titular"
          name="cpf_titular"
          placeholder="000.000.000-00"
          defaultValue={settings?.cpf_titular ?? ""}
        />
      </Field>
      <Field label="Modelo preferido" htmlFor="preferred_model">
        <Select name="preferred_model" defaultValue={settings?.preferred_model ?? "auto"}>
          <SelectTrigger id="preferred_model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático (escolhe o melhor)</SelectItem>
            <SelectItem value="simples">Simples</SelectItem>
            <SelectItem value="completo">Completo</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
