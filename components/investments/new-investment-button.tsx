"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvestmentSheet } from "./investment-sheet";

export function NewInvestmentButton({
  investmentAccounts,
}: {
  investmentAccounts: { id: string; name: string; institution: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Novo ativo
      </Button>
      <InvestmentSheet
        open={open}
        onOpenChange={setOpen}
        investmentAccounts={investmentAccounts}
      />
    </>
  );
}
