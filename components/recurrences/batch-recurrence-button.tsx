"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchRecurrenceSheet } from "./batch-recurrence-sheet";
import type { Currency } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

export function BatchRecurrenceButton({
  accounts,
  categories,
}: {
  accounts: AccountLite[];
  categories: CategoryLite[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Layers className="w-3.5 h-3.5" strokeWidth={1.7} />
        Criar várias
      </Button>
      <BatchRecurrenceSheet
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
