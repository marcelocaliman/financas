"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "./quick-add-context";

export function QuickAddTrigger({
  variant = "primary",
  label = "Adicionar",
  size = "md",
  kind,
}: {
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
  size?: "sm" | "md" | "lg";
  kind?: "expense" | "income" | "transfer";
}) {
  const { show } = useQuickAdd();
  return (
    <Button variant={variant} size={size} onClick={() => show(kind)}>
      <Plus className="w-3.5 h-3.5" strokeWidth={2} />
      {label}
    </Button>
  );
}
