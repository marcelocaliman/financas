"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadAndExtractAction } from "@/app/(app)/inbox/_actions/upload";

type DocType =
  | "auto"
  | "fatura_cartao"
  | "holerite"
  | "nota_corretagem"
  | "recibo_medico"
  | "boleto"
  | "extrato_bancario";

const TYPE_OPTIONS: Array<{ value: DocType; label: string }> = [
  { value: "auto", label: "Detectar automaticamente" },
  { value: "fatura_cartao", label: "Fatura de cartão" },
  { value: "holerite", label: "Holerite / contracheque" },
  { value: "nota_corretagem", label: "Nota de corretagem" },
  { value: "recibo_medico", label: "Recibo médico / saúde" },
  { value: "boleto", label: "Boleto" },
  { value: "extrato_bancario", label: "Extrato bancário" },
];

const ACCEPTED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "text/csv",
  "text/plain",
];

export function InboxDropzone({
  disabled,
  remainingThisMonth,
}: {
  disabled?: boolean;
  remainingThisMonth: number;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const [docType, setDocType] = useState<DocType>("auto");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = (file: File) => {
    if (!ACCEPTED_MIME.some((m) => file.type === m || file.type.startsWith("image/"))) {
      toast.error("Tipo de arquivo não suportado.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      if (docType !== "auto") fd.append("forceType", docType);
      const r = await uploadAndExtractAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.documentId) {
        toast.success("Documento processado.");
        router.push(`/inbox/${r.documentId}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Seletor de tipo — força a IA a usar esse schema, ignorando classificação */}
      <div className="flex items-center gap-2">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
          Tipo do documento
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
          disabled={pending}
          className="text-[12.5px] bg-surface border border-border rounded-[6px] px-2.5 py-1.5"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {docType !== "auto" ? (
          <span className="font-mono text-[10.5px] text-olive-700 dark:text-olive-300">
            ✓ tipo travado — IA não vai reclassificar
          </span>
        ) : null}
      </div>

    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => !disabled && !pending && inputRef.current?.click()}
      className={`rounded-[12px] border-2 border-dashed transition-all p-10 text-center cursor-pointer ${
        disabled
          ? "border-border bg-surface-muted/30 cursor-not-allowed opacity-50"
          : dragOver
            ? "border-navy-700 bg-navy-50 dark:bg-navy-900/20 scale-[1.01]"
            : "border-border-strong bg-surface hover:bg-surface-muted/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {pending ? (
        <>
          <Loader2 className="w-8 h-8 text-navy-700 dark:text-navy-300 animate-spin mx-auto mb-3" strokeWidth={1.5} />
          <div className="font-display text-[17px] text-foreground">Lendo o documento…</div>
          <p className="text-[12.5px] text-muted-foreground mt-1.5">
            Isso pode demorar 5-30 segundos. Não feche a página.
          </p>
        </>
      ) : (
        <>
          <Upload className="w-8 h-8 text-faint-foreground mx-auto mb-3 opacity-70" strokeWidth={1.5} />
          <div className="font-display text-[17px] text-foreground">
            {disabled ? "Indisponível" : "Solte um documento aqui ou clique pra escolher"}
          </div>
          <p className="text-[12.5px] text-muted-foreground mt-1.5">
            PDF, foto (JPG/PNG/HEIC), CSV. Máx 15 MB.{" "}
            {remainingThisMonth > 0 ? (
              <span>{remainingThisMonth} restantes este mês.</span>
            ) : (
              <span className="text-rust-600">Limite mensal atingido.</span>
            )}
          </p>
        </>
      )}
    </div>
    </div>
  );
}
