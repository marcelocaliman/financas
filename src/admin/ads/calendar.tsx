import { useEffect, useMemo, useState } from "react";
import {
  Bell, BellRing, CalendarClock, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Film, GalleryHorizontalEnd, Image as ImageIcon, Plus, Rocket, Sparkles, Trash2,
} from "lucide-react";
import { POSTS, EDU_POSTS, STORIES, EDU_STORIES, CAROUSELS, EDU_CAROUSELS } from "@/admin/ads/engine";
import { useAdsCalendar, type CalEntry } from "@/admin/ads/calendar-store";
import { generateSchedule, boostPlan, INTENSITY_LABEL, type Intensity } from "@/admin/ads/planner";
import { cn } from "@/lib/utils";

// ── catálogo de peças (posts + stories + carrosséis, institucionais e educativos) ──
type Kind = "post" | "story" | "carousel";
interface PieceMeta {
  id: string;
  label: string;
  pillar: string;
  kind: Kind;
  edu: boolean;
}
const PIECES: PieceMeta[] = [
  ...POSTS.map((p) => ({ id: `post:${p.id}`, label: p.name, pillar: p.pillar, kind: "post" as const, edu: false })),
  ...EDU_POSTS.map((p) => ({ id: `post:${p.id}`, label: p.name, pillar: p.pillar, kind: "post" as const, edu: true })),
  ...STORIES.map((s) => ({ id: `story:${s.id}`, label: s.name, pillar: "Story", kind: "story" as const, edu: false })),
  ...EDU_STORIES.map((s) => ({ id: `story:${s.id}`, label: s.name, pillar: "Story", kind: "story" as const, edu: true })),
  ...CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, label: c.name, pillar: c.pillar, kind: "carousel" as const, edu: false })),
  ...EDU_CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, label: c.name, pillar: c.pillar, kind: "carousel" as const, edu: true })),
];
const PIECE: Record<string, PieceMeta> = Object.fromEntries(PIECES.map((p) => [p.id, p]));
const POST_PILLARS = [...new Set(POSTS.map((p) => p.pillar))];
const KIND_META: Record<Kind, { icon: typeof Film; label: string }> = {
  post: { icon: ImageIcon, label: "Post" },
  story: { icon: Film, label: "Story" },
  carousel: { icon: GalleryHorizontalEnd, label: "Carrossel" },
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MS_DAY = 86_400_000;

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const pretty = (k: string) => {
  const d = parse(k);
  return `${WD[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
};
/** "hoje" / "amanhã" / "ontem" / "seg, 8 jul" (+ "· há Nd" no passado). */
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

interface Stats {
  monthCount: number;
  daysSince: number | null;
  byPillar: { pillar: string; n: number }[];
}
/** Cadência do mês CORRENTE: quantos postados, há quantos dias sem postar, equilíbrio por pilar. */
function useStats(todayK: string): Stats {
  const entries = useAdsCalendar((s) => s.entries);
  return useMemo(() => {
    const posted = entries.filter((e) => e.status === "posted");
    const monthPrefix = todayK.slice(0, 7);
    const monthCount = posted.filter((e) => e.date.startsWith(monthPrefix)).length;
    const last = posted.map((e) => e.date).sort().at(-1);
    const daysSince = last ? Math.round((parse(todayK).getTime() - parse(last).getTime()) / MS_DAY) : null;
    const byPillar = POST_PILLARS.map((pl) => ({ pillar: pl, n: posted.filter((e) => PIECE[e.pieceId]?.pillar === pl).length }));
    return { monthCount, daysSince, byPillar };
  }, [entries, todayK]);
}

const NOTIFY_KEY = "nf-ads-notify";
const NOTIFIED_ON = "nf-ads-notified-on";

// ── átomos de UI ──────────────────────────────────────────────────────────────
function MicroLabel({ children, tone = "faint" }: { children: React.ReactNode; tone?: "faint" | "accent" | "neg" | "muted" }) {
  return (
    <div className={cn("font-mono text-[10px] font-medium uppercase tracking-[0.13em]", tone === "neg" ? "text-neg" : tone === "accent" ? "text-accent" : tone === "muted" ? "text-muted" : "text-faint")}>
      {children}
    </div>
  );
}

/** Uma peça na lista (hoje / atrasado / próximos): ícone do tipo + nome + quando + ação. */
function PieceRow({ entry, todayK, tone, onMark, onRemove }: { entry: CalEntry; todayK: string; tone: "neg" | "accent" | "muted"; onMark?: (e: CalEntry) => void; onRemove: (id: string) => void }) {
  const meta = PIECE[entry.pieceId];
  const Icon = meta ? KIND_META[meta.kind].icon : ImageIcon;
  const neg = tone === "neg";
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-border bg-card2 px-3 py-2.5">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[9px]", neg ? "bg-neg/15 text-neg" : "bg-accent-soft text-accent")}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-text">{meta?.label ?? entry.pieceId}</span>
          {meta ? <span className="shrink-0 rounded-[5px] bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-faint">{KIND_META[meta.kind].label}{meta.edu ? " · edu" : ""}</span> : null}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-faint">
          <span className={cn(neg && "text-neg")}>{relDay(entry.date, todayK)}</span>
          {entry.note ? <> · <span className="text-accent">{entry.note}</span></> : null}
        </div>
      </div>
      {onMark ? (
        <button type="button" onClick={() => onMark(entry)} title="Marcar como publicado hoje" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12px] font-medium text-[#08130C] hover:opacity-90">
          <Check size={14} /> Publiquei
        </button>
      ) : null}
      <button type="button" onClick={() => onRemove(entry.id)} aria-label="Remover do plano" className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-faint transition-colors hover:text-neg">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Card 1: o DRIVER (hoje + cadência + próximos + gerar) ───────────────────────
export function AdsCalendar() {
  const add = useAdsCalendar((s) => s.add);
  const remove = useAdsCalendar((s) => s.remove);
  const { todayK, overdue, today, upcoming } = useAgenda();
  const stats = useStats(todayK);
  const due = overdue.length + today.length;
  const hasPlan = due + upcoming.length > 0;
  const next = upcoming[0];

  const [showGen, setShowGen] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>("equilibrado");
  const [notify, setNotify] = useState(() => {
    try { return localStorage.getItem(NOTIFY_KEY) === "1"; } catch { return false; }
  });

  const boostStart = useAdsCalendar((s) => (s.entries.length ? s.entries.map((e) => e.date).sort()[0] : todayK));

  const markPosted = (e: CalEntry) => {
    add({ date: todayK, pieceId: e.pieceId, status: "posted" });
    remove(e.id);
  };

  // Gera um roteiro pronto (ordem/cadência/variedade automáticas) — substitui o plano FUTURO e
  // preserva o histórico já postado.
  const generatePlan = () => {
    const st = useAdsCalendar.getState();
    const future = st.entries.filter((e) => e.status === "planned" && e.date >= todayK);
    if (future.length && !window.confirm("Gerar um novo plano substitui o que está planejado de hoje em diante (o histórico já postado é mantido). Continuar?")) return;
    future.forEach((e) => remove(e.id));
    for (const p of generateSchedule(new Date(), 4, intensity)) add({ date: p.date, pieceId: p.pieceId, status: "planned" });
    setShowGen(false);
  };

  // Aviso do navegador: 1× por dia, quando há peça pra hoje/atrasada.
  useEffect(() => {
    if (!notify || due === 0 || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      if (localStorage.getItem(NOTIFIED_ON) === todayK) return;
      new Notification("Nossas Finanças · Ads", { body: overdue.length ? `${due} peça(s) pra postar (inclui atrasadas).` : `${due} peça(s) pra postar hoje.` });
      localStorage.setItem(NOTIFIED_ON, todayK);
    } catch { /* ignora */ }
  }, [notify, due, overdue.length, todayK]);

  const toggleNotify = async () => {
    if (notify) {
      setNotify(false);
      try { localStorage.setItem(NOTIFY_KEY, "0"); } catch { /* ignora */ }
      return;
    }
    if (typeof Notification === "undefined") return;
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    const on = perm === "granted";
    setNotify(on);
    try { localStorage.setItem(NOTIFY_KEY, on ? "1" : "0"); } catch { /* ignora */ }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-border bg-card p-4 sm:p-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-accent" />
              <h3 className="text-[15px] font-semibold text-text">Cronograma de conteúdo</h3>
            </div>
            <p className="mt-1 max-w-[440px] text-[12px] leading-relaxed text-faint">
              Gere um plano e, todo dia, poste o que aparecer em <b className="text-muted">Hoje</b> — depois toque em <b className="text-muted">Publiquei</b>.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleNotify}
              title={notify ? "Desligar avisos do navegador" : "Avisar no navegador quando houver post pra hoje"}
              className={cn("grid h-8 w-8 place-items-center rounded-[9px] border transition-colors", notify ? "border-accent/45 text-accent" : "border-border text-muted hover:text-text hover:border-border-strong")}
            >
              {notify ? <BellRing size={15} /> : <Bell size={15} />}
            </button>
            <button type="button" onClick={() => setShowGen((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12.5px] font-medium text-[#08130C] hover:opacity-90">
              <Sparkles size={14} /> Gerar plano
            </button>
          </div>
        </div>

        {/* controles de geração (revelados) */}
        {showGen ? (
          <div className="mt-3.5 rounded-[12px] border border-dashed border-border-strong bg-card2/50 p-3.5">
            <MicroLabel tone="muted">Roteiro automático · 4 semanas</MicroLabel>
            <p className="mt-1.5 mb-3 text-[12px] leading-relaxed text-muted">
              Escolhe a ordem, a cadência e a variedade por você (nunca duas peças parecidas seguidas). Substitui o plano futuro; o histórico postado fica.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-[9px] border border-border p-0.5">
                {(["leve", "equilibrado", "intenso"] as Intensity[]).map((k) => (
                  <button key={k} type="button" onClick={() => setIntensity(k)} className={cn("h-7 rounded-[7px] px-2.5 text-[11.5px] transition-colors", intensity === k ? "bg-accent font-medium text-[#08130C]" : "text-muted hover:text-text")}>
                    {INTENSITY_LABEL[k]}
                  </button>
                ))}
              </div>
              <button type="button" onClick={generatePlan} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[12.5px] font-medium text-[#08130C] hover:opacity-90">
                Gerar 4 semanas
              </button>
            </div>
          </div>
        ) : null}

        {/* HOJE — o foco do dia */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <MicroLabel tone={due ? (overdue.length ? "neg" : "accent") : "faint"}>Hoje{due ? ` · ${due} pra postar` : ""}</MicroLabel>
          </div>
          {due ? (
            <div className="space-y-2">
              {overdue.map((e) => <PieceRow key={e.id} entry={e} todayK={todayK} tone="neg" onMark={markPosted} onRemove={remove} />)}
              {today.map((e) => <PieceRow key={e.id} entry={e} todayK={todayK} tone="accent" onMark={markPosted} onRemove={remove} />)}
            </div>
          ) : hasPlan ? (
            <div className="flex items-center gap-3 rounded-[12px] border border-accent/30 bg-accent-soft/25 px-3.5 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Check size={16} /></span>
              <div className="min-w-0 text-[12.5px] leading-snug text-text">
                Você está em dia.{next ? <span className="text-muted"> Próximo: <b className="text-text">{PIECE[next.pieceId]?.label ?? next.pieceId}</b> · {relDay(next.date, todayK)}.</span> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-[12px] border border-dashed border-border-strong bg-card2/40 px-4 py-6 text-center">
              <p className="mx-auto mb-3 max-w-[360px] text-[12.5px] leading-relaxed text-muted">
                Sem plano ainda. Gere um roteiro de 4 semanas e o app te diz <b className="text-text">o que postar em cada dia</b> — na ordem certa e sem repetir.
              </p>
              <button type="button" onClick={() => setShowGen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-4 text-[12.5px] font-medium text-[#08130C] hover:opacity-90">
                <Sparkles size={14} /> Gerar plano de 4 semanas
              </button>
            </div>
          )}
        </div>

        {/* cadência do mês */}
        {(hasPlan || stats.monthCount > 0) ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3.5">
            <span className="inline-flex items-baseline gap-1.5 text-[12px] text-muted">
              <span className="tabular text-[15px] font-semibold text-text">{stats.monthCount}</span> postados no mês
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <Clock size={12} className="text-faint" />
              {stats.daysSince == null ? "sem posts ainda" : stats.daysSince === 0 ? "postou hoje ✓" : `há ${stats.daysSince}d sem postar`}
            </span>
            <span className="ml-auto flex items-center gap-2.5 text-[10.5px] text-faint">
              {stats.byPillar.map((p) => (
                <span key={p.pillar} title={`${p.pillar}: ${p.n} postado(s)`}>{p.pillar} <span className="tabular text-muted">{p.n}</span></span>
              ))}
            </span>
          </div>
        ) : null}

        {/* próximos dias */}
        {upcoming.length ? (
          <div className="mt-4 border-t border-border pt-3.5">
            <MicroLabel>Próximos dias</MicroLabel>
            <div className="mt-2 space-y-1.5">
              {upcoming.map((e) => <PieceRow key={e.id} entry={e} todayK={todayK} tone="muted" onRemove={remove} />)}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-faint">
              <b className="text-muted">Rotina:</b> post do feed → reposte no story · story → salve no <b className="text-muted">Destaque</b> indicado · 1º carrossel → fixe no topo.
            </p>
          </div>
        ) : null}
      </div>

      {/* Card 2: calendário do mês (overview + registrar manualmente) */}
      <MonthCalendar todayK={todayK} />

      {/* Card 3: impulsionamento */}
      {hasPlan ? <BoostCard start={boostStart} todayK={todayK} /> : null}
    </div>
  );
}

// ── Card 2: calendário do mês ───────────────────────────────────────────────────
function MonthCalendar({ todayK }: { todayK: string }) {
  const entries = useAdsCalendar((s) => s.entries);
  const add = useAdsCalendar((s) => s.add);
  const remove = useAdsCalendar((s) => s.remove);
  const now = new Date();

  const [open, setOpen] = useState(true);
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(todayK);
  const [pieceId, setPieceId] = useState(PIECES[0].id);
  const [status, setStatus] = useState<"posted" | "planned">("posted");
  const [note, setNote] = useState("");

  const byDate = useMemo(() => {
    const m: Record<string, CalEntry[]> = {};
    for (const e of entries) (m[e.date] ||= []).push(e);
    return m;
  }, [entries]);

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
  const dayEntries = selected ? byDate[selected] ?? [] : [];

  return (
    <div className="rounded-[16px] border border-border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 rounded-[16px] p-4 text-left transition-colors hover:bg-card2/30">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays size={16} className="shrink-0 text-accent" />
          <h3 className="text-[14px] font-semibold text-text">Calendário do mês</h3>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-faint sm:inline">ver histórico · registrar à mão</span>
        </div>
        <ChevronDown size={17} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="px-4 pb-4">
          {/* nav do mês */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="tabular text-[13px] font-medium text-text">{MONTHS[cur.m]} {cur.y}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={goToday} className="mr-1 h-7 rounded-[8px] border border-border px-2.5 text-[11.5px] text-muted transition-colors hover:border-border-strong hover:text-text">Hoje</button>
              <button type="button" onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted transition-colors hover:border-border-strong hover:text-text"><ChevronLeft size={15} /></button>
              <button type="button" onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted transition-colors hover:border-border-strong hover:text-text"><ChevronRight size={15} /></button>
            </div>
          </div>

          {/* grade */}
          <div className="grid grid-cols-7 gap-1">
            {WD.map((w) => (
              <div key={w} className="pb-1 text-center font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">{w}</div>
            ))}
            {cells.map((d) => {
              const k = key(d);
              const inMonth = d.getMonth() === cur.m;
              const es = byDate[k] ?? [];
              const postedN = es.filter((e) => e.status === "posted").length;
              const plannedN = es.filter((e) => e.status === "planned").length;
              const isToday = k === todayK;
              const isSel = k === selected;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelected(k)}
                  title={es.map((e) => `${PIECE[e.pieceId]?.label ?? e.pieceId} · ${e.status === "posted" ? "postado" : "planejado"}`).join("\n")}
                  className={cn(
                    "flex min-h-[52px] flex-col items-start rounded-[9px] border p-1.5 text-left transition-colors",
                    isSel ? "border-accent bg-card2" : "border-border hover:border-border-strong",
                    !inMonth && "opacity-40",
                  )}
                >
                  <span className={cn("tabular text-[11px]", isToday ? "grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-[#08130C]" : "text-muted")}>{d.getDate()}</span>
                  <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                    {postedN ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{postedN > 1 ? postedN : ""}</span>
                    ) : null}
                    {plannedN ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-muted"><span className="h-1.5 w-1.5 rounded-full border border-muted" />{plannedN > 1 ? plannedN : ""}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* legenda */}
          <div className="mt-2 flex items-center gap-3 text-[10.5px] text-faint">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> postado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full border border-muted" /> planejado</span>
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
                      <button type="button" onClick={() => remove(e.id)} className="ml-auto shrink-0 text-faint transition-colors hover:text-neg"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-2.5 text-[11.5px] text-faint">Nada aqui ainda — registre o que postou (ou planeje).</div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select value={pieceId} onChange={(e) => setPieceId(e.target.value)} className="h-8 min-w-0 flex-1 rounded-[8px] border border-border bg-card px-2 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  {PIECES.map((p) => (
                    <option key={p.id} value={p.id}>{KIND_META[p.kind].label} · {p.label}</option>
                  ))}
                </select>
                <div className="flex rounded-[8px] border border-border p-0.5">
                  {(["posted", "planned"] as const).map((st) => (
                    <button key={st} type="button" onClick={() => setStatus(st)} className={cn("h-7 rounded-[6px] px-2.5 text-[11.5px] transition-colors", status === st ? "bg-accent font-medium text-[#08130C]" : "text-muted hover:text-text")}>
                      {st === "posted" ? "Postado" : "Planejado"}
                    </button>
                  ))}
                </div>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="nota (opcional)" className="h-8 w-full flex-1 rounded-[8px] border border-border bg-card px-2.5 text-[12px] text-text placeholder:text-faint outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:w-auto" />
                <button type="button" onClick={() => { add({ date: selected, pieceId, status, note: note.trim() || undefined }); setNote(""); }} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[12px] font-medium text-[#08130C] hover:opacity-90">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Card 3: impulsionamento ─────────────────────────────────────────────────────
function BoostCard({ start, todayK }: { start: string; todayK: string }) {
  const [open, setOpen] = useState(false);
  const recs = useMemo(() => boostPlan(parse(start)), [start]);
  const nextIdx = recs.findIndex((r) => todayK < r.date);
  return (
    <div className="rounded-[16px] border border-border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 rounded-[16px] p-4 text-left transition-colors hover:bg-card2/30">
        <div className="flex min-w-0 items-center gap-2">
          <Rocket size={15} className="shrink-0 text-accent" />
          <h3 className="text-[14px] font-semibold text-text">Impulsionamento</h3>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-faint sm:inline">quando pagar pra promover</span>
        </div>
        <ChevronDown size={17} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="px-4 pb-4">
          <p className="mb-3 text-[11.5px] leading-relaxed text-faint">
            Nas <b className="text-muted">2 primeiras semanas</b> não impulsione — poste orgânico e veja o que mais salva/compartilha. Depois, siga o plano:
          </p>
          <div className="space-y-2">
            {recs.map((r, i) => {
              const active = todayK >= r.date;
              const isNext = i === nextIdx;
              return (
                <div key={i} className={cn("rounded-[12px] border px-3.5 py-3", active ? "border-accent/45 bg-accent-soft/35" : isNext ? "border-border-strong bg-card2" : "border-border bg-card2/60")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[12.5px] font-medium text-text">{PIECE[r.pieceId]?.label ?? r.pieceId}</span>
                    <span className={cn("shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]", active ? "text-accent" : "text-faint")}>{r.window} · {relDay(r.date, todayK)}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted">{r.why}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-faint">
                    <span><b className="text-muted">Verba:</b> {r.budget} · {r.days}</span>
                    <span><b className="text-muted">Objetivo:</b> {r.objective}</span>
                    <span><b className="text-muted">Público:</b> {r.audience}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
