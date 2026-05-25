"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type ChangePasswordState } from "@/services/password.actions";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ChangePasswordState | undefined, FormData>(
    changePassword,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Senha alterada com sucesso.");
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12.5px] text-navy-700 dark:text-navy-300 hover:underline mt-3"
      >
        Alterar senha →
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-3 mt-4 pt-4 border-t border-border">
      <div>
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirmar</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
      </div>
      {state?.error ? (
        <p className="text-[12px] text-rust-600">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Alterando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
