"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, FileText, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  uploadTransactionReceipt,
  deleteTransactionReceipt,
  getTransactionReceiptUrl,
} from "@/services/transaction-receipts.actions";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic";

export function ReceiptUploader({
  transactionId,
  initialPath,
  initialMime,
  initialSize,
}: {
  transactionId: string;
  initialPath: string | null;
  initialMime: string | null;
  initialSize: number | null;
}) {
  const [hasReceipt, setHasReceipt] = useState(!!initialPath);
  const [mime, setMime] = useState(initialMime);
  const [size, setSize] = useState(initialSize);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const handleUpload = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("transactionId", transactionId);
    startTransition(async () => {
      const r = await uploadTransactionReceipt(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Comprovante anexado.");
      setHasReceipt(true);
      setMime(file.type);
      setSize(file.size);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const r = await deleteTransactionReceipt(transactionId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Comprovante removido.");
        setHasReceipt(false);
      }
    });
  };

  const handleDownload = async () => {
    const r = await getTransactionReceiptUrl(transactionId);
    if (r.error || !r.url) {
      toast.error(r.error ?? "Falha ao gerar link.");
      return;
    }
    window.open(r.url, "_blank");
  };

  const sizeLabel = size ? `${(size / 1024).toFixed(0)} KB` : "";

  return (
    <div className="border border-border rounded-[8px] p-3 bg-bone-100/50 dark:bg-ink-800/40 space-y-2">
      <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
        <Paperclip className="w-3.5 h-3.5" strokeWidth={1.7} />
        Comprovante
      </div>
      {hasReceipt ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 text-[13px] text-foreground hover:text-navy-700 dark:hover:text-navy-300 min-w-0 flex-1"
          >
            <FileText className="w-4 h-4 shrink-0" strokeWidth={1.7} />
            <span className="truncate">
              {mime?.startsWith("image/") ? "Imagem" : "PDF"} · {sizeLabel}
            </span>
            <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="p-1.5 rounded text-faint-foreground hover:text-rust-600"
            aria-label="Remover"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="w-full py-2 border border-dashed border-border rounded-[6px] text-[12.5px] text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
          >
            {pending ? "Enviando…" : "Anexar PDF ou foto (≤10 MB)"}
          </button>
        </>
      )}
    </div>
  );
}
