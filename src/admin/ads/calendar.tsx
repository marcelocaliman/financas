import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Plus, Rocket, Sparkles, Trash2 } from "lucide-react";
import { POSTS, EDU_POSTS, STORIES, EDU_STORIES, CAROUSELS, EDU_CAROUSELS } from "@/admin/ads/engine";
import { useAdsCalendar, type CalEntry } from "@/admin/ads/calendar-store";
import { generateSchedule, boostPlan, INTENSITY_LABEL, type Intensity } from "@/admin/ads/planner";
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

const MS_DAY = 86_400_000;
/** "hoje" / "amanhã" / "ontem" / "seg, 8 jul (· há Nd)". */
function relDay(k: string, todayK: string): string {
  const delta = Math.round((parse(k).getTime() - parse(todayK).getTime()) / MS_DAY);
  if (delta === 0) return "hoje";
  if (delta === 1) return "amanhã";
  if (delta === -1) return "ontem";
  const d = parse(k);
  const s = `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}`;
  return delta < 0 ? `${s} · há ${-delta}d` : s;
}

/** Peças PLANEJADAS ainda não postadas, separadas em atrasadas / hoje / próximas. */
function useAgenda() {
  const entries = useAdsCalendar((s) => s.entries);
  const todayK = key(new Date());
  return useMemo(() => {
    const posted = new Set(entries.filter((e) => e.status === "posted").map((e) => `${e.pieceId}@${e.date}`));
    const pending = entries
      .filter((e) => e.status === "planned" && !posted.has(`${e.pieceId}@${e.date}`))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return {
      todayK,
      overdue: pending.filter((e) => e.date < todayK),
      today: pending.filter((e) => e.date === todayK),
      upcoming: pending.filter((e) => e.date > todayK).slice(0, 6),
    };
  }, [entries, todayK]);
}

const NOTIFY_KEY = "nf-ads-notify"; // "1" = quer aviso do navegador
const NOTIFIED_ON = "nf-ads-notified-on"; // AAAA-MM-DD do último aviso (1×/dia)

/** Roteiro de postagem: o que postar HOJE (+ atrasadas e próximas), com alerta opcional do navegador. */
export function AdsAgenda() {
  const { todayK, overdue, today, upcoming } = useAgenda();
  const add = useAdsCalendar((s) => s.add);
  const remove = useAdsCalendar((s) => s.remove);
  const due = overdue.length + today.length;
  // Início do roteiro (pra ancorar o plano de impulsionamento) = data mais antiga registrada.
  const firstDate = useAdsCalendar((s) => (s.entries.length ? s.entries.map((e) => e.date).sort()[0] : ""));
  const boostStart = firstDate || todayK;

  const [notify, setNotify] = useState(() => {
    try {
      return localStorage.getItem(NOTIFY_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [intensity, setIntensity] = useState<Intensity>("equilibrado");

  // Gera um roteiro pronto (ordem/cadência/variedade automáticas) pras próximas 4 semanas. Substitui
  // o plano FUTURO (planejadas de hoje em diante) e preserva todo o histórico já POSTADO.
  const generatePlan = () => {
    const st = useAdsCalendar.getState();
    const future = st.entries.filter((e) => e.status === "planned" && e.date >= todayK);
    if (future.length && !window.confirm("Gerar um novo roteiro substitui o plano futuro (o histórico já postado é mantido). Continuar?")) return;
    future.forEach((e) => remove(e.id));
    for (const p of generateSchedule(new Date(), 4, intensity)) add({ date: p.date, pieceId: p.pieceId, status: "planned" });
  };

  // Aviso do navegador: 1× por dia, quando há peça pra hoje/atrasada e a permissão está concedida.
  useEffect(() => {
    if (!notify || due === 0 || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      if (localStorage.getItem(NOTIFIED_ON) === todayK) return;
      new Notification("Nossas Finanças · Ads", {
        body: overdue.length ? `${due} peça(s) pra postar (inclui atrasadas).` : `${due} peça(s) pra postar hoje.`,
      });
      localStorage.setItem(NOTIFIED_ON, todayK);
    } catch {
      /* ignora */
    }
  }, [notify, due, overdue.length, todayK]);

  const enableNotify = async () => {
    if (typeof Notification === "undefined") return;
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    const on = perm === "granted";
    setNotify(on);
    try {
      localStorage.setItem(NOTIFY_KEY, on ? "1" : "0");
    } catch {
      /* ignora */
    }
  };
  const disableNotify = () => {
    setNotify(false);
    try {
      localStorage.setItem(NOTIFY_KEY, "0");
    } catch {
      /* ignora */
    }
  };

  // "Publiquei": registra a postagem de HOJE e tira a peça do roteiro (feito). Lixeira só descarta o plano.
  const markPosted = (e: CalEntry) => {
    add({ date: todayK, pieceId: e.pieceId, status: "posted" });
    remove(e.id);
  };

  const total = overdue.length + today.length + upcoming.length;
  return (
    <div className="rounded-[16px] border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-accent" />
          <h3 className="text-[14px] font-semibold text-text">Roteiro de postagem</h3>
        </div>
        {notify ? (
          <button type="button" onClick={disableNotify} title="Desligar avisos do navegador" className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] border border-border text-[11.5px] text-accent">
            <BellRing size={13} /> Avisos ligados
          </button>
        ) : (
          <button type="button" onClick={enableNotify} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] border border-border text-[11.5px] text-muted hover:text-text hover:border-border-strong transition-colors">
            <Bell size={13} /> Avisar no navegador
          </button>
        )}
      </div>

      {/* Gerar roteiro AUTOMÁTICO (ordem/cadência/variedade determinística — sem IA). */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-border-strong bg-card2/40 px-3 py-2.5">
        <span className="text-[12px] text-muted">Não sabe a ordem? Gere um roteiro pronto:</span>
        <select
          value={intensity}
          onChange={(e) => setIntensity(e.target.value as Intensity)}
          className="h-8 rounded-[8px] border border-border bg-card px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {(["leve", "equilibrado", "intenso"] as Intensity[]).map((k) => (
            <option key={k} value={k}>
              {INTENSITY_LABEL[k]}
            </option>
          ))}
        </select>
        <button type="button" onClick={generatePlan} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[12px] font-medium text-[#08130C] hover:opacity-90">
          <Sparkles size={13} /> Gerar 4 semanas
        </button>
      </div>

      {/* Rotina fixa: o que fazer com cada peça (some da cabeça do usuário). */}
      <p className="mb-3 text-[11.5px] leading-relaxed text-faint">
        <b className="text-muted">Rotina:</b> todo post do feed → reposte no seu story; todo story → salve no{" "}
        <b className="text-muted">Destaque</b> indicado; o 1º carrossel → fixe no topo do perfil.
      </p>

      {total === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-faint">
          Nada planejado ainda. Clique em <b className="text-muted">Gerar 4 semanas</b> pra um roteiro
          pronto — ou planeje à mão escolhendo um dia no calendário abaixo.
        </p>
      ) : (
        <>
          <div className="space-y-3.5">
            {overdue.length ? <AgendaGroup label={`Atrasado · ${overdue.length}`} tone="neg" entries={overdue} todayK={todayK} onMark={markPosted} onRemove={remove} /> : null}
            {today.length ? <AgendaGroup label="Pra hoje" tone="accent" entries={today} todayK={todayK} onMark={markPosted} onRemove={remove} /> : null}
            {upcoming.length ? <AgendaGroup label="Próximos" tone="muted" entries={upcoming} todayK={todayK} onMark={markPosted} onRemove={remove} /> : null}
          </div>
          <BoostPanel start={boostStart} todayK={todayK} />
        </>
      )}
    </div>
  );
}

/** Plano de impulsionamento (quando/como pagar pra promover), ancorado no início do roteiro. */
function BoostPanel({ start, todayK }: { start: string; todayK: string }) {
  const recs = useMemo(() => boostPlan(parse(start)), [start]);
  return (
    <div className="mt-4 border-t border-border pt-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <Rocket size={14} className="text-accent" />
        <h4 className="text-[12.5px] font-semibold text-text">Impulsionamento — quando pagar pra promover</h4>
      </div>
      <p className="mb-2.5 text-[11.5px] leading-relaxed text-faint">
        Nas <b className="text-muted">2 primeiras semanas</b> não impulsione — poste orgânico e veja o que mais salva/compartilha. Depois, siga o plano:
      </p>
      <div className="space-y-2">
        {recs.map((r, i) => {
          const active = todayK >= r.date;
          return (
            <div key={i} className={cn("rounded-[11px] border px-3 py-2.5", active ? "border-accent/45 bg-accent-soft/40" : "border-border bg-card2")}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] font-medium text-text">{PIECE[r.pieceId]?.label ?? r.pieceId}</span>
                <span className={cn("shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]", active ? "text-accent" : "text-faint")}>
                  {r.window} · {relDay(r.date, todayK)}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted">{r.why}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-faint">
                <span><b className="text-muted">Verba:</b> {r.budget} · {r.days}</span>
                <span><b className="text-muted">Objetivo:</b> {r.objective}</span>
                <span><b className="text-muted">Público:</b> {r.audience}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaGroup({
  label,
  tone,
  entries,
  todayK,
  onMark,
  onRemove,
}: {
  label: string;
  tone: "neg" | "accent" | "muted";
  entries: CalEntry[];
  todayK: string;
  onMark: (e: CalEntry) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className={cn("mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]", tone === "neg" ? "text-neg" : tone === "accent" ? "text-accent" : "text-faint")}>{label}</div>
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2.5 rounded-[11px] border border-border bg-card2 px-3 py-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", tone === "neg" ? "bg-neg" : "bg-accent")} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] text-text">{PIECE[e.pieceId]?.label ?? e.pieceId}</div>
              <div className="text-[11px] text-faint">
                {relDay(e.date, todayK)}
                {e.note ? <> · <span className="text-accent">{e.note}</span></> : null}
              </div>
            </div>
            <button type="button" onClick={() => onMark(e)} title="Marcar como publicado hoje" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] bg-accent px-2.5 text-[11.5px] font-medium text-[#08130C] hover:opacity-90">
              <Check size={13} /> Publiquei
            </button>
            <button type="button" onClick={() => onRemove(e.id)} aria-label="Remover do roteiro" className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-faint hover:text-neg transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
