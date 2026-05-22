"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RuleSheet } from "./rule-sheet";

export function NewRuleButton({
  investments,
  destinations,
}: {
  investments: { id: string; ticker: string; name: string }[];
  destinations: { id: string; name: string; institution: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} disabled={investments.length === 0}>
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Nova regra
      </Button>
      <RuleSheet open={open} onOpenChange={setOpen} investments={investments} destinations={destinations} />
    </>
  );
}
