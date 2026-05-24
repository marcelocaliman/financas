"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportDataButton() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/me/export");
      if (!res.ok) throw new Error("Falha ao exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financas-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Arquivo baixado!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button variant="primary" onClick={handleDownload} disabled={downloading}>
      <Download className="w-3.5 h-3.5" strokeWidth={1.8} />
      {downloading ? "Baixando…" : "Baixar JSON com todos meus dados"}
    </Button>
  );
}
