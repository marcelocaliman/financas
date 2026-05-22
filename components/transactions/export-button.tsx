"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ExportButton() {
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      const url = `/api/transactions/export?${params.toString()}`;
      try {
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) {
          toast.error("Falha ao exportar.");
          return;
        }
        const blob = await r.blob();
        const filename =
          r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
          "transacoes.csv";
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        toast.success("CSV exportado.");
      } catch (err) {
        toast.error(`Erro: ${err instanceof Error ? err.message : "desconhecido"}`);
      }
    });
  };

  return (
    <Button variant="secondary" onClick={handle} disabled={pending}>
      <Download className="w-3.5 h-3.5" strokeWidth={1.7} />
      {pending ? "Exportando…" : "Exportar"}
    </Button>
  );
}
