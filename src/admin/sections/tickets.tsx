import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail, Globe, MonitorSmartphone, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { useTicketsCounts, refreshTicketsCounts } from "../use-realtime";
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
const PAGE = 30;

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
  return (
    <button type="button" onClick={onClick}
      className={cn("w-full flex items-center gap-2.5 py-3 px-1 text-left transition-colors rounded-[8px]", active ? "bg-card2" : "hover:bg-card-hover")}>
      {tk.unread ? <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /> : <span className="w-1.5 h-1.5 shrink-0" />}
      <span className="grid place-items-center w-7 h-7 rounded-full bg-card2 text-faint shrink-0" title={tk.surface}>
        {tk.surface === "landing" ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[12.5px] truncate", tk.unread ? "font-semibold text-text" : "font-medium text-muted")}>{tk.subject}</div>
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

  // Abrir a conversa MARCA como lida (limpa o "não lido" do dono e atualiza o selo).
  useEffect(() => {
    void adminApi.ticketRead(id).then(refreshTicketsCounts).catch(() => {});
  }, [id]);

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

/** Triagem de tickets: busca + filtro + lista paginada (não-lidos primeiro) | conversa. */
export function TicketsSection() {
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminTicketRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const counts = useTicketsCounts();

  // Refs lidas dentro de callbacks SEM virar dependência (evita recriar `load` / recarregar à toa).
  const genRef = useRef(0); // geração: descarta respostas obsoletas (corrida de busca/atualização)
  const rowsLenRef = useRef(0); // quantas linhas já estão carregadas (preserva a profundidade no reload)
  const selectedRef = useRef<string | null>(null); // ticket aberto: seu selo fica limpo mesmo após reload
  rowsLenRef.current = rows?.length ?? 0;
  selectedRef.current = selected;

  // Busca com debounce (não dispara a cada tecla).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Carrega `limit` linhas do topo (offset 0). Guarda de geração: só a resposta MAIS NOVA pinta —
  // senão uma busca lenta anterior poderia sobrescrever o resultado de uma busca posterior.
  const load = useCallback(
    async (limit: number) => {
      const gen = ++genRef.current;
      setErr(null);
      try {
        const data = await adminApi.ticketsList(filter === "all" ? null : filter, search || null, limit, 0);
        if (gen !== genRef.current) return; // resposta obsoleta — uma carga mais nova venceu
        setTotal(data[0]?.total_count ?? 0);
        // mantém limpo o selo do ticket aberto, mesmo que o read RPC ainda não tenha commitado
        setRows(data.map((r) => (r.id === selectedRef.current ? { ...r, unread: false } : r)));
      } catch (e) {
        if (gen !== genRef.current) return;
        setErr(e instanceof Error ? e.message : String(e));
        setRows([]);
      }
    },
    [filter, search],
  );

  // Troca de filtro/busca: lista fresca a partir de 30.
  useEffect(() => {
    void load(PAGE);
  }, [load]);

  // Entrou atividade nova (não-lidos SOBE: ticket novo ou resposta do usuário) → atualiza PRESERVANDO
  // a profundidade carregada (não colapsa pra 30). Leituras (CAI) não recarregam; o selo lido some na
  // hora via onSelect (otimista) e fica limpo no reload via selectedRef.
  const prevUnread = useRef(counts.unread);
  useEffect(() => {
    if (counts.unread > prevUnread.current) void load(Math.max(PAGE, rowsLenRef.current));
    prevUnread.current = counts.unread;
  }, [counts.unread, load]);

  // Atualiza preservando a profundidade carregada (após responder / mudar status).
  const refresh = useCallback(() => load(Math.max(PAGE, rowsLenRef.current)), [load]);

  // Abrir um ticket o marca como lido — apaga o selo na hora, sem recarregar a lista inteira.
  const onSelect = (id: string) => {
    setSelected(id);
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, unread: false } : r)) ?? rs);
  };

  const loadMore = async () => {
    if (!rows) return;
    const gen = genRef.current; // se uma carga mais nova entrar no meio, descarta este append
    setMore(true);
    try {
      const data = await adminApi.ticketsList(filter === "all" ? null : filter, search || null, PAGE, rows.length);
      if (gen !== genRef.current) return;
      if (data.length === 0) {
        setTotal(rows.length); // fim real da lista → some o botão e o rodapé bate com as linhas
        return;
      }
      setTotal(data[0]?.total_count ?? total);
      // Dedup por id: a ordenação pode deslocar uma linha entre páginas (offset), o que duplicaria
      // a chave React. Só anexa o que ainda não está na lista.
      setRows((prev) => {
        const seen = new Set((prev ?? []).map((r) => r.id));
        return [...(prev ?? []), ...data.filter((r) => !seen.has(r.id))];
      });
    } catch {
      /* ignore */
    } finally {
      setMore(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por e-mail, assunto ou nome…"
            className="w-full h-9 pl-9 pr-3 rounded-[9px] border border-border bg-card2 text-[13px] text-text outline-none focus:border-accent transition-colors placeholder:text-faint"
          />
        </div>
        <div className="flex gap-1.5">
          {(["open", "all", "closed"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={cn("h-9 px-3 rounded-[8px] text-[12.5px] font-medium transition-colors", filter === f ? "bg-accent text-[#0A0B0D]" : "text-muted hover:text-text bg-card2")}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
        <div className={cn("min-w-0", selected && "hidden lg:block")}>
          <AdminCard>
            <StateBlock loading={rows === null} error={err} empty={rows !== null && rows.length === 0}>
              <div className="divide-y divide-border -my-2">
                {rows?.map((tk) => (
                  <TicketRow key={tk.id} tk={tk} active={tk.id === selected} onClick={() => onSelect(tk.id)} />
                ))}
              </div>
              {rows && rows.length < total ? (
                <div className="pt-3.5 mt-1 text-center">
                  <button type="button" onClick={() => void loadMore()} disabled={more}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition disabled:opacity-50">
                    {more ? "…" : `Carregar mais — ${rows.length}/${total}`}
                  </button>
                </div>
              ) : rows && rows.length > 0 ? (
                <div className="pt-3.5 mt-1 text-center text-[11px] text-faint tabular">{total} ticket{total === 1 ? "" : "s"}</div>
              ) : null}
            </StateBlock>
          </AdminCard>
        </div>

        <div className={cn("min-w-0", !selected && "hidden lg:block")}>
          {selected ? (
            <TicketDetail id={selected} onBack={() => setSelected(null)} onChanged={refresh} />
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

/** Resumo do cabeçalho, ao vivo: total + NÃO LIDOS (atenção) + NOVOS (ainda na 1ª mensagem do
 *  usuário e nunca abertos pelo dono — last_author='user' e admin_read_at is null). */
export function TicketsSummary() {
  const c = useTicketsCounts();
  return (
    <HeaderKpis>
      <HeaderKpi label="tickets" value={fmtInt(c.total)} raw />
      <HeaderKpi secondary tone={c.unread > 0 ? "accent" : "text"} label="não lidos" value={fmtInt(c.unread)} raw />
      <HeaderKpi secondary tone={c.novos > 0 ? "accent" : "text"} label="novos" value={fmtInt(c.novos)} raw />
    </HeaderKpis>
  );
}
