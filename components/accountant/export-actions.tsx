"use client";

import { useTransition } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AccountantExportActions({
  year,
  householdId,
  hasCpf,
}: {
  year: number;
  householdId: string;
  hasCpf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const downloadBlob = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: "dec" | "txt") => {
    if (format === "dec" && !hasCpf) {
      toast.error(
        "CPF do titular não cadastrado. Solicite ao cliente preencher.",
      );
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/ir/export?year=${year}&format=${format}&householdId=${householdId}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro" }));
          toast.error(err.error ?? "Falha");
          return;
        }
        const data = await res.json();
        const filename = format === "dec" ? data.filename : `IRPF_${year}_relatorio.txt`;
        const mime = format === "dec" ? "application/octet-stream" : "text/plain";
        const content = format === "dec" ? data.content : data.humanReadable;
        downloadBlob(filename, content, mime);
        toast.success("Arquivo baixado (com marca d'água).");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha";
        toast.error(msg);
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => handleExport("txt")} disabled={pending}>
        <FileText className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.7} />
        Relatório TXT
      </Button>
      <Button variant="primary" size="sm" onClick={() => handleExport("dec")} disabled={pending || !hasCpf}>
        <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.7} />
        Arquivo .DEC
      </Button>
    </div>
  );
}
