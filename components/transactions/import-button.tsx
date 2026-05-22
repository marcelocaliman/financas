"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportTransactionsDialog } from "./import-dialog";

export function ImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="w-3.5 h-3.5" strokeWidth={1.7} />
        Importar
      </Button>
      <ImportTransactionsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
