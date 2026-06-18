import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { listMyTickets, unreadCount } from "@/lib/tickets";

// Contagem dos tickets do usuário + quantos têm resposta NOVA do suporte ainda não lida — em
// tempo real. Singleton ref-contado com carência (igual aos de presença): UM canal compartilhado
// pelo badge do menu e pelo resumo da seção. RLS garante que só vêm os tickets do próprio usuário.

interface Stats {
  total: number;
  unread: number;
}
const EMPTY: Stats = { total: 0, unread: 0 };

let state: Stats = EMPTY;
const listeners = new Set<(s: Stats) => void>();
let channel: RealtimeChannel | null = null;
let safety: ReturnType<typeof setInterval> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
let grace: ReturnType<typeof setTimeout> | null = null;
let refs = 0;

function refresh() {
  listMyTickets()
    .then((t) => {
      state = { total: t.length, unread: unreadCount(t) };
      listeners.forEach((l) => l(state));
    })
    .catch(() => {});
}
function bump() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(refresh, 300);
}
function start() {
  refresh();
  channel = supabase
    .channel("my:tickets")
    .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, bump)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, bump)
    .subscribe();
  safety = setInterval(refresh, 60_000);
}
function stop() {
  if (channel) { void supabase.removeChannel(channel); channel = null; }
  if (safety) { clearInterval(safety); safety = null; }
  if (debounce) { clearTimeout(debounce); debounce = null; }
}
function scheduleStop() {
  if (grace) clearTimeout(grace);
  grace = setTimeout(() => { grace = null; if (refs === 0) stop(); }, 3000);
}

/** { total, unread } dos tickets do usuário, em tempo real. */
export function useMyTicketStats(): Stats {
  const [s, setS] = useState<Stats>(state);
  useEffect(() => {
    const l = (ns: Stats) => setS(ns);
    listeners.add(l);
    if (grace) { clearTimeout(grace); grace = null; }
    if (refs++ === 0 && !channel) start();
    else setS(state);
    return () => {
      listeners.delete(l);
      if (--refs === 0) scheduleStop();
    };
  }, []);
  return s;
}
