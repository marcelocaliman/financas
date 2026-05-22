"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendMagicLink,
  signInWithPassword,
  type LoginState,
} from "./actions";

type Mode = "password" | "magic";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [pwdState, pwdAction, pwdPending] = useActionState<LoginState | undefined, FormData>(
    signInWithPassword,
    undefined,
  );
  const [magicState, magicAction, magicPending] = useActionState<
    LoginState | undefined,
    FormData
  >(sendMagicLink, undefined);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1 bg-surface-muted p-1 rounded-[10px]">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`text-[12.5px] font-medium py-2 px-3 rounded-[7px] transition-colors ${
            mode === "password"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Com senha
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={`text-[12.5px] font-medium py-2 px-3 rounded-[7px] transition-colors ${
            mode === "magic"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Link mágico
        </button>
      </div>

      {mode === "password" ? (
        <form action={pwdAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
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
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>
          {pwdState?.error ? (
            <p className="text-[12.5px] text-rust-600">{pwdState.error}</p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={pwdPending}
            className="w-full"
          >
            {pwdPending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      ) : (
        <form action={magicAction} className="space-y-4">
          <div>
            <Label htmlFor="magic-email">E-mail</Label>
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@email.com"
            />
            <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
              Mandamos um link de acesso direto pro seu e-mail. Um clique e você está dentro.
            </p>
          </div>
          {magicState?.error ? (
            <p className="text-[12.5px] text-rust-600">{magicState.error}</p>
          ) : null}
          {magicState?.ok ? (
            <p className="text-[12.5px] text-olive-700 bg-olive-100 px-3 py-2 rounded-[8px]">
              Link enviado. Confira sua caixa de entrada (e o spam, por garantia).
            </p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={magicPending}
            className="w-full"
          >
            {magicPending ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
    </div>
  );
}
