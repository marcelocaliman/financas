"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  updateHousehold,
  updateProfile,
  type ProfileFormState,
} from "@/services/profile.actions";

export function ProfileNameForm({ defaultValue }: { defaultValue: string }) {
  const [state, action, pending] = useActionState<ProfileFormState | undefined, FormData>(
    updateProfile,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) toast.success("Nome atualizado.");
  }, [state]);

  return (
    <form action={action} className="space-y-4 max-w-[360px]">
      <Field label="Seu nome" htmlFor="displayName">
        <Input
          id="displayName"
          name="displayName"
          defaultValue={defaultValue}
          autoComplete="given-name"
        />
        {state?.fieldErrors?.displayName ? (
          <p className="text-[12.5px] text-rust-600 mt-1">{state.fieldErrors.displayName}</p>
        ) : null}
      </Field>
      {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar nome"}
      </Button>
    </form>
  );
}

export function HouseholdNameForm({ defaultValue }: { defaultValue: string }) {
  const [state, action, pending] = useActionState<ProfileFormState | undefined, FormData>(
    updateHousehold,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) toast.success("Lar atualizado.");
  }, [state]);

  return (
    <form action={action} className="space-y-4 max-w-[360px]">
      <Field label="Nome do lar" htmlFor="hh-name">
        <Input id="hh-name" name="name" defaultValue={defaultValue} />
        {state?.fieldErrors?.name ? (
          <p className="text-[12.5px] text-rust-600 mt-1">{state.fieldErrors.name}</p>
        ) : null}
      </Field>
      {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar lar"}
      </Button>
    </form>
  );
}
