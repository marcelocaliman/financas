import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, LifeBuoy } from "lucide-react";
import { TicketThread, TicketComposer } from "@/components/support/ticket-thread";
import type { TicketMessage } from "@/lib/tickets";

// Página PÚBLICA (sem conta): o convidado acompanha e responde o ticket pelo link rastreável
// (/ticket?t=TOKEN). Fala só com /api/ticket (token), nunca com o Supabase direto.

interface PublicTicket {
  id: string;
  subject: string;
  status: string;
  category: string;
  created_at: string;
}

const LANG = (() => {
  const l = (navigator.language || "pt").toLowerCase();
  return l.startsWith("en") ? "en" : l.startsWith("it") ? "it" : "pt";
})();

const T: Record<string, Record<string, string>> = {
  pt: {
    title: "Acompanhe o seu ticket", you: "Você", team: "Suporte", send: "Responder",
    replyPh: "Escreva uma resposta…", loading: "Carregando…",
    notFound: "Ticket não encontrado. Confira o link que enviamos por e-mail.",
    closed: "Este ticket foi marcado como resolvido.",
    open: "Aberto", resolved: "Resolvido", errSend: "Não foi possível enviar. Tente de novo.",
    note: "As mensagens não são cifradas de ponta a ponta — não inclua senha nem números de conta.",
    back: "Ir para o site",
  },
  en: {
    title: "Track your ticket", you: "You", team: "Support", send: "Reply",
    replyPh: "Write a reply…", loading: "Loading…",
    notFound: "Ticket not found. Check the link we emailed you.",
    closed: "This ticket was marked resolved.",
    open: "Open", resolved: "Resolved", errSend: "Couldn't send. Try again.",
    note: "Messages aren't end-to-end encrypted — don't include passwords or account numbers.",
    back: "Go to the site",
  },
  it: {
    title: "Segui il tuo ticket", you: "Tu", team: "Supporto", send: "Rispondi",
    replyPh: "Scrivi una risposta…", loading: "Caricamento…",
    notFound: "Ticket non trovato. Controlla il link che ti abbiamo inviato via email.",
    closed: "Questo ticket è stato segnato come risolto.",
    open: "Aperto", resolved: "Risolto", errSend: "Invio non riuscito. Riprova.",
    note: "I messaggi non sono cifrati end-to-end — non includere password o numeri di conto.",
    back: "Vai al sito",
  },
};
const t = (k: string) => T[LANG][k] ?? T.pt[k] ?? k;

function token(): string {
  try {
    return new URLSearchParams(window.location.search).get("t") || "";
  } catch {
    return "";
  }
}

export function TicketPublicPage() {
  const tk = token();
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!tk) { setState("notfound"); return; }
    try {
      const r = await fetch(`/api/ticket?action=get&t=${encodeURIComponent(tk)}`);
      if (!r.ok) { setState("notfound"); return; }
      const d = await r.json();
      setTicket(d.ticket);
      setMessages(Array.isArray(d.messages) ? d.messages : []);
      setState("ok");
    } catch {
      setState("notfound");
    }
  }, [tk]);

  useEffect(() => { void load(); }, [load]);

  const send = async (body: string) => {
    setSending(true);
    setErr("");
    try {
      const r = await fetch(`/api/ticket?action=reply&t=${encodeURIComponent(tk)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error("send_failed");
      await load();
    } catch {
      setErr(t("errSend"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text grid place-items-start sm:place-items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-[560px]">
        <a href="/" className="flex items-center gap-2.5 mb-6">
          <span className="grid place-items-center w-[32px] h-[32px] rounded-[9px] bg-accent text-[#0A0B0D]">
            <ArrowLeftRight size={16} strokeWidth={2.5} />
          </span>
          <span className="font-semibold text-[15.5px] tracking-[-0.02em]">Nossas Finanças</span>
        </a>

        <div className="rounded-[18px] border border-border bg-card p-5 sm:p-6 shadow-[var(--shadow-card)]">
          {state === "loading" ? (
            <div className="py-10 text-center text-[13px] text-faint">{t("loading")}</div>
          ) : state === "notfound" ? (
            <div className="py-10 text-center">
              <div className="mx-auto w-11 h-11 grid place-items-center rounded-[12px] bg-card2 text-faint mb-3"><LifeBuoy size={20} /></div>
              <p className="text-[13.5px] text-muted max-w-[40ch] mx-auto leading-relaxed">{t("notFound")}</p>
            </div>
          ) : ticket ? (
            <>
              <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-border">
                <div className="min-w-0">
                  <div className="eyebrow">{t("title")}</div>
                  <h1 className="text-[17px] font-semibold tracking-[-0.01em] mt-1.5 break-words">{ticket.subject}</h1>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium shrink-0 ${ticket.status === "open" ? "text-accent border-accent/30 bg-[var(--accent-soft)]" : "text-muted border-border bg-card2"}`}>
                  {ticket.status === "open" ? t("open") : t("resolved")}
                </span>
              </div>

              <TicketThread messages={messages} mySide="user" youLabel={t("you")} supportLabel={t("team")} />

              {ticket.status === "closed" ? (
                <p className="text-[12px] text-faint mt-4 pt-3 border-t border-border">{t("closed")}</p>
              ) : (
                <TicketComposer onSend={send} sending={sending} placeholder={t("replyPh")} sendLabel={t("send")} note={t("note")} />
              )}
              {err ? <p className="text-[12.5px] text-neg mt-2">{err}</p> : null}
            </>
          ) : null}
        </div>

        <div className="text-center mt-5">
          <a href="/" className="text-[12.5px] text-faint hover:text-muted transition-colors">{t("back")} →</a>
        </div>
      </div>
    </div>
  );
}
