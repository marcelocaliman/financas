import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { adminApi } from "./api";
import { supabase } from "@/lib/supabase";
import type { RecentEvent, OnlinePresence } from "./types";

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
