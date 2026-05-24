"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

/**
 * Componente vazio — ativa sync realtime na tabela accountant_notes.
 * Quando contador adiciona/resolve/apaga anotação, todas as páginas
 * abertas (titular e contador) atualizam via router.refresh().
 */
export function NotesRealtimeSync() {
  useRealtimeRefresh(["accountant_notes"]);
  return null;
}
