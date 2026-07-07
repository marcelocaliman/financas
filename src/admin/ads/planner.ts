// Gerador de ROTEIRO de postagem — determinístico, SEM IA. Responde "o que postar, em que ordem, em
// que FORMATO e o que fazer no story". 3 TRILHAS que não competem (best-practice 2026):
//  • FEED (posts 4:5 + carrosséis) = portfólio permanente. Qualidade > quantidade (3–4/sem).
//  • REELS (os vídeos 9:16) = motor de DESCOBERTA (alcança quem NÃO segue). 2–3/sem. Vídeo é SEMPRE
//    postado como REEL — nunca queimado num story de 24h.
//  • STORIES = toque LEVE diário (aquece quem já segue). NÃO consome peça: nos dias com post/reel é o
//    repost do dia; nos dias sem, 1 story rotativo de 10s (STORY_ROTATION). Pular é OK — é bônus.
// Não existe "cansar o algoritmo" por postar demais: o limite é HUMANO (manter por meses) + qualidade
// (cada post disputa a MESMA audiência). Como as peças pesadas já existem no estúdio, o trabalho diário
// vira "postar a próxima da fila + 1 story leve".
import { POSTS, EDU_POSTS, STORIES, EDU_STORIES, CAROUSELS, EDU_CAROUSELS } from "./engine";

export type Intensity = "leve" | "equilibrado" | "intenso";
export const INTENSITY_LABEL: Record<Intensity, string> = {
  leve: "Leve · ~4/sem (2 feed + 2 reels)",
  equilibrado: "Equilibrado · ~5/sem (3 feed + 2 reels)",
  intenso: "Intenso · ~6/sem (3 feed + 3 reels) — só campanha",
};

type Fmt = "post" | "carousel" | "reel";
interface PlanPiece {
  id: string; // pieceId "post:..|story:..|carousel:.." (o prefixo "story:" hoje É um REEL — mantido por compat)
  pillar: string; // tema (pra espaçar assuntos iguais)
  format: Fmt;
  edu: boolean; // educativo × institucional (pra alternar)
}

/** Tema aproximado de um vídeo/reel pelo id — só pra espaçar assuntos iguais no roteiro. */
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

/** Destaque (Highlight) onde salvar cada reel/story — casa com as 5 capas geradas em HIGHLIGHTS. */
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

/** FEED = posts + carrosséis (institucionais e educativos). */
const FEED: PlanPiece[] = [
  ...POSTS.map((p) => ({ id: `post:${p.id}`, pillar: p.pillar, format: "post" as Fmt, edu: false })),
  ...CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, pillar: c.pillar, format: "carousel" as Fmt, edu: false })),
  ...EDU_POSTS.map((p) => ({ id: `post:${p.id}`, pillar: p.pillar, format: "post" as Fmt, edu: true })),
  ...EDU_CAROUSELS.map((c) => ({ id: `carousel:${c.id}`, pillar: c.pillar, format: "carousel" as Fmt, edu: true })),
];
/** REELS = os vídeos 9:16 (institucionais e educativos). Trilha própria — 2–3/sem, motor de descoberta.
 *  O prefixo do id segue "story:" (compat com o estúdio e com planos já salvos); o FORMATO é reel. */
const REELS: PlanPiece[] = [
  ...STORIES.map((s) => ({ id: `story:${s.id}`, pillar: storyTheme(s.id), format: "reel" as Fmt, edu: false })),
  ...EDU_STORIES.map((s) => ({ id: `story:${s.id}`, pillar: storyTheme(s.id), format: "reel" as Fmt, edu: true })),
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

/** Dias da semana de cada trilha por intensidade (0=dom … 6=sáb). MOLDE flexível, não lei — sáb/dom
 *  rendem menos em finanças; pode deslocar. Dias sem feed/reel = story leve (bônus, ver STORY_ROTATION). */
const RHYTHM: Record<Intensity, { feed: number[]; reel: number[] }> = {
  leve: { feed: [1, 5], reel: [3, 6] }, // seg/sex feed + qua/sáb reel = 4/sem
  equilibrado: { feed: [1, 3, 5], reel: [2, 6] }, // seg/qua/sex feed + ter/sáb reel = 5/sem
  intenso: { feed: [1, 3, 5], reel: [2, 4, 6] }, // 3 feed + 3 reel = 6/sem (só campanha)
};

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** STORY LEVE rotativo pros dias SEM peça principal — 10s, zero produção. Escolha 1. */
export const STORY_ROTATION: string[] = [
  "📊 Enquete: “Você guarda dinheiro em mais de uma moeda?” → Sim, mais de uma / Só em real.",
  "🛠️ Bastidor: print do código ou de uma tela + “Construindo o Nossas Finanças hoje 👨‍💻”.",
  "❓ Caixa de perguntas: “Pergunta o que quiser sobre organizar dinheiro / morar fora / o app 👇”.",
  "🔁 Repost de destaque: um Reel/post forte de 1–2 semanas atrás — “caso você tenha perdido 👇”.",
  "🔢 Enquete-quiz: “Quantos meses de gasto tem que ter na reserva?” → 1 / 3 a 6 / 12 (revela amanhã).",
  "💬 Escala: barra 😅→😎 “De 0 a 10, o quanto você sente que controla o seu dinheiro?”.",
  "🌍 Enquete: “Você mora fora, pensa em morar, ou tá firme no Brasil?” → Moro fora / Quero ir / Fico no BR.",
  "👀 Teaser: print de uma tela do app com uma parte borrada — “adivinha o que é? resposta amanhã”.",
];
/** Sugestão de story leve DETERMINÍSTICA por data (varia sem repetir no curto prazo). */
export function storyForDate(dateK: string): string {
  const [y, m, d] = dateK.split("-").map(Number);
  const doy = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
  return STORY_ROTATION[((doy % STORY_ROTATION.length) + STORY_ROTATION.length) % STORY_ROTATION.length];
}

/** Instrução EXPLÍCITA de um FEED (post/carrossel). */
function feedNote(isFirst: boolean, isCarousel: boolean): string {
  const arrasta = isCarousel ? "Arraste os slides na ordem; 1 legenda pro conjunto. " : "";
  const repost = "Depois de publicar, reposte no story (“saiu post novo 👇”) com sticker de link pra bio.";
  if (isFirst) return `${arrasta}FIXE no topo do perfil (é a sua vitrine). ${repost}`;
  return `${arrasta}${repost}`;
}
/** Instrução EXPLÍCITA de um REEL. */
function reelNote(highlight: string): string {
  return `Poste como REEL 9:16 (é o que alcança quem NÃO te segue). Depois reposte no story (“vídeo novo 👇”) e salve no Destaque “${highlight}”.`;
}

export interface PlanEntry {
  date: string;
  pieceId: string;
  /** O que fazer com a peça (formato + repost no story + salvar no destaque / fixar). */
  note?: string;
}

/**
 * Gera o roteiro dos próximos `weeks` a partir de `start`: em cada dia de FEED coloca a próxima peça
 * de feed; em cada dia de REEL a próxima de reel (filas já ordenadas por variedade). Dias sem peça NÃO
 * geram entrada — o story leve daquele dia é sugerido na UI (storyForDate). O carrossel de apresentação
 * lidera o feed e é fixado no topo.
 */
export function generateSchedule(start: Date, weeks: number, intensity: Intensity): PlanEntry[] {
  const feedOrder = orderPieces(FEED, "carousel:tour");
  const reelOrder = orderPieces(REELS);
  const { feed, reel } = RHYTHM[intensity];
  const out: PlanEntry[] = [];
  let fi = 0;
  let ri = 0;
  const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let n = 0; n < weeks * 7; n++) {
    const d = new Date(base);
    d.setDate(base.getDate() + n);
    const wd = d.getDay();
    if (feed.includes(wd) && feedOrder.length) {
      const p = feedOrder[fi % feedOrder.length];
      out.push({ date: key(d), pieceId: p.id, note: feedNote(fi === 0, p.format === "carousel") });
      fi++;
    } else if (reel.includes(wd) && reelOrder.length) {
      const p = reelOrder[ri % reelOrder.length];
      out.push({ date: key(d), pieceId: p.id, note: reelNote(storyHighlight(p.id)) });
      ri++;
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
