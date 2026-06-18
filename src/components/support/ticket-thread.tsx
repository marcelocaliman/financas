import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import type { TicketMessage, TicketAuthor } from "@/lib/tickets";

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Lista de mensagens em bolhas — reusada no app, no painel admin e na página pública. */
export function TicketThread({
  messages,
  mySide,
  youLabel,
  supportLabel,
}: {
  messages: TicketMessage[];
  /** Qual autor é "eu" (bolha à direita, acento). */
  mySide: TicketAuthor;
  youLabel: string;
  supportLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = m.author === mySide;
        const who = m.author === "admin" ? supportLabel : youLabel;
        return (
          <div key={m.id} className={cn("flex flex-col max-w-[88%]", mine ? "items-end self-end" : "items-start")}>
            <div
              className={cn(
                "rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words",
                mine ? "bg-accent text-[#0A0B0D]" : "bg-card2 border border-border text-text",
              )}
            >
              {m.body}
            </div>
            <div className="text-[10.5px] text-faint mt-1 px-1 tabular">
              {who} · {fmtTime(m.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Caixa de resposta (textarea + enviar) com nota opcional (aviso de "não-E2EE"). */
export function TicketComposer({
  onSend,
  sending,
  placeholder,
  sendLabel,
  note,
  disabled,
}: {
  onSend: (body: string) => void | Promise<void>;
  sending?: boolean;
  placeholder: string;
  sendLabel: string;
  note?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || sending || disabled) return;
    await onSend(v);
    setText("");
  };
  return (
    <form onSubmit={submit} className="mt-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={disabled || sending}
        className="w-full px-3.5 py-2.5 rounded-[10px] border border-border bg-bg2 text-[14px] text-text outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-[var(--ring)] resize-y disabled:opacity-60"
      />
      {note ? <p className="text-[11px] text-faint mt-1.5 leading-relaxed">{note}</p> : null}
      <div className="flex justify-end mt-2.5">
        <button
          type="submit"
          disabled={disabled || sending || !text.trim()}
          className="inline-flex items-center justify-center h-9 px-4 rounded-[9px] bg-accent text-[#0A0B0D] font-semibold text-[13px] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
        >
          {sending ? "…" : sendLabel}
        </button>
      </div>
    </form>
  );
}
