"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, FileCheck2, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  uploadReceipt,
  deleteReceipt,
  getReceiptSignedUrl,
} from "@/services/ir/receipts.actions";

/**
 * Botão compacto pra anexar/baixar/remover recibo de um pagamento dedutível.
 * Estados: sem anexo → mostra "Anexar"; com anexo → "Ver" + "Remover".
 */
export function ReceiptUploader({
  deductibleId,
  year,
  hasReceipt,
  mimeType,
}: {
  deductibleId: string;
  year: number;
  hasReceipt: boolean;
  mimeType?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [localHasReceipt, setLocalHasReceipt] = useState(hasReceipt);

  function handlePick() {
    inputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("deductibleId", deductibleId);
    fd.set("year", String(year));
    startTransition(async () => {
      const r = await uploadReceipt(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Recibo anexado.");
        setLocalHasReceipt(true);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function handleView() {
    startTransition(async () => {
      const r = await getReceiptSignedUrl(deductibleId);
      if (r.error || !r.url) {
        toast.error(r.error ?? "URL inválida.");
        return;
      }
      window.open(r.url, "_blank", "noopener,noreferrer");
    });
  }

  function handleDelete() {
    if (!confirm("Remover o recibo anexado?")) return;
    startTransition(async () => {
      const r = await deleteReceipt(deductibleId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Recibo removido.");
        setLocalHasReceipt(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={handleFile}
      />
      {localHasReceipt ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleView}
            disabled={pending}
            title={mimeType ?? ""}
          >
            <FileCheck2 className="w-3.5 h-3.5 mr-1 text-olive-700 dark:text-olive-200" strokeWidth={1.7} />
            <Download className="w-3 h-3" strokeWidth={1.7} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            disabled={pending}
            className="text-rust-600"
            aria-label="Remover recibo"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={handlePick}
          disabled={pending}
          className="text-faint-foreground hover:text-foreground"
        >
          <Paperclip className="w-3.5 h-3.5 mr-1" strokeWidth={1.7} />
          {pending ? "Subindo…" : "Recibo"}
        </Button>
      )}
    </div>
  );
}
