"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackupButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        window.location.href = "/api/me/backup";
      }}
    >
      <Download className="w-3.5 h-3.5" strokeWidth={1.7} />
      Baixar backup JSON
    </Button>
  );
}
