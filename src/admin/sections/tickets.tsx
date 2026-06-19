import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail, Globe, MonitorSmartphone, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

/** Cabeçalho de coluna no padrão de tabela (mono, caixa-alta, hairline). */
function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono uppercase text-[10.5px] tracking-[0.12em] text-faint", className)}>{children}</span>;
}

function SurfaceIcon({ surface }: { surface: string }) {
  const Icon = surface === "landing" ? Globe : MonitorSmartphone;
  return <Icon size={11} className="shrink-0 text-faint" />;
}

/** Linha da tabela de tickets (mesmo padrão da lista do usuário, com quem enviou). */
function TicketRow({ tk, onOpen }: { tk: AdminTicketRow; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(tk.id)}
      className="w-full grid grid-cols-[12px_minmax(0,1fr)_auto] md:grid-cols-[12px_minmax(0,1fr)_132px_104px_104px] items-center gap-3 px-4 py-3 text-left hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
      {tk.unread ? <span className="w-2 h-2 rounded-full bg-accent shrink-0" title="Não lido" /> : <span className="w-2 h-2 shrink-0" />}
      <div className="min-w-0">
        <div className={cn("text-[13.5px] truncate text-text", tk.unread ? "font-semibold" : "font-medium")}>{tk.subject}</div>
        <div className="flex items-center gap-1 text-[11px] text-faint mt-0.5 min-w-0">
          <SurfaceIcon surface={tk.surface} />
          <span className="truncate">{tk.name ? `${tk.name} · ` : ""}{tk.email}</span>
        </div>
        <div className="md:hidden text-[11px] text-faint mt-0.5 tabular truncate">{CAT_LABEL[tk.category] ?? tk.category} · {fmtAgo(tk.last_message_at)}</div>
      </div>
      <div className="hidden md:block text-[12.5px] text-muted truncate">{CAT_LABEL[tk.category] ?? tk.category}</div>
      <div className="justify-self-start"><StatusBadge status={tk.status} /></div>
      <div className="hidden md:block text-right text-[12px] text-faint tabular">{fmtAgo(tk.last_message_at)}</div>
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

  // Ao vivo: resposta nova do usuário neste ticket chega na hora (igual ao thread do usuário).
  useEffect(() => {
    const ch = supabase
      .channel(`admin:ticket:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` }, () => reload())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, reload]);

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
    <div className="space-y-4">
      <button type="button" onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded">
        <ArrowLeft size={15} /> Voltar à lista
      </button>
      <AdminCard>
        <StateBlock loading={loading} error={error}>
          {data ? (
            <div>
              <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint">{CAT_LABEL[data.category] ?? data.category}</span>
                    <StatusBadge status={data.status} />
                  </div>
                  <h3 className="text-[17px] font-semibold tracking-[-0.01em] mt-1.5 break-words">{data.subject}</h3>
                  <div className="flex items-center gap-1.5 text-[12px] text-muted mt-1.5">
                    <Mail size={12} className="shrink-0" />
                    <a href={`mailto:${data.email}`} className="hover:text-text truncate">{data.name ? `${data.name} · ` : ""}{data.email}</a>
                  </div>
                  {metaBits.length ? <div className="text-[10.5px] text-faint mt-1 truncate" title={metaBits.join(" · ")}>{metaBits.join(" · ")}</div> : null}
                </div>
                <button type="button" disabled={busy} onClick={() => setStatus(data.status === "open" ? "closed" : "open")}
                  className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  {data.status === "open" ? <><CheckCircle2 size={14} /> Resolver</> : <><RotateCcw size={14} /> Reabrir</>}
                </button>
              </div>

              <TicketThread messages={data.messages} mySide="admin" supportLabel="Você" youLabel={data.name || data.email} />
              <TicketComposer onSend={send} onUpload={(f) => uploadTicketImage(f)} sending={sending} placeholder="Responder ao usuário…" sendLabel="Responder" attachLabel="Anexar imagem" uploadErrorLabel="Não foi possível anexar a imagem." />
            </div>
          ) : null}
        </StateBlock>
      </AdminCard>
    </div>
  );
}

/** Triagem de tickets: tabela paginada + busca (não-lidos primeiro) → conversa em tela cheia. */
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
  rowsLenRef.current = rows?.length ?? 0;

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
        setRows(data); // o servidor é a fonte da verdade do `unread` (admin_read_at); sem máscara local
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

  // Qualquer atividade em tickets (novo, resposta do usuário, leitura, mudança de status) gera um
  // refresh dos contadores via realtime, e `counts` vem como um objeto NOVO a cada refresh. Atualiza
  // a lista nesse sinal — PRESERVANDO a profundidade carregada (não colapsa pra 30). Isso pega casos
  // que um gatilho só-de-contador perderia: resposta a um ticket já não-lido (contador não muda) e
  // soma-zero (uma resposta +1 coincide com uma leitura −1 na mesma janela). genRef descarta corridas.
  const prevCounts = useRef(counts);
  useEffect(() => {
    if (prevCounts.current !== counts) {
      prevCounts.current = counts;
      void load(Math.max(PAGE, rowsLenRef.current));
    }
  }, [counts, load]);

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

  // Conversa em tela cheia (substitui a tabela), igual à lógica da página do usuário.
  if (selected) {
    return <TicketDetail id={selected} onBack={() => setSelected(null)} onChanged={refresh} />;
  }

  const isEmpty = rows !== null && rows.length === 0;
  const emptyMsg = search
    ? "Nenhum ticket encontrado."
    : filter === "open" ? "Nenhum ticket aberto."
    : filter === "closed" ? "Nenhum ticket resolvido."
    : "Nenhum ticket ainda.";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative sm:flex-1 sm:max-w-[340px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por e-mail, assunto ou nome…"
            aria-label="Buscar tickets"
            className="w-full h-9 pl-9 pr-3 rounded-[9px] border border-border bg-card2 text-[13px] text-text outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)] transition-colors placeholder:text-faint"
          />
        </div>
        <div className="flex gap-1.5 sm:ml-auto">
          {(["open", "all", "closed"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={cn("h-9 px-3 rounded-[8px] text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                filter === f ? "bg-accent text-[#0A0B0D]" : "text-muted hover:text-text bg-card2")}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <AdminCard className="!p-0 overflow-hidden">
        {rows === null || err ? (
          <StateBlock loading={rows === null} error={err}>{null}</StateBlock>
        ) : isEmpty ? (
          <div className="py-12 text-center text-[13px] text-faint">{emptyMsg}</div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[12px_minmax(0,1fr)_132px_104px_104px] items-center gap-3 px-4 py-2.5 border-b border-border bg-card2/40">
              <span />
              <Th>Assunto / Remetente</Th>
              <Th>Categoria</Th>
              <Th>Status</Th>
              <Th className="text-right">Atualizado</Th>
            </div>
            <div className="divide-y divide-border">
              {rows.map((tk) => <TicketRow key={tk.id} tk={tk} onOpen={onSelect} />)}
            </div>
            {rows.length < total ? (
              <div className="px-4 py-3.5 text-center border-t border-border">
                <button type="button" onClick={() => void loadMore()} disabled={more}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  {more ? "…" : `Carregar mais — ${rows.length}/${total}`}
                </button>
              </div>
            ) : (
              <div className="px-4 py-3 text-center text-[11px] text-faint tabular border-t border-border">{total} ticket{total === 1 ? "" : "s"}</div>
            )}
          </>
        )}
      </AdminCard>
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
