"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebtSheet } from "./debt-sheet";
import type { MarriageRegime, Tables } from "@/types/database";

export function NewDebtButton({
  assets = [],
  filers = [],
  regime = "solteiro",
}: {
  assets?: Pick<Tables<"physical_assets">, "id" | "name" | "category">[];
  filers?: Tables<"ir_filers">[];
  regime?: MarriageRegime;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Nova dívida
      </Button>
      <DebtSheet open={open} onOpenChange={setOpen} assets={assets} filers={filers} regime={regime} />
    </>
  );
}
