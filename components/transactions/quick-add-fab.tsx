"use client";

import { Plus } from "lucide-react";
import { useQuickAdd } from "./quick-add-context";

/**
 * Floating Action Button — botão flutuante "+" sempre visível em desktop.
 * No mobile o lugar é o botão central do MobileNav (esconde com lg:flex).
 *
 * Abre o modal de transação rápida (mesmo comportamento de ⌘K).
 */
export function QuickAddFAB() {
  const { show } = useQuickAdd();
  return (
    <button
      type="button"
      onClick={() => show("expense")}
      aria-label="Adicionar transação (⌘K)"
      className="hidden lg:flex fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-ink-950 text-white items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:bg-ink-900 transition-[transform,box-shadow,background-color] duration-200 group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500"
    >
      <Plus
        className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90"
        strokeWidth={1.8}
      />
      <span className="absolute right-full mr-3 px-2.5 py-1.5 rounded-[6px] bg-ink-950 text-white text-[11.5px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
        Adicionar
        <span className="font-mono ml-2 text-navy-300 text-[10px]">⌘K</span>
      </span>
    </button>
  );
}
