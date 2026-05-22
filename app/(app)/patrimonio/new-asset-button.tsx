"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhysicalAssetSheet } from "@/components/physical-assets/physical-asset-sheet";

export function NewPhysicalAssetButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Novo bem
      </Button>
      <PhysicalAssetSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
