"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestDataAccess } from "@/services/lgpd.actions";

export function DeleteAccountForm() {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");

  const handleRequest = () => {
    if (confirm.trim().toUpperCase() !== "APAGAR") {
      toast.error('Digite "APAGAR" pra confirmar.');
      return;
    }
    if (!window.confirm("Confirma o pedido de eliminação da conta?")) return;

    startTransition(async () => {
      const r = await requestDataAccess("delete");
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          "Pedido recebido. Será processado em até 15 dias úteis.",
        );
        setConfirm("");
        setReason("");
      }
    });
  };

  return (
    <div className="space-y-3">
      <Field
        label="Motivo (opcional)"
        htmlFor="deleteReason"
        hint="Vc não é obrigado a justificar — mas se quiser deixar feedback…"
      >
        <Textarea
          id="deleteReason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Não preciso mais, mudei pra outro app, etc."
        />
      </Field>
      <Field
        label={'Digite "APAGAR" pra confirmar'}
        htmlFor="deleteConfirm"
        required
      >
        <Input
          id="deleteConfirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="APAGAR"
        />
      </Field>
      <Button
        variant="danger"
        disabled={pending || confirm.trim().toUpperCase() !== "APAGAR"}
        onClick={handleRequest}
      >
        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
        Solicitar eliminação da conta
      </Button>
    </div>
  );
}
