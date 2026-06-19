import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { adminApi } from "./api";
import { supabase } from "@/lib/supabase";
import type { RecentEvent, OnlinePresence, AdminTicketCounts } from "./types";

// Realtime via Postgres Changes (admin-push): o painel do DONO assina as mudanças das tabelas
// e reconta na hora. O heartbeat (serverless) continua sendo a fonte da verdade; aqui só
// ESCUTAMOS. A rede de segurança cobre o que não vira evento (sessão que envelhece sem 'bye',
// reconexão do websocket). Os casos comuns — entrar (INSERT) e sair via 'bye' (DELETE) — chegam
// na hora. Cada fonte é um SINGLETON ref-contado: UM canal por tópico (vários componentes
// consomem o mesmo), o que evita o bug de canais duplicados que travava o cliente Realtime.
const SAFETY_MS = 25_000;
const EMPTY_PRESENCE: OnlinePresence = { app: 0, landing: 0, total: 0 };

/* ── "Online agora" ──────────────────────────────────────────────────────────── */
let pState: OnlinePresence = EMPTY_PRESENCE;
const pListeners = new Set<(p: OnlinePresence) => void>();
let pChannel: RealtimeChannel | null = null;
let pSafety: ReturnType<typeof setInterval> | null = null;
let pDebounce: ReturnType<typeof setTimeout> | null = null;
let pGrace: ReturnType<typeof setTimeout> | null = null;
let pRefs = 0;

function pRefresh() {
  adminApi.online().then((d) => { if (d) { pState = d; pListeners.forEach((l) => l(pState)); } }).catch(() => {});
}
function pBump() { if (pDebounce) clearTimeout(pDebounce); pDebounce = setTimeout(pRefresh, 250); } // coalesce rajadas
function pStart() {
  pRefresh();
  pChannel = supabase
    .channel("admin:presence")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "presence" }, pBump)
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "presence" }, pBump)
    .subscribe();
  pSafety = setInterval(pRefresh, SAFETY_MS);
}
function pStop() {
  if (pChannel) { void supabase.removeChannel(pChannel); pChannel = null; }
  if (pSafety) { clearInterval(pSafety); pSafety = null; }
  if (pDebounce) { clearTimeout(pDebounce); pDebounce = null; }
}
// Carência no teardown: trocar o layout do menu (recolher/expandir) desmonta e remonta o
// consumidor num piscar. Sem isso, fecharíamos e reabriríamos o canal na hora (churn / risco do
// bug de canal duplicado). Se ninguém voltar em 3s, aí sim desliga de fato.
function pScheduleStop() {
  if (pGrace) clearTimeout(pGrace);
  pGrace = setTimeout(() => { pGrace = null; if (pRefs === 0) pStop(); }, 3000);
}

/** "Online agora" por superfície (app/landing), em tempo real. Só o painel do dono assina
 *  (RLS is_admin) e reconta — a métrica segue privada e nenhum usuário abre conexão. */
export function useOnlinePresence(): OnlinePresence {
  const [p, setP] = useState<OnlinePresence>(pState);
  useEffect(() => {
    const l = (np: OnlinePresence) => setP(np);
    pListeners.add(l);
    if (pGrace) { clearTimeout(pGrace); pGrace = null; } // cancela um teardown em carência
    if (pRefs++ === 0 && !pChannel) pStart(); // só (re)inicia se o canal não está vivo
    else setP(pState); // já há estado quente
    return () => {
      pListeners.delete(l);
      if (--pRefs === 0) pScheduleStop();
    };
  }, []);
  return p;
}

/* ── Feed de atividade recente ─────────────────────────────────────────────────
   app_events já está no Realtime (policy de admin). Novo evento = INSERT → atualiza. */
let eState: RecentEvent[] = [];
const eListeners = new Set<(e: RecentEvent[]) => void>();
let eChannel: RealtimeChannel | null = null;
let eSafety: ReturnType<typeof setInterval> | null = null;
let eDebounce: ReturnType<typeof setTimeout> | null = null;
let eRefs = 0;

function eRefresh() {
  adminApi.recentEvents(40).then((rows) => { eState = rows ?? []; eListeners.forEach((l) => l(eState)); }).catch(() => {});
}
function eBump() { if (eDebounce) clearTimeout(eDebounce); eDebounce = setTimeout(eRefresh, 250); }
function eStart() {
  eRefresh();
  eChannel = supabase
    .channel("admin:events")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_events" }, eBump)
    .subscribe();
  eSafety = setInterval(eRefresh, 30_000);
}
function eStop() {
  if (eChannel) { void supabase.removeChannel(eChannel); eChannel = null; }
  if (eSafety) { clearInterval(eSafety); eSafety = null; }
  if (eDebounce) { clearTimeout(eDebounce); eDebounce = null; }
}

/** Feed de atividade recente (anônimo) em tempo real — novos eventos chegam na hora. */
export function useLiveEvents(limit = 24): RecentEvent[] {
  const [events, setEvents] = useState<RecentEvent[]>(eState);
  useEffect(() => {
    const l = (e: RecentEvent[]) => setEvents(e);
    eListeners.add(l);
    if (eRefs++ === 0) eStart();
    else setEvents(eState);
    return () => {
      eListeners.delete(l);
      if (--eRefs === 0) eStop();
    };
  }, []);
  return events.slice(0, limit);
}

/* ── Contadores de tickets do dono (total/abertos/não-lidos/novos) em tempo real ──
   Recontagem via admin_tickets_counts() ao mudar tickets/ticket_messages. Singleton
   ref-contado com carência. `unread` LIMPA ao ler (admin_read_at). */
const TK_EMPTY: AdminTicketCounts = { total: 0, open: 0, unread: 0, novos: 0 };
let tkState: AdminTicketCounts = TK_EMPTY;
const tkListeners = new Set<(c: AdminTicketCounts) => void>();
let tkChannel: RealtimeChannel | null = null;
let tkSafety: ReturnType<typeof setInterval> | null = null;
let tkDebounce: ReturnType<typeof setTimeout> | null = null;
let tkGrace: ReturnType<typeof setTimeout> | null = null;
let tkRefs = 0;

function tkRefresh() {
  adminApi.ticketsCounts().then((c) => { if (c) { tkState = c; tkListeners.forEach((l) => l(tkState)); } }).catch(() => {});
}
function tkBump() { if (tkDebounce) clearTimeout(tkDebounce); tkDebounce = setTimeout(tkRefresh, 300); }
function tkStart() {
  tkRefresh();
  tkChannel = supabase
    .channel("admin:tickets")
    .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, tkBump)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, tkBump)
    .subscribe();
  tkSafety = setInterval(tkRefresh, 40_000);
}
function tkStop() {
  if (tkChannel) { void supabase.removeChannel(tkChannel); tkChannel = null; }
  if (tkSafety) { clearInterval(tkSafety); tkSafety = null; }
  if (tkDebounce) { clearTimeout(tkDebounce); tkDebounce = null; }
}
function tkScheduleStop() {
  if (tkGrace) clearTimeout(tkGrace);
  tkGrace = setTimeout(() => { tkGrace = null; if (tkRefs === 0) tkStop(); }, 3000);
}

/** Força um recálculo imediato dos contadores (ex.: logo após o dono LER um ticket). */
export function refreshTicketsCounts() {
  if (tkChannel) tkRefresh();
}

/** Contadores de tickets do dono (total/abertos/não-lidos/novos), em tempo real. */
export function useTicketsCounts(): AdminTicketCounts {
  const [c, setC] = useState<AdminTicketCounts>(tkState);
  useEffect(() => {
    const l = (nc: AdminTicketCounts) => setC(nc);
    tkListeners.add(l);
    if (tkGrace) { clearTimeout(tkGrace); tkGrace = null; }
    if (tkRefs++ === 0 && !tkChannel) tkStart();
    else setC(tkState);
    return () => {
      tkListeners.delete(l);
      if (--tkRefs === 0) tkScheduleStop();
    };
  }, []);
  return c;
}

/** Atalho: só o nº de não-lidos (para o selo do menu). */
export function useTicketsUnread(): number {
  return useTicketsCounts().unread;
}
