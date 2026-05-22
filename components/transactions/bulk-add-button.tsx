"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkAddSheet } from "./bulk-add-sheet";
import type { Currency } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

export function BulkAddButton({
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
        Adicionar várias
      </Button>
      <BulkAddSheet
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
