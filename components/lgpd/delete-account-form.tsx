"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestAccountDeletion } from "@/services/lgpd-deletion.actions";

/**
 * Exclusão de conta com REAUTH (senha) — D22. Após confirmar, a conta é
 * desativada na hora e entra em período de arrependimento (cancelável);
 * o hard-delete acontece pelo cron após o grace.
 */
export function DeleteAccountForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");

  const handleRequest = () => {
    if (confirm.trim().toUpperCase() !== "APAGAR") {
      toast.error('Digite "APAGAR" pra confirmar.');
      return;
    }
    if (!password) {
      toast.error("Confirme sua senha pra prosseguir.");
      return;
    }
    if (!window.confirm("Tem certeza? A conta será desativada e excluída após o período de arrependimento.")) return;

    startTransition(async () => {
      const r = await requestAccountDeletion(password);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Conta agendada para exclusão.");
      router.push("/conta-excluindo");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Field label="Confirme sua senha" htmlFor="deletePassword" required hint="Reautenticação obrigatória.">
        <Input
          id="deletePassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </Field>
      <Field label={'Digite "APAGAR" pra confirmar'} htmlFor="deleteConfirm" required>
        <Input
          id="deleteConfirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="APAGAR"
        />
      </Field>
      <p className="text-[11.5px] text-muted-foreground">
        Você terá um período de arrependimento pra cancelar. Depois disso, todos os
        dados são apagados sem volta. A leitura/exportação seguem disponíveis até lá.
      </p>
      <Button
        variant="danger"
        disabled={pending || confirm.trim().toUpperCase() !== "APAGAR" || !password}
        onClick={handleRequest}
      >
        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
        Excluir minha conta
      </Button>
    </div>
  );
}
