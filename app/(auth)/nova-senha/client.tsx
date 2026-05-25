"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type State = "hydrating" | "ready" | "expired" | "saving";

export function NovaSenhaClient() {
  const router = useRouter();
  const [state, setState] = useState<State>("hydrating");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();

    // O Supabase manda tokens via hash fragment: #access_token=...&refresh_token=...&type=recovery
    const hash = window.location.hash.slice(1); // remove "#"
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");
    const errorCode = params.get("error_code");
    const errorDesc = params.get("error_description");

    if (errorCode) {
      // Link expirado/inválido — Supabase já mandou direto pro hash com error
      setState("expired");
      setError(errorDesc?.replace(/\+/g, " ") ?? errorCode);
      return;
    }

    if (!accessToken || !refreshToken || type !== "recovery") {
      // Pode ser: user já logado abriu /nova-senha direto, ou hash vazio
      // Tenta usar session existente (caso fluxo PKCE futuro ou user já logado)
      supabase.auth.getUser().then(({ data, error }) => {
        if (error || !data.user) {
          setState("expired");
          setError("Link inválido ou expirado.");
        } else {
          setState("ready");
        }
      });
      return;
    }

    // Hidrata session a partir do hash
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setState("expired");
          setError(error.message);
        } else {
          // Limpa o hash da URL pra evitar leak em logs/share
          window.history.replaceState(null, "", window.location.pathname);
          setState("ready");
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;

    if (password.length < 8) {
      toast.error("Senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }

    setState("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      setState("ready");
      return;
    }
    toast.success("Senha atualizada. Você já está logado.");
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  };

  if (state === "hydrating") {
    return (
      <div className="text-[13.5px] text-muted-foreground">Validando link…</div>
    );
  }

  if (state === "expired") {
    return (
      <div className="space-y-4">
        <div className="px-4 py-3 rounded-[8px] bg-rust-100 dark:bg-rust-700/15 text-rust-700 dark:text-rust-300 text-[13px]">
          <b>Link inválido ou expirado.</b>
          {error ? <div className="mt-1 text-[12px] opacity-80">{error}</div> : null}
        </div>
        <p className="text-[13px] text-muted-foreground">
          Cada link de recuperação só funciona uma vez e expira em 1 hora.
        </p>
        <a
          href="/recuperar-senha"
          className="inline-flex items-center justify-center w-full h-11 px-5 rounded-[8px] bg-navy-700 text-white font-medium text-[14px] hover:bg-navy-800 transition-colors"
        >
          Pedir novo link
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={state === "saving" || pending}
        className="w-full"
      >
        {state === "saving" || pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
