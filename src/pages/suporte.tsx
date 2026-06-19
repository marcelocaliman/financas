import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LifeBuoy, Plus, ArrowLeft, ChevronRight, ShieldAlert, Paperclip, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  listMyTickets, getMyThread, createTicket, replyTicket, markTicketRead, ticketMeta, uploadTicketImage,
  TICKET_CATEGORIES, type Ticket, type TicketMessage, type TicketCategory, type TicketAttachment,
} from "@/lib/tickets";
import { useMyTicketStats, refreshMyTicketStats } from "@/hooks/use-my-ticket-stats";
import { TicketThread, TicketComposer } from "@/components/support/ticket-thread";
import { Tile, Eyebrow } from "@/components/common/tile";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { cn } from "@/lib/utils";

function fmtAgo(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/** KPIs do cabeçalho da seção: nº de tickets + respostas não lidas. */
export function SuporteSummary() {
  const { t } = useTranslation();
  const { total, unread } = useMyTicketStats();
  return (
    <HeaderKpis>
      <HeaderKpi label={t("support.kpiTickets")} value={<span className="tabular">{total}</span>} />
      <HeaderKpi secondary tone={unread > 0 ? "accent" : "text"} label={t("support.kpiUnread")} value={<span className="tabular">{unread}</span>} />
    </HeaderKpis>
  );
}

const NOTE_KEY = "support.notE2ee";

export default function Suporte() {
  const [view, setView] = useState<{ mode: "list" | "new" } | { mode: "thread"; id: string }>({ mode: "list" });
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  const reload = useCallback(() => {
    listMyTickets().then(setTickets).catch(() => setTickets([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  if (view.mode === "thread") {
    return <ThreadView id={view.id} onBack={() => { setView({ mode: "list" }); reload(); }} />;
  }
  if (view.mode === "new") {
    return <NewTicket onDone={(id) => { reload(); setView(id ? { mode: "thread", id } : { mode: "list" }); }} onCancel={() => setView({ mode: "list" })} />;
  }
  return <TicketList tickets={tickets} onOpen={(id) => setView({ mode: "thread", id })} onNew={() => setView({ mode: "new" })} />;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const open = status === "open";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
      open ? "text-accent border-accent/30 bg-[var(--accent-soft)]" : "text-muted border-border bg-card2")}>
      {open ? t("support.statusOpen") : t("support.statusClosed")}
    </span>
  );
}

function TicketList({ tickets, onOpen, onNew }: { tickets: Ticket[] | null; onOpen: (id: string) => void; onNew: () => void }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");
  const shown = tickets == null ? null : tickets.filter((tk) => filter === "all" || tk.status === (filter === "open" ? "open" : "closed"));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted leading-relaxed max-w-[58ch]">{t("support.intro")}</p>
        <button type="button" onClick={onNew}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] bg-accent text-[#0A0B0D] font-semibold text-[13px] transition hover:opacity-95">
          <Plus size={15} /> {t("support.new")}
        </button>
      </div>

      {tickets == null ? (
        <div className="text-[13px] text-faint py-6">{t("support.loading")}</div>
      ) : tickets.length === 0 ? (
        <Tile className="p-8 text-center">
          <div className="mx-auto w-11 h-11 grid place-items-center rounded-[12px] bg-card2 text-faint mb-3"><LifeBuoy size={20} /></div>
          <div className="text-[14.5px] font-semibold">{t("support.empty")}</div>
          <div className="text-[13px] text-muted mt-1.5 max-w-[42ch] mx-auto leading-relaxed">{t("support.emptyDesc")}</div>
          <button type="button" onClick={onNew}
            className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] bg-accent text-[#0A0B0D] font-semibold text-[13px] transition hover:opacity-95">
            <Plus size={15} /> {t("support.new")}
          </button>
        </Tile>
      ) : (
        <>
          <div className="flex gap-1.5">
            {(["open", "all", "closed"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={cn("h-8 px-3 rounded-[8px] text-[12.5px] font-medium transition-colors",
                  filter === f ? "bg-accent text-[#0A0B0D]" : "text-muted hover:text-text bg-card2")}>
                {t(`support.tab.${f}`)}
              </button>
            ))}
          </div>
          {!shown || shown.length === 0 ? (
            <div className="text-[13px] text-faint py-8 text-center">{t("support.emptyFilter")}</div>
          ) : (
            <Tile className="divide-y divide-border overflow-hidden">
              {shown.map((tk) => {
                const unread = tk.last_author === "admin" && (!tk.user_read_at || tk.user_read_at < tk.last_message_at);
                return (
                  <button key={tk.id} type="button" onClick={() => onOpen(tk.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-card-hover transition-colors">
                    {unread ? <span className="w-2 h-2 rounded-full bg-accent shrink-0" /> : <span className="w-2 h-2 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium truncate">{tk.subject}</div>
                      <div className="text-[11.5px] text-faint mt-0.5 tabular">{t(`support.cat.${tk.category}`)} · {fmtAgo(tk.last_message_at)}</div>
                    </div>
                    <StatusBadge status={tk.status} />
                    <ChevronRight size={16} className="text-faint shrink-0" />
                  </button>
                );
              })}
            </Tile>
          )}
        </>
      )}
    </div>
  );
}

function NewTicket({ onDone, onCancel }: { onDone: (id?: string) => void; onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("duvida");
  const [message, setMessage] = useState("");
  const [atts, setAtts] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setUploading(true);
    try {
      const a = await uploadTicketImage(file);
      setAtts((p) => [...p, a]);
    } catch {
      setErr(t("support.attachError"));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!subject.trim() || (!message.trim() && atts.length === 0)) return setErr(t("support.errFields"));
    setBusy(true);
    try {
      const { id } = await createTicket({
        subject: subject.trim(), body: message.trim(), category,
        locale: i18n.resolvedLanguage ?? "pt", meta: ticketMeta(), attachments: atts,
      });
      onDone(id);
    } catch {
      setErr(t("support.errSend"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text transition-colors">
        <ArrowLeft size={15} /> {t("support.back")}
      </button>
      <Tile className="p-5 md:p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <span className="block text-[12px] text-muted font-medium mb-1.5">{t("support.subject")}</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("support.subjectPh")} maxLength={200}
              className="w-full h-11 px-3.5 rounded-[10px] border border-border bg-bg2 text-[14px] text-text outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-[var(--ring)]" required />
          </div>
          <div>
            <span className="block text-[12px] text-muted font-medium mb-1.5">{t("support.category")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full h-11 px-3 rounded-[10px] border border-border bg-bg2 text-[14px] text-text outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--ring)]">
              {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`support.cat.${c}`)}</option>)}
            </select>
          </div>
          <div>
            <span className="block text-[12px] text-muted font-medium mb-1.5">{t("support.message")}</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("support.messagePh")} rows={5} maxLength={5000}
              className="w-full px-3.5 py-2.5 rounded-[10px] border border-border bg-bg2 text-[14px] text-text outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-[var(--ring)] resize-y" />
          </div>
          {atts.length ? (
            <div className="flex flex-wrap gap-2">
              {atts.map((a, i) => (
                <div key={i} className="relative">
                  <img src={a.url} alt={a.name} className="h-16 w-16 rounded-[8px] border border-border object-cover" />
                  <button type="button" onClick={() => setAtts((p) => p.filter((_, j) => j !== i))} aria-label="Remover"
                    className="absolute -top-1.5 -right-1.5 grid place-items-center w-5 h-5 rounded-full bg-card border border-border text-faint hover:text-neg transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-start gap-2 rounded-[10px] bg-card2 border border-border px-3 py-2.5">
            <ShieldAlert size={15} className="text-faint shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-faint leading-relaxed">{t(NOTE_KEY)}</p>
          </div>
          {err ? <p className="text-[12.5px] text-neg">{err}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title={t("support.attach")} aria-label={t("support.attach")}
              className="grid place-items-center w-9 h-9 rounded-[9px] border border-border text-faint hover:text-text hover:bg-card-hover transition-colors disabled:opacity-50">
              {uploading ? <span className="text-[13px]">…</span> : <Paperclip size={16} />}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className="h-9 px-3.5 rounded-[9px] border border-border text-[13px] font-medium text-muted hover:text-text hover:bg-card-hover transition">{t("common.cancel")}</button>
              <button type="submit" disabled={busy || uploading} className="inline-flex items-center justify-center h-9 px-4 rounded-[9px] bg-accent text-[#0A0B0D] font-semibold text-[13px] transition hover:opacity-95 disabled:opacity-50">{busy ? "…" : t("support.send")}</button>
            </div>
          </div>
        </form>
      </Tile>
    </div>
  );
}

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const { ticket, messages } = await getMyThread(id);
      setTicket(ticket);
      setMessages(messages);
      void markTicketRead(id).then(refreshMyTicketStats);
    } catch {
      setErr(t("support.errLoad"));
    }
  }, [id, t]);

  useEffect(() => {
    void load();
    // Atualização ao vivo: nova mensagem no ticket chega na hora (RLS garante que é a sua).
    const ch = supabase
      .channel(`ticket:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, load]);

  const send = async (body: string, attachments: TicketAttachment[]) => {
    setSending(true);
    setErr("");
    try {
      await replyTicket(id, body, attachments);
      await load();
    } catch {
      setErr(t("support.errSend"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text transition-colors">
        <ArrowLeft size={15} /> {t("support.back")}
      </button>
      <Tile className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-border">
          <div className="min-w-0">
            <Eyebrow>{ticket ? t(`support.cat.${ticket.category}`) : "—"}</Eyebrow>
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] mt-1 truncate">{ticket?.subject ?? "…"}</h3>
          </div>
          {ticket ? <StatusBadge status={ticket.status} /> : null}
        </div>

        {messages.length === 0 ? (
          <div className="text-[13px] text-faint py-4">{t("support.loading")}</div>
        ) : (
          <TicketThread messages={messages} mySide="user" youLabel={t("support.you")} supportLabel={t("support.team")} />
        )}

        {ticket?.status === "closed" ? (
          <p className="text-[12px] text-faint mt-4 pt-3 border-t border-border">{t("support.closedNote")}</p>
        ) : (
          <TicketComposer onSend={send} onUpload={(f) => uploadTicketImage(f)} sending={sending} placeholder={t("support.replyPh")} sendLabel={t("support.send")} note={t(NOTE_KEY)} attachLabel={t("support.attach")} uploadErrorLabel={t("support.attachError")} />
        )}
        {err ? <p className="text-[12.5px] text-neg mt-2">{err}</p> : null}
      </Tile>
    </div>
  );
}
