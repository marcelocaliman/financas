import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import { POSTS, EDU_POSTS, STORIES, EDU_STORIES, CAROUSELS, EDU_CAROUSELS } from "@/admin/ads/engine";
import { useAdsCalendar } from "@/admin/ads/calendar-store";
import { cn } from "@/lib/utils";

/** Peças postáveis (posts + stories + carrosséis, institucionais e educativos) — seletor e estatísticas. */
const PIECES = [
  ...POSTS.map((p) => ({ id: `post:${p.id}`, label: p.name, pillar: p.pillar, kind: "post" as const })),
  ...EDU_POSTS.map((p) => ({ id: `post:${p.id}`, label: p.name, pillar: p.pillar, kind: "post" as const })),
  ...STORIES.map((s) => ({ id: `story:${s.id}`, label: `Story · ${s.name}`, pillar: "Story", kind: "story" as const })),
  ...EDU_STORIES.map((s) => ({ id: `story:${s.id}`, label: `Story · ${s.name}`, pillar: "Story", kind: "story" as const })),
  ...CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, label: `Carrossel · ${c.name}`, pillar: c.pillar, kind: "carousel" as const })),
  ...EDU_CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, label: `Carrossel · ${c.name}`, pillar: c.pillar, kind: "carousel" as const })),
];
const PIECE = Object.fromEntries(PIECES.map((p) => [p.id, p]));
const POST_PILLARS = [...new Set(POSTS.map((p) => p.pillar))];

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const pretty = (k: string) => {
  const d = parse(k);
  return `${WD[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
};

export function AdsCalendar() {
  const entries = useAdsCalendar((s) => s.entries);
  const add = useAdsCalendar((s) => s.add);
  const remove = useAdsCalendar((s) => s.remove);

  const now = new Date();
  const todayK = key(now);
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(todayK);
  const [pieceId, setPieceId] = useState(PIECES[0].id);
  const [status, setStatus] = useState<"posted" | "planned">("posted");
  const [note, setNote] = useState("");

  const byDate = useMemo(() => {
    const m: Record<string, typeof entries> = {};
    for (const e of entries) (m[e.date] ||= []).push(e);
    return m;
  }, [entries]);

  // ── estatísticas inteligentes ──
  const stats = useMemo(() => {
    const posted = entries.filter((e) => e.status === "posted");
    const monthPrefix = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}`;
    const monthCount = posted.filter((e) => e.date.startsWith(monthPrefix)).length;
    const last = posted.map((e) => e.date).sort().at(-1);
    const daysSince = last ? Math.round((parse(todayK).getTime() - parse(last).getTime()) / 86_400_000) : null;
    const used: Record<string, number> = {};
    for (const e of posted) used[e.pieceId] = (used[e.pieceId] ?? 0) + 1;
    const postPieces = PIECES.filter((p) => p.kind === "post");
    const neverPosted = postPieces.filter((p) => !used[p.id]);
    const suggestion = [...postPieces].sort((a, b) => (used[a.id] ?? 0) - (used[b.id] ?? 0))[0];
    const byPillar = POST_PILLARS.map((pl) => ({
      pillar: pl,
      n: posted.filter((e) => PIECE[e.pieceId]?.pillar === pl).length,
    }));
    return { monthCount, daysSince, neverPosted, suggestion, byPillar };
  }, [entries, cur, todayK]);

  // ── grade de 6 semanas ──
  const cells = useMemo(() => {
    const first = new Date(cur.y, cur.m, 1);
    const start = new Date(cur.y, cur.m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cur]);

  const shift = (delta: number) => {
    const d = new Date(cur.y, cur.m + delta, 1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    setCur({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(todayK);
  };
  const addEntry = (date: string, pid: string, st: "posted" | "planned", nt?: string) => {
    add({ date, pieceId: pid, status: st, note: nt?.trim() || undefined });
  };

  const dayEntries = selected ? byDate[selected] ?? [] : [];

  return (
    <div className="rounded-[16px] border border-border bg-card p-4">
      {/* cabeçalho: mês + navegação */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-accent" />
          <h3 className="text-[14px] font-semibold text-text tabular">
            {MONTHS[cur.m]} {cur.y}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={goToday} className="mr-1 h-7 rounded-[8px] border border-border px-2.5 text-[11.5px] text-muted hover:text-text hover:border-border-strong">
            Hoje
          </button>
          <button type="button" onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted hover:text-text hover:border-border-strong">
            <ChevronLeft size={15} />
          </button>
          <button type="button" onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted hover:text-text hover:border-border-strong">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* faixa inteligente */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="tabular font-semibold text-text">{stats.monthCount}</span> postado{stats.monthCount === 1 ? "" : "s"} no mês
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Clock size={12} className="text-faint" />
          {stats.daysSince == null ? "sem posts ainda" : stats.daysSince === 0 ? "postou hoje ✓" : `há ${stats.daysSince} dia${stats.daysSince === 1 ? "" : "s"} sem postar`}
        </span>
        {stats.suggestion ? (
          <button
            type="button"
            onClick={() => {
              setPieceId(stats.suggestion.id);
              setSelected(todayK);
              addEntry(todayK, stats.suggestion.id, "posted");
            }}
            className="inline-flex items-center gap-1.5 text-accent hover:underline"
            title="Marcar essa peça como postada hoje"
          >
            <Sparkles size={12} /> Sugestão: {stats.suggestion.label}
          </button>
        ) : null}
      </div>

      {/* grade */}
      <div className="grid grid-cols-7 gap-1">
        {WD.map((w) => (
          <div key={w} className="pb-1 text-center font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const k = key(d);
          const inMonth = d.getMonth() === cur.m;
          const es = byDate[k] ?? [];
          const isToday = k === todayK;
          const isSel = k === selected;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              className={cn(
                "flex min-h-[52px] flex-col items-start rounded-[9px] border p-1.5 text-left transition-colors",
                isSel ? "border-accent bg-card2" : "border-border hover:border-border-strong",
                !inMonth && "opacity-40",
              )}
            >
              <span className={cn("tabular text-[11px]", isToday ? "grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-[#08130C]" : "text-muted")}>
                {d.getDate()}
              </span>
              <div className="mt-auto flex flex-wrap gap-0.5">
                {es.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={cn("h-[5px] w-[5px] rounded-full", e.status === "posted" ? "bg-accent" : "border border-muted")}
                    title={`${PIECE[e.pieceId]?.label ?? e.pieceId} · ${e.status === "posted" ? "postado" : "planejado"}`}
                  />
                ))}
                {es.length > 3 ? <span className="text-[8px] leading-none text-faint">+{es.length - 3}</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* editor do dia */}
      {selected ? (
        <div className="mt-3 rounded-[12px] border border-border bg-card2 p-3">
          <div className="mb-2 text-[12.5px] font-medium capitalize">{pretty(selected)}</div>
          {dayEntries.length ? (
            <div className="mb-2.5 space-y-1">
              {dayEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[12px]">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", e.status === "posted" ? "bg-accent" : "border border-muted")} />
                  <span className="truncate text-text">{PIECE[e.pieceId]?.label ?? e.pieceId}</span>
                  <span className="shrink-0 text-[10.5px] text-faint">{e.status === "posted" ? "postado" : "planejado"}</span>
                  {e.note ? <span className="truncate text-[11px] text-faint">· {e.note}</span> : null}
                  <button type="button" onClick={() => remove(e.id)} className="ml-auto shrink-0 text-faint hover:text-neg">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-2.5 text-[11.5px] text-faint">Nada aqui ainda — registre o que postou (ou planeje).</div>
          )}
          {/* form de adicionar */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pieceId}
              onChange={(e) => setPieceId(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-[8px] border border-border bg-card px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {PIECES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="flex rounded-[8px] border border-border p-0.5">
              {(["posted", "planned"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={cn("h-7 rounded-[6px] px-2.5 text-[11.5px] transition-colors", status === st ? "bg-accent text-[#08130C] font-medium" : "text-muted hover:text-text")}
                >
                  {st === "posted" ? "Postado" : "Planejado"}
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="nota (opcional)"
              className="h-8 w-full flex-1 rounded-[8px] border border-border bg-card px-2.5 text-[12px] text-text placeholder:text-faint outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:w-auto"
            />
            <button
              type="button"
              onClick={() => {
                addEntry(selected, pieceId, status, note);
                setNote("");
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[12px] font-medium text-[#08130C] hover:opacity-90"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>
          {/* equilíbrio de pilares + não usados */}
          {stats.neverPosted.length ? (
            <div className="mt-3 border-t border-border pt-2.5 text-[11px] text-faint">
              Ainda não postou: <span className="text-muted">{stats.neverPosted.map((p) => p.label.split(" · ")[0]).join(", ")}</span>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-faint">
            {stats.byPillar.map((p) => (
              <span key={p.pillar}>
                {p.pillar} <span className="tabular text-muted">{p.n}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
