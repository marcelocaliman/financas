"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type SignupState } from "./actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState | undefined, FormData>(
    signUp,
    undefined,
  );

  if (state?.needsConfirmation) {
    return (
      <div className="space-y-4">
        <div className="bg-olive-100 border border-olive-500/20 rounded-[10px] p-5">
          <p className="font-display text-[18px] tracking-[-0.01em] text-olive-800">
            Confirme seu e-mail.
          </p>
          <p className="text-[13px] text-olive-700 mt-1.5 leading-relaxed">
            Mandamos um link de verificação. Abra-o e seu lar será montado automaticamente — com
            categorias padrão prontas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="displayName">Seu nome</Label>
          <Input id="displayName" name="displayName" autoComplete="given-name" required placeholder="Marcelo" />
        </div>
        <div>
          <Label htmlFor="householdName">Nome do lar</Label>
          <Input
            id="householdName"
            name="householdName"
            placeholder="Caliman"
            defaultValue=""
          />
        </div>
      </div>
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@email.com"
        />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
        />
      </div>
      {state?.error ? (
        <p className="text-[12.5px] text-rust-600">{state.error}</p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
        {pending ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
