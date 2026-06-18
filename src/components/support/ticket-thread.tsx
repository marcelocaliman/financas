import { useEffect, useRef, useState, type FormEvent } from "react";
import { Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketMessage, TicketAuthor, TicketAttachment } from "@/lib/tickets";

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Lista de mensagens em bolhas (texto + imagens) — reusada no app, no painel e na página pública. */
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
  // Altura limitada (~8 mensagens) + scroll, ancorando sempre na última (comportamento de chat),
  // pra a conversa não crescer sem fim e empurrar a caixa de resposta.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
  return (
    <div ref={scrollRef} className="flex flex-col gap-3 max-h-[480px] overflow-y-auto scrollbar-subtle pr-1">
      {messages.map((m) => {
        const mine = m.author === mySide;
        const who = m.author === "admin" ? supportLabel : youLabel;
        return (
          <div key={m.id} className={cn("flex flex-col gap-1.5 max-w-[88%]", mine ? "items-end self-end" : "items-start")}>
            {m.body ? (
              <div
                className={cn(
                  "rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words",
                  mine ? "bg-accent text-[#0A0B0D]" : "bg-card2 border border-border text-text",
                )}
              >
                {m.body}
              </div>
            ) : null}
            {m.attachments?.length ? (
              <div className={cn("flex flex-wrap gap-1.5", mine && "justify-end")}>
                {m.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block" title={a.name}>
                    <img
                      src={a.url}
                      alt={a.name}
                      loading="lazy"
                      className="max-h-44 max-w-[200px] rounded-[10px] border border-border object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            ) : null}
            <div className="text-[10.5px] text-faint mt-0.5 px-1 tabular">
              {who} · {fmtTime(m.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Caixa de resposta: textarea + anexar imagem + enviar, com nota opcional ("não-E2EE"). */
export function TicketComposer({
  onSend,
  onUpload,
  sending,
  placeholder,
  sendLabel,
  note,
  disabled,
  attachLabel = "Anexar imagem",
  uploadErrorLabel = "Não foi possível anexar a imagem.",
}: {
  onSend: (body: string, attachments: TicketAttachment[]) => void | Promise<void>;
  /** Se presente, mostra o botão de anexar imagem. Cada superfície provê o seu upload. */
  onUpload?: (file: File) => Promise<TicketAttachment>;
  sending?: boolean;
  placeholder: string;
  sendLabel: string;
  note?: string;
  disabled?: boolean;
  attachLabel?: string;
  uploadErrorLabel?: string;
}) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUpload) return;
    setErr("");
    setUploading(true);
    try {
      const a = await onUpload(file);
      setAtts((p) => [...p, a]);
    } catch {
      setErr(uploadErrorLabel);
    } finally {
      setUploading(false);
    }
  };

  const canSend = (text.trim().length > 0 || atts.length > 0) && !sending && !disabled && !uploading;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    await onSend(text.trim(), atts);
    setText("");
    setAtts([]);
    setErr("");
  };

  return (
    <form onSubmit={submit} className="mt-4">
      {atts.length ? (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {atts.map((a, i) => (
            <div key={i} className="relative">
              <img src={a.url} alt={a.name} className="h-16 w-16 rounded-[8px] border border-border object-cover" />
              <button
                type="button"
                onClick={() => setAtts((p) => p.filter((_, j) => j !== i))}
                aria-label="Remover"
                className="absolute -top-1.5 -right-1.5 grid place-items-center w-5 h-5 rounded-full bg-card border border-border text-faint hover:text-neg transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={disabled || sending}
        className="w-full px-3.5 py-2.5 rounded-[10px] border border-border bg-bg2 text-[14px] text-text outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-[var(--ring)] resize-y disabled:opacity-60"
      />
      {note ? <p className="text-[11px] text-faint mt-1.5 leading-relaxed">{note}</p> : null}
      {err ? <p className="text-[11.5px] text-neg mt-1.5">{err}</p> : null}
      <div className="flex items-center justify-between gap-2 mt-2.5">
        {onUpload ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={onPick}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || disabled}
              title={attachLabel}
              aria-label={attachLabel}
              className="grid place-items-center w-9 h-9 rounded-[9px] border border-border text-faint hover:text-text hover:bg-card-hover transition-colors disabled:opacity-50"
            >
              {uploading ? <span className="text-[13px]">…</span> : <Paperclip size={16} />}
            </button>
          </>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex items-center justify-center h-9 px-4 rounded-[9px] bg-accent text-[#0A0B0D] font-semibold text-[13px] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
        >
          {sending ? "…" : sendLabel}
        </button>
      </div>
    </form>
  );
}
