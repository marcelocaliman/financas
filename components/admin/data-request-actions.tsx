"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { handleDataRequest } from "@/services/platform-admin.actions";

export function DataRequestActions({
  requestId,
  requestType,
  userId,
  userEmail,
}: {
  requestId: string;
  requestType: "export" | "delete" | "rectify";
  userId: string;
  userEmail: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");

  const handleExport = async () => {
    // Gera link de download admin (export dos dados do user)
    window.open(`/api/admin/export?user_id=${userId}`, "_blank");
  };

  const handleComplete = () => {
    startTransition(async () => {
      const r = await handleDataRequest(requestId, "complete", notes);
      if (r.error) toast.error(r.error);
      else toast.success("Pedido marcado como atendido.");
    });
  };

  const handleReject = () => {
    if (!notes.trim()) {
      toast.error("Motivo da rejeição é obrigatório.");
      return;
    }
    startTransition(async () => {
      const r = await handleDataRequest(requestId, "reject", notes);
      if (r.error) toast.error(r.error);
      else toast.success("Pedido rejeitado.");
    });
  };

  return (
    <div className="space-y-3">
      {requestType === "export" ? (
        <div className="rounded-[10px] bg-bone-100 dark:bg-ink-800 px-4 py-3 text-[12.5px]">
          <p className="text-muted-foreground mb-2">
            1. Baixe o arquivo JSON com todos os dados do usuário.
            <br />
            2. Envie por email seguro pra{" "}
            <b className="text-foreground">{userEmail ?? "—"}</b>.
            <br />
            3. Marque como atendido aqui.
          </p>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" strokeWidth={1.8} />
            Baixar export JSON
          </Button>
        </div>
      ) : null}

      {requestType === "delete" ? (
        <div className="rounded-[10px] bg-rust-100/40 dark:bg-rust-700/15 border border-rust-600/30 px-4 py-3 text-[12.5px]">
          <p className="text-rust-600 mb-1">
            Pedido de eliminação (LGPD art. 18 VI). Antes de apagar:
          </p>
          <ul className="text-muted-foreground space-y-0.5 ml-4 list-disc">
            <li>Confirme identidade do solicitante (email cadastrado vs email do pedido)</li>
            <li>Exporte os dados antes (boa prática + obrigatório se vc tiver retenção fiscal)</li>
            <li>Use a página do usuário pra fazer o hard-delete oficial</li>
          </ul>
        </div>
      ) : null}

      <Textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas internas sobre o atendimento (obrigatório se rejeitar)"
      />

      <div className="flex gap-2">
        <Button variant="primary" disabled={pending} onClick={handleComplete}>
          <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
          Marcar como atendido
        </Button>
        <Button
          variant="outline"
          className="border-rust-600/40 text-rust-600 hover:bg-rust-600/10"
          disabled={pending}
          onClick={handleReject}
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.8} />
          Rejeitar
        </Button>
      </div>
    </div>
  );
}
