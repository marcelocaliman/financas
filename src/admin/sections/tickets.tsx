import { useState } from "react";
import { ArrowLeft, Mail, Globe, MonitorSmartphone, CheckCircle2, RotateCcw } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { useTicketsUnread } from "../use-realtime";
import { fmtAgo, fmtInt } from "../format";
import { AdminCard, StateBlock } from "../components";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { TicketThread, TicketComposer } from "@/components/support/ticket-thread";
import { replyTicket, uploadTicketImage, type TicketAttachment } from "@/lib/tickets";
import type { AdminTicketRow } from "../types";
import { cn } from "@/lib/utils";

const CAT_LABEL: Record<string, string> = {
  duvida: "Dúvida", problema: "Problema", sugestao: "Sugestão", conta: "Conta e acesso", outro: "Outro",
};
const FILTER_LABEL: Record<"open" | "all" | "closed", string> = { open: "Abertos", all: "Todos", closed: "Resolvidos" };

function StatusBadge({ status }: { status: string }) {
  const open = status === "open";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium shrink-0",
      open ? "text-accent border-accent/30 bg-accent-soft" : "text-muted border-border bg-card2")}>
      {open ? "Aberto" : "Resolvido"}
    </span>
  );
}

function TicketRow({ tk, active, onClick }: { tk: AdminTicketRow; active: boolean; onClick: () => void }) {
  const unread = tk.status === "open" && tk.last_author === "user";
  return (
    <button type="button" onClick={onClick}
      className={cn("w-full flex items-center gap-2.5 py-3 px-1 text-left transition-colors rounded-[8px]", active ? "bg-card2" : "hover:bg-card-hover")}>
      {unread ? <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /> : <span className="w-1.5 h-1.5 shrink-0" />}
      <span className="grid place-items-center w-7 h-7 rounded-full bg-card2 text-faint shrink-0" title={tk.surface}>
        {tk.surface === "landing" ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium truncate">{tk.subject}</div>
        <div className="text-[11px] text-faint truncate tabular">{tk.email} · {fmtAgo(tk.last_message_at)}</div>
      </div>
      <StatusBadge status={tk.status} />
    </button>
  );
}

function TicketDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useAsync(() => adminApi.ticketThread(id), [id]);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (body: string, attachments: TicketAttachment[]) => {
    setSending(true);
    try {
      await replyTicket(id, body, attachments);
      reload();
      onChanged();
    } finally {
      setSending(false);
    }
  };
  const setStatus = async (status: "open" | "closed") => {
    setBusy(true);
    try {
      await adminApi.ticketSetStatus(id, status);
      reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const meta = data?.meta || {};
  const metaBits = ["app_version", "tz", "screen", "ua"]
    .map((k) => (typeof meta[k] === "string" ? String(meta[k]) : null))
    .filter(Boolean);

  return (
    <AdminCard className="p-4 sm:p-4">
      <button type="button" onClick={onBack} className="lg:hidden inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-text mb-3">
        <ArrowLeft size={14} /> Voltar à lista
      </button>
      <StateBlock loading={loading} error={error}>
        {data ? (
          <div>
            <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-border">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint">{CAT_LABEL[data.category] ?? data.category}</span>
                  <StatusBadge status={data.status} />
                </div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] mt-1.5 break-words">{data.subject}</h3>
                <div className="flex items-center gap-1.5 text-[12px] text-muted mt-1.5">
                  <Mail size={12} className="shrink-0" />
                  <a href={`mailto:${data.email}`} className="hover:text-text truncate">{data.name ? `${data.name} · ` : ""}{data.email}</a>
                </div>
                {metaBits.length ? <div className="text-[10.5px] text-faint mt-1 truncate" title={metaBits.join(" · ")}>{metaBits.join(" · ")}</div> : null}
              </div>
              <button type="button" disabled={busy} onClick={() => setStatus(data.status === "open" ? "closed" : "open")}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition disabled:opacity-50">
                {data.status === "open" ? <><CheckCircle2 size={14} /> Resolver</> : <><RotateCcw size={14} /> Reabrir</>}
              </button>
            </div>

            <TicketThread messages={data.messages} mySide="admin" supportLabel="Você" youLabel={data.name || data.email} />
            <TicketComposer onSend={send} onUpload={(f) => uploadTicketImage(f)} sending={sending} placeholder="Responder ao usuário…" sendLabel="Responder" attachLabel="Anexar imagem" uploadErrorLabel="Não foi possível anexar a imagem." />
          </div>
        ) : null}
      </StateBlock>
    </AdminCard>
  );
}

/** Triagem de tickets: lista (filtrável) à esquerda, conversa à direita. */
export function TicketsSection() {
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");
  const { data, error, loading, reload } = useAsync(
    () => adminApi.ticketsList(filter === "all" ? null : filter),
    [filter],
    { refreshMs: 30000 },
  );
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(["open", "all", "closed"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={cn("h-8 px-3 rounded-[8px] text-[12.5px] font-medium transition-colors",
              filter === f ? "bg-accent text-[#0A0B0D]" : "text-muted hover:text-text bg-card2")}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
        <div className={cn("min-w-0", selected && "hidden lg:block")}>
          <AdminCard>
            <StateBlock loading={loading} error={error} empty={(data?.length ?? 0) === 0}>
              <div className="divide-y divide-border -my-2">
                {data?.map((tk) => (
                  <TicketRow key={tk.id} tk={tk} active={tk.id === selected} onClick={() => setSelected(tk.id)} />
                ))}
              </div>
            </StateBlock>
          </AdminCard>
        </div>

        <div className={cn("min-w-0", !selected && "hidden lg:block")}>
          {selected ? (
            <TicketDetail id={selected} onBack={() => setSelected(null)} onChanged={reload} />
          ) : (
            <AdminCard>
              <div className="py-16 text-center text-[13px] text-faint">Selecione um ticket para ver a conversa.</div>
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  );
}

/** Resumo do cabeçalho: total + aguardando resposta (badge ao vivo). */
export function TicketsSummary() {
  const { data } = useAsync(() => adminApi.ticketsList(null), []);
  const unread = useTicketsUnread();
  return (
    <HeaderKpis>
      <HeaderKpi label="tickets" value={fmtInt(data?.length ?? 0)} raw />
      <HeaderKpi secondary tone={unread > 0 ? "accent" : "text"} label="aguardando" value={fmtInt(unread)} raw />
    </HeaderKpis>
  );
}
