"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSheet } from "@/components/accounts/account-sheet";
import type { MarriageRegime, Tables } from "@/types/database";

export function NewAccountButton({
  variant = "primary",
  label = "Nova conta",
  filers = [],
  regime = "solteiro",
}: {
  variant?: "primary" | "white";
  label?: string;
  filers?: Tables<"ir_filers">[];
  regime?: MarriageRegime;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "white" ? (
        <Button
          variant="primary"
          size="lg"
          onClick={() => setOpen(true)}
          className="!bg-white !text-ink-950 !border-white hover:!bg-bone-100 hover:!border-bone-100"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          {label}
        </Button>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          {label}
        </Button>
      )}
      <AccountSheet open={open} onOpenChange={setOpen} filers={filers} regime={regime} />
    </>
  );
}
