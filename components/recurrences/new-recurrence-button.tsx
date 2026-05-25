"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecurrenceSheet } from "./recurrence-sheet";
import type { Currency, Tables } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };
type FonteLite = Pick<Tables<"fontes_pagadoras">, "id" | "type" | "name" | "cnpj" | "cpf">;

export function NewRecurrenceButton({
  accounts,
  categories,
  fontes = [],
}: {
  accounts: AccountLite[];
  categories: CategoryLite[];
  fontes?: FonteLite[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
        Nova recorrência
      </Button>
      <RecurrenceSheet
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        categories={categories}
        fontes={fontes}
      />
    </>
  );
}
