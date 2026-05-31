"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type SignupState } from "./actions";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

/**
 * Form de cadastro com dois modos:
 *  - "create": cria um novo lar (default). Pede nome do lar.
 *  - "join": ingressa em um lar existente via código de convite.
 *    Substitui "nome do lar" por "código do convite".
 */
export function SignupForm({
  initialMode = "create",
  presetEmail,
  redirectTo,
}: {
  initialMode?: "create" | "join" | "accountant";
  presetEmail?: string;
  redirectTo?: string;
} = {}) {
  const [mode, setMode] = useState<"create" | "join" | "accountant">(initialMode);
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
            Mandamos um link de verificação. Abra-o e seu lar será montado automaticamente
            {mode === "join" ? " usando o código de convite informado" : " com categorias padrão prontas"}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      {mode !== "accountant" ? (
        <div className="inline-flex items-center gap-1 p-1 bg-surface-muted rounded-[10px]">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={
              "px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium tracking-[-0.005em] transition-colors " +
              (mode === "create"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Criar lar
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={
              "px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium tracking-[-0.005em] transition-colors " +
              (mode === "join"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Tenho um convite
          </button>
        </div>
      ) : null}

      <div className={mode === "accountant" ? "" : "grid grid-cols-2 gap-3"}>
        <div>
          <Label htmlFor="displayName">Seu nome</Label>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="given-name"
            required
            placeholder="Nome completo"
          />
        </div>
        {mode === "create" ? (
          <div>
            <Label htmlFor="householdName">Nome do lar</Label>
            <Input
              id="householdName"
              name="householdName"
              placeholder="Sobrenome ou apelido do lar"
              defaultValue=""
            />
          </div>
        ) : mode === "join" ? (
          <div>
            <Label htmlFor="inviteCode">Código de convite</Label>
            <Input
              id="inviteCode"
              name="inviteCode"
              placeholder="cole o código recebido"
              autoCapitalize="characters"
              maxLength={40}
              required
              className="font-mono tracking-[0.08em] uppercase"
            />
          </div>
        ) : null}
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
          defaultValue={presetEmail ?? ""}
          readOnly={!!presetEmail && mode === "accountant"}
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
      <TurnstileWidget />
      {state?.error ? (
        <p className="text-[12.5px] text-rust-600">{state.error}</p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
        {pending
          ? "Criando…"
          : mode === "join"
            ? "Ingressar no lar"
            : mode === "accountant"
              ? "Criar conta de contador"
              : "Criar conta"}
      </Button>
    </form>
  );
}
