"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalSheet } from "./goal-sheet";

export function NewGoalButton({
  accounts,
  investments = [],
}: {
  accounts: { id: string; name: string; institution: string }[];
  investments?: { id: string; ticker: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Nova meta
      </Button>
      <GoalSheet
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        investments={investments}
      />
    </>
  );
}
