"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhysicalAssetSheet } from "@/components/physical-assets/physical-asset-sheet";
import type { MarriageRegime, Tables } from "@/types/database";

export function NewPhysicalAssetButton({
  filers = [],
  regime = "solteiro",
}: {
  filers?: Tables<"ir_filers">[];
  regime?: MarriageRegime;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Novo bem
      </Button>
      <PhysicalAssetSheet open={open} onOpenChange={setOpen} filers={filers} regime={regime} />
    </>
  );
}
