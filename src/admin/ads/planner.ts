// Gerador de ROTEIRO de postagem — determinístico, SEM IA. Responde "o que postar, em que ordem":
// distribui as peças (posts/carrosséis/stories) ao longo dos dias com cadência fixa e VARIEDADE
// (nunca dois do mesmo pilar/formato/tipo colados; o carrossel de apresentação lidera o feed).
import { POSTS, EDU_POSTS, STORIES, EDU_STORIES, CAROUSELS, EDU_CAROUSELS } from "./engine";

export type Intensity = "leve" | "equilibrado" | "intenso";
export const INTENSITY_LABEL: Record<Intensity, string> = {
  leve: "Leve · ~4/sem",
  equilibrado: "Equilibrado · ~7/sem",
  intenso: "Intenso · quase diário",
};

type Fmt = "post" | "carousel" | "story";
interface PlanPiece {
  id: string; // pieceId "post:..|story:..|carousel:.."
  pillar: string; // tema (pra espaçar assuntos iguais)
  format: Fmt;
  edu: boolean; // educativo × institucional (pra alternar)
}

/** Tema aproximado de um story pelo id — só pra espaçar assuntos iguais no roteiro. */
function storyTheme(id: string): string {
  const s = id.toLowerCase();
  if (s.includes("privac")) return "privacidade";
  if (s.includes("cambio") || s.includes("fronteira") || s.includes("patrimonio")) return "multimoeda";
  if (s.includes("orcamento") || s.includes("simples")) return "orcamento";
  if (s.includes("reserva")) return "reserva";
  if (s.includes("juros") || s.includes("diversific")) return "investir";
  if (s.includes("divida")) return "dividas";
  if (s.includes("futuro") || s.includes("liberdade")) return "liberdade";
  if (s.includes("tour")) return "apresentacao";
  return "geral";
}

/** Destaque (Highlight) onde salvar cada story — casa com as 5 capas geradas em HIGHLIGHTS. */
function storyHighlight(id: string): string {
  const s = id.toLowerCase();
  if (s.includes("tour") || s.includes("simples")) return "Comece aqui";
  if (s.includes("privac")) return "Privacidade";
  if (s.includes("build") || s.includes("bastidor")) return "Bastidores";
  if (s.includes("cambio") || s.includes("fronteira") || s.includes("patrimonio") || s.includes("diversific")) return "Multimoeda";
  return "Liberdade"; // orçamento/reserva/juros/dívidas/futuro/liberdade e demais
}

const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};

/** Feed = posts + carrosséis (institucionais e educativos). */
const FEED: PlanPiece[] = [
  ...POSTS.map((p) => ({ id: `post:${p.id}`, pillar: p.pillar, format: "post" as Fmt, edu: false })),
  ...CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, pillar: c.pillar, format: "carousel" as Fmt, edu: false })),
  ...EDU_POSTS.map((p) => ({ id: `post:${p.id}`, pillar: p.pillar, format: "post" as Fmt, edu: true })),
  ...EDU_CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, pillar: c.pillar, format: "carousel" as Fmt, edu: true })),
];
/** Stories (institucionais e educativos) — trilha própria (formato leve, cadência à parte). */
const STORY: PlanPiece[] = [
  ...STORIES.map((s) => ({ id: `story:${s.id}`, pillar: storyTheme(s.id), format: "story" as Fmt, edu: false })),
  ...EDU_STORIES.map((s) => ({ id: `story:${s.id}`, pillar: storyTheme(s.id), format: "story" as Fmt, edu: true })),
];

/**
 * Ordena um conjunto pra dar VARIEDADE: a cada passo escolhe a peça que mais difere da anterior —
 * pilar diferente (peso 3), formato diferente (2), tipo (edu×inst) diferente (1). Empate → ordem
 * original (determinístico). `seedId` fixa a 1ª peça (ex.: carrossel de apresentação abre o feed).
 */
export function orderPieces(pool: PlanPiece[], seedId?: string): PlanPiece[] {
  const rem = pool.slice();
  const out: PlanPiece[] = [];
  let lp: string | null = null;
  let lf: Fmt | null = null;
  let le: boolean | null = null;
  const push = (i: number) => {
    const p = rem.splice(i, 1)[0];
    out.push(p);
    lp = p.pillar;
    lf = p.format;
    le = p.edu;
  };
  const seed = seedId ? rem.findIndex((p) => p.id === seedId) : -1;
  if (seed >= 0) push(seed);
  while (rem.length) {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < rem.length; i++) {
      const p = rem[i];
      let sc = 0;
      if (p.pillar !== lp) sc += 3;
      if (p.format !== lf) sc += 2;
      if (p.edu !== le) sc += 1;
      sc -= i * 0.001; // desempate estável pela ordem original
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    }
    push(best);
  }
  return out;
}

/** Dias da semana de cada trilha por intensidade (0=dom … 6=sáb). */
const RHYTHM: Record<Intensity, { feed: number[]; story: number[] }> = {
  leve: { feed: [1, 3, 5], story: [6] }, // seg/qua/sex + sáb story
  equilibrado: { feed: [1, 3, 5, 6], story: [2, 4, 0] }, // seg/qua/sex/sáb + ter/qui/dom story
  intenso: { feed: [1, 2, 4, 5, 6], story: [3, 0] },
};

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface PlanEntry {
  date: string;
  pieceId: string;
  /** O que fazer com a peça (repostar no story / salvar no destaque / fixar). */
  note?: string;
}

/**
 * Gera o roteiro dos próximos `weeks` a partir de `start`: em cada dia, conforme a intensidade,
 * coloca a próxima peça de feed OU de story (ciclando as filas já ordenadas por variedade) — e já
 * anexa a AÇÃO daquela peça (feed → repostar no story; story → salvar no destaque; 1º carrossel → fixar).
 */
export function generateSchedule(start: Date, weeks: number, intensity: Intensity): PlanEntry[] {
  const feedOrder = orderPieces(FEED, "carousel:tour");
  const storyOrder = orderPieces(STORY, "story:app-tour");
  const { feed, story } = RHYTHM[intensity];
  const out: PlanEntry[] = [];
  let fi = 0;
  let si = 0;
  const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let n = 0; n < weeks * 7; n++) {
    const d = new Date(base);
    d.setDate(base.getDate() + n);
    const wd = d.getDay();
    if (feed.includes(wd) && feedOrder.length) {
      const p = feedOrder[fi % feedOrder.length];
      const note = fi === 0 ? "Fixar no topo do perfil + repostar no story" : "Repostar no story (novo post 👇)";
      out.push({ date: key(d), pieceId: p.id, note });
      fi++;
    } else if (story.includes(wd) && storyOrder.length) {
      const p = storyOrder[si % storyOrder.length];
      out.push({ date: key(d), pieceId: p.id, note: `Salvar no Destaque "${storyHighlight(p.id)}"` });
      si++;
    }
  }
  return out;
}

export interface BoostRec {
  date: string;
  pieceId: string;
  window: string; // "Semana 3" etc.
  budget: string;
  days: string;
  objective: string;
  audience: string;
  why: string;
}

/**
 * Plano de IMPULSIONAMENTO (quando pagar pra promover), ancorado no início do roteiro. Regra de
 * ouro embutida: nada nas 2 primeiras semanas (medir orgânico), depois impulsionar as peças certas.
 */
export function boostPlan(start: Date): BoostRec[] {
  const at = (n: number) => key(addDays(start, n));
  return [
    {
      date: at(14),
      pieceId: "carousel:tour",
      window: "Semana 3",
      budget: "R$ 20–30/dia",
      days: "5–7 dias",
      objective: "Visitas ao perfil (crescer base)",
      audience: "Finanças pessoais · investimentos · expatriados / morar fora",
      why: "É a apresentação do app — explica tudo e tem CTA. Comece por ela.",
    },
    {
      date: at(24),
      pieceId: "post:privacidade",
      window: "Semana 4",
      budget: "R$ 20–30/dia",
      days: "5–7 dias",
      objective: "Alcance / seguidores",
      audience: "Amplo — finanças, privacidade, tecnologia",
      why: "Tema que gera reação e compartilhamento (bom pra alcance).",
    },
    {
      date: at(34),
      pieceId: "post:custo-vida",
      window: "Semana 5",
      budget: "R$ 15–25/dia",
      days: "5 dias",
      objective: "Visitas ao site (link na bio)",
      audience: "SÓ brasileiros na Itália / quem quer morar fora",
      why: "Campanha de nicho: relevância altíssima num público pequeno = clique barato.",
    },
  ];
}
