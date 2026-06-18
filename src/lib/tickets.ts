import { supabase } from "@/lib/supabase";

// Tickets de suporte (texto claro — NÃO é o cofre E2EE). Usuário lê só os próprios (RLS);
// escrita via /api/ticket (service_role). Ver supabase/migrations/..._support_tickets.sql.

export type TicketStatus = "open" | "closed";
export type TicketAuthor = "user" | "admin";
export type TicketCategory = "duvida" | "problema" | "sugestao" | "conta" | "outro";
export const TICKET_CATEGORIES: TicketCategory[] = ["duvida", "problema", "sugestao", "conta", "outro"];

export interface TicketMessage {
  id: string;
  author: TicketAuthor;
  body: string;
  created_at: string;
}
export interface Ticket {
  id: string;
  email: string;
  name: string | null;
  subject: string;
  category: string;
  status: TicketStatus;
  surface: string;
  last_author: TicketAuthor;
  user_read_at: string | null;
  last_message_at: string;
  created_at: string;
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function callApi(action: string, init: RequestInit): Promise<Record<string, unknown>> {
  const tok = await accessToken();
  const res = await fetch(`/api/ticket?action=${action}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error || "request_failed"));
  return data;
}

export interface NewTicketInput {
  subject: string;
  body: string;
  category: TicketCategory;
  locale?: string;
  meta?: Record<string, unknown>;
}

export function createTicket(input: NewTicketInput): Promise<{ id: string }> {
  return callApi("create", { method: "POST", body: JSON.stringify(input) }) as Promise<{ id: string }>;
}

export async function replyTicket(ticketId: string, body: string): Promise<void> {
  await callApi("reply", { method: "POST", body: JSON.stringify({ ticket_id: ticketId, body }) });
}

const COLS = "id,email,name,subject,category,status,surface,last_author,user_read_at,last_message_at,created_at";

export async function listMyTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select(COLS)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

export async function getMyThread(ticketId: string): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  const { data, error } = await supabase
    .from("tickets")
    .select(`${COLS}, ticket_messages(id,author,body,created_at)`)
    .eq("id", ticketId)
    .single();
  if (error) throw error;
  const { ticket_messages, ...ticket } = data as Ticket & { ticket_messages?: TicketMessage[] };
  const messages = (ticket_messages ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { ticket: ticket as Ticket, messages };
}

export async function markTicketRead(ticketId: string): Promise<void> {
  await supabase.rpc("ticket_mark_read", { p_id: ticketId });
}

/** Tickets com resposta NOVA do suporte ainda não lida — para o badge in-app. */
export function unreadCount(tickets: Ticket[]): number {
  return tickets.filter(
    (t) => t.last_author === "admin" && (!t.user_read_at || t.user_read_at < t.last_message_at),
  ).length;
}

/** Coleta contexto técnico NÃO-sensível pra anexar ao ticket (ajuda no debug; nunca financeiro). */
export function ticketMeta(): Record<string, string> {
  const m: Record<string, string> = {};
  try {
    m.app_version = (import.meta.env.VITE_APP_VERSION as string) || "web";
    m.ua = navigator.userAgent.slice(0, 160);
    m.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    m.screen = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  } catch {
    /* best-effort */
  }
  return m;
}
