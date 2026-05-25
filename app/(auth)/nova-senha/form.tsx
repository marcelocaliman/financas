"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type NovaSenhaState } from "./actions";

export function NovaSenhaForm() {
  const [state, action, pending] = useActionState<NovaSenhaState | undefined, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </div>
      <div>
        <Label htmlFor="confirm">Confirmar nova senha</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </div>
      {state?.error ? (
        <p className="text-[12.5px] text-rust-600">{state.error}</p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
