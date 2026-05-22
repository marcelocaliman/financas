"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

/**
 * Componente vazio que ativa o hook de realtime no client.
 * Montado no layout autenticado — escuta transactions + accounts.
 */
export function RealtimeBridge() {
  useRealtimeRefresh(["transactions", "accounts"]);
  return null;
}
