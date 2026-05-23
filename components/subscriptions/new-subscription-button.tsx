"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecurrenceSheet } from "@/components/recurrences/recurrence-sheet";
import type { Currency } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

/**
 * Botão "Nova assinatura" pra /assinaturas. Abre o mesmo RecurrenceSheet
 * mas com kind=expense pré-selecionado e o toggle "É assinatura" pré-marcado
 * via prop `defaultIsSubscription`.
 *
 * O usuário pode mudar o kind se quiser — sem fricção, mas o caminho feliz
 * é "preencher e salvar".
 */
export function NewSubscriptionButton({
  accounts,
  categories,
}: {
  accounts: AccountLite[];
  categories: CategoryLite[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
        Nova assinatura
      </Button>
      <RecurrenceSheet
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        categories={categories}
        defaultIsSubscription
      />
    </>
  );
}
