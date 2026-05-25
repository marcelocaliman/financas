"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPasswordReset, type LoginState } from "../login/actions";

export function RecuperarSenhaForm() {
  const [state, action, pending] = useActionState<LoginState | undefined, FormData>(
    sendPasswordReset,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">E-mail da sua conta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@email.com"
        />
      </div>
      {state?.error ? (
        <p className="text-[12.5px] text-rust-600">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-[12.5px] text-olive-700 bg-olive-100 dark:bg-olive-700/15 px-3 py-2 rounded-[8px] leading-relaxed">
          Se este e-mail existe na nossa base, mandamos um link de recuperação.
          Confira sua caixa de entrada (e o spam, por garantia).
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Enviando…" : "Enviar link de recuperação"}
      </Button>
    </form>
  );
}
