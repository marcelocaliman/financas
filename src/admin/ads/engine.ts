// Engine dos "stories" de divulgação (só super-admin): desenha cada anúncio num <canvas> 1080×1920
// (9:16, formato Story) ao longo do tempo — texto + motivos animados na estética da marca. O mesmo
// render serve pra prévia (loop) e pra exportar MP4 (grava o canvas com MediaRecorder). Resolução-
// independente: tudo escala por s = W/1080, então preview pequena e export grande usam o MESMO código.

export const SCENE_DUR = 4; // segundos por "página" do story (ritmo calmo, dá tempo de ler)
const LAST_HOLD = 2.5; // segundos EXTRAS na última cena (CTA): fica parada, sem fade, pra dar tempo de clicar
const BG = "#0A0B0D";
const TEXT = "#F3F4F6";
const MUTED = "#9CA2AC";
const FAINT = "#5F646C";
const ACCENT = "#3ECF8E";
const CARD2 = "#191B20";
const CARD = "#131418";

/** Posição do glow por story (x,y em fração) — dá ambiance diferente pra cada peça. */
const GLOW: Record<string, [number, number]> = {
  privacidade: [0.28, 0.2],
  patrimonio: [0.74, 0.16],
  orcamento: [0.5, 0.4],
};

/** Foto de fundo temática por story (bem sutil + filtrada) — dá calor humano. Servida same-origin
 *  (/img/ads) → sem taint no canvas/MP4. A foto é carregada pelo chamador e passada ao drawStory. */
export const PHOTO_SRC: Record<string, string> = {
  patrimonio: "/img/ads/global.jpg",
  privacidade: "/img/ads/person.jpg",
  orcamento: "/img/ads/life.jpg",
};

export interface Scene {
  kind: "hook" | "networth" | "budget" | "privacy" | "cta";
  eyebrow?: string;
  title?: string[]; // linhas
  sub?: string;
  value?: string; // número-herói (networth/cta)
  badges?: string[]; // moedas
  bars?: { label: string; w: number; c?: string }[];
  tagline?: string;
  mock?: "currencies" | "masked" | "donut"; // mockup do app na cena de hook (preenche + varia)
  chips?: string[]; // pílulas de features (cena de amplitude/benefício)
}
export interface Story {
  id: string;
  name: string; // rótulo no admin
  scenes: Scene[];
}

export const STORIES: Story[] = [
  // Arco de cada peça: PROBLEMA (a dor) → O APP (mockup + o que é) → AMPLITUDE/BENEFÍCIO → CTA.
  {
    id: "patrimonio",
    name: "Quanto você tem",
    scenes: [
      { kind: "hook", eyebrow: "DINHEIRO EM MAIS DE UMA MOEDA?", title: ["Real, euro, dólar…", "quanto você tem", "somando tudo?"] },
      { kind: "hook", mock: "currencies", eyebrow: "UM PAINEL SÓ", title: ["Tudo, em", "qualquer moeda."], sub: "Na cotação de hoje — sem planilha, sem abrir conta." },
      { kind: "hook", eyebrow: "E VAI MUITO ALÉM", title: ["Sua vida", "financeira inteira."], chips: ["Patrimônio", "Orçamento", "Investimentos", "Metas", "Projeção"] },
      { kind: "cta", value: "Nossas Finanças", tagline: "Multimoeda de verdade", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "privacidade",
    name: "Privacidade",
    scenes: [
      { kind: "hook", eyebrow: "SOBRE OS APPS DE FINANÇAS", title: ["Eles veem tudo", "o que você tem.", "E lucram com isso."] },
      { kind: "hook", mock: "masked", eyebrow: "CRIPTOGRAFIA PONTA A PONTA", title: ["O nosso não", "vê nada."], sub: "Tudo cifrado no seu aparelho. Nem eu, no servidor, vejo." },
      { kind: "hook", eyebrow: "PRIVACIDADE DE VERDADE", title: ["Seus números.", "Só seus."], sub: "Sem anúncios e sem vender os seus dados." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Privado · Local-first", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "orcamento",
    name: "Orçamento & liberdade",
    scenes: [
      { kind: "hook", eyebrow: "TODO FIM DE MÊS", title: ["Pra onde foi", "o seu dinheiro?"] },
      { kind: "hook", mock: "donut", eyebrow: "ORÇAMENTO", title: ["Cada real,", "organizado."], sub: "Em qualquer moeda, com o gráfico do mês." },
      { kind: "hook", eyebrow: "E O FUTURO?", title: ["Veja quando você", "fica livre."], sub: "Projeção de independência financeira, no seu ritmo." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Planeje · Projete · Conquiste", sub: "nossasfinancas.com.br" },
    ],
  },
];

export const storyDuration = (st: Story) => st.scenes.length * SCENE_DUR + LAST_HOLD;

// ── POSTS ESTÁTICOS (feed 4:5, 1080×1350, exportados em PNG) ─────────────────
// Mesma estética/engine dos stories, mas UM quadro parado por peça (sem animação/tempo). 6 peças
// cobrindo os 4 pilares: multimoeda/cross-border, privacidade, organização/FIRE, build-in-public.
export interface Post {
  id: string;
  name: string; // rótulo no admin
  pillar: string; // pilar (rótulo no card)
  glow?: [number, number]; // posição do brilho (fração de W,H)
  photo?: string; // foto de fundo (/img/ads/...) — dá variedade ao feed
  green?: boolean; // fundo verde PROFUNDO (variante esverdeada)
  eyebrow: string;
  title: string[]; // linhas
  sub?: string;
  mock?: "currencies" | "masked" | "donut"; // mockup do app
  chips?: string[]; // pílulas
  compare?: { head: [string, string]; rows: { label: string; a: string; b: string }[] }; // tabela BR×IT
  caption?: string; // legenda pronta pro Instagram (copiar e colar)
  tags?: string[]; // hashtags (sem #)
}

export const POSTS: Post[] = [
  {
    id: "multimoeda",
    name: "Multimoeda · somando tudo",
    pillar: "Multimoeda",
    caption:
      "Real na conta daqui, euro guardado lá fora, uns dólares investidos… e no fim você não sabe QUANTO tem no total. 🤯\n\nO Nossas Finanças junta tudo num número só, na cotação de hoje — sem planilha e sem abrir conta em lugar nenhum. Cada item guarda a própria moeda; você só escolhe em qual ver o total.\n\nSeu patrimônio inteiro, numa tela. 👀\n\n📲 Grátis pra começar — link na bio.",
    tags: ["financaspessoais", "multimoeda", "expatriados", "brasileirosnoexterior", "cambio", "controlefinanceiro", "vidafinanceira", "dinheiro", "organizacaofinanceira", "patrimonio"],
    photo: "/img/ads/global.jpg",
    eyebrow: "REAL, EURO, DÓLAR",
    title: ["Quanto você tem", "somando tudo?"],
    mock: "currencies",
    sub: "Cada moeda na cotação de hoje, num número só — sem planilha, sem abrir conta.",
  },
  {
    id: "custo-vida",
    name: "Custo de vida · BR × Itália",
    pillar: "Multimoeda",
    caption:
      "Quanto custa a MESMA vida em São Paulo e em Milão? 🇧🇷🇮🇹\n\nAluguel, mercado, transporte, um jantar a dois — os números mudam muito (e nem sempre pra pior). Antes de se mudar, dá pra simular tudo nas duas moedas, lado a lado.\n\nÉ pra isso que existe o Nossas Finanças: seu patrimônio e seus gastos em real E euro, sem malabarismo de planilha.\n\n💬 Você toparia essa troca? Comenta aí.\n📲 Link na bio.",
    tags: ["custodevida", "morarnaitalia", "brasileirosnaitalia", "expatriados", "mudardepais", "euro", "relocation", "vivernaitalia", "multimoeda", "financaspessoais"],
    glow: [0.3, 0.16],
    eyebrow: "MUDAR DE PAÍS",
    title: ["São Paulo", "× Milão"],
    compare: {
      head: ["SÃO PAULO", "MILÃO"],
      rows: [
        { label: "Aluguel (1 quarto)", a: "R$ 2.800", b: "€ 1.100" },
        { label: "Mercado no mês", a: "R$ 1.200", b: "€ 320" },
        { label: "Transporte/mês", a: "R$ 220", b: "€ 39" },
        { label: "Jantar a dois", a: "R$ 180", b: "€ 55" },
      ],
    },
    sub: "O app mostra o seu patrimônio e os gastos nas duas moedas, lado a lado.",
  },
  {
    id: "privacidade",
    name: "Privacidade · eles lucram",
    pillar: "Privacidade",
    caption:
      "A maioria dos apps de finanças lê CADA número seu — e ganha dinheiro com isso (anúncio, venda de dado, “parceiros”). 🫥\n\nO Nossas Finanças foi feito ao contrário: seus dados são cifrados no seu próprio aparelho, antes de irem pra qualquer lugar. Nem eu, no servidor, consigo ver os seus valores. Criptografia ponta a ponta, de verdade.\n\nPrivacidade não é um recurso. É a fundação. 🔒\n\n📲 Grátis — link na bio.",
    tags: ["privacidade", "criptografia", "segurancadigital", "protecaodedados", "financaspessoais", "dadospessoais", "semrastreio", "e2ee", "tecnologia", "financas"],
    photo: "/img/ads/person.jpg",
    eyebrow: "SOBRE OS APPS DE FINANÇAS",
    title: ["Eles veem tudo", "o que você tem.", "E lucram com isso."],
    mock: "masked",
    sub: "O nosso não vê nada: tudo cifrado no seu aparelho. Nem eu, no servidor.",
  },
  {
    id: "orcamento",
    name: "Orçamento · pra onde foi",
    pillar: "Organização",
    caption:
      "Todo fim de mês a mesma pergunta: cadê o dinheiro? 😅\n\nQuando cada gasto está organizado por categoria — em qualquer moeda — a resposta vira um gráfico. Você vê pra onde foi, corta o que não faz sentido e sobra mais no fim do mês.\n\nSem culpa e sem planilha gigante. Só clareza.\n\n📲 Comece grátis — link na bio.",
    tags: ["orcamento", "controlefinanceiro", "organizacaofinanceira", "financaspessoais", "economia", "planejamentofinanceiro", "dinheiro", "gastos", "educacaofinanceira", "vidafinanceira"],
    glow: [0.5, 0.4],
    eyebrow: "TODO FIM DE MÊS",
    title: ["Pra onde foi", "o seu dinheiro?"],
    mock: "donut",
    sub: "Cada real organizado por categoria — em qualquer moeda, com o gráfico do mês.",
  },
  {
    id: "liberdade",
    name: "Liberdade · quando fica livre",
    pillar: "Organização / FIRE",
    caption:
      "Independência financeira não é sorte — é conta. 📈\n\nCom quanto você para de depender do salário? Em quantos anos? O Nossas Finanças projeta o seu futuro com aportes e inflação real, ano a ano, no SEU ritmo. Dá pra ver a data chegar mais perto cada vez que você guarda um pouco mais.\n\nO primeiro passo é enxergar o número. 🎯\n\n📲 Link na bio.",
    tags: ["independenciafinanceira", "fire", "liberdadefinanceira", "investimentos", "aposentadoria", "financaspessoais", "investir", "projecaofinanceira", "patrimonio", "dinheiro"],
    green: true,
    glow: [0.6, 0.32],
    eyebrow: "E O FUTURO?",
    title: ["Veja quando", "você fica livre."],
    sub: "Projeção de independência financeira com aportes e inflação real — no seu ritmo.",
    chips: ["Projeção", "Aportes", "Inflação real", "Ano a ano"],
  },
  {
    id: "build",
    name: "Build in public · dev",
    pillar: "Build in public",
    caption:
      "Confissão: eu não achei o app que eu queria… então construí. 👨‍💻\n\nSou dev e estou me mudando do Brasil pra Itália. Precisava enxergar meu dinheiro em real E euro, num lugar só, sem entregar meus dados pra ninguém. Como não existia do jeito certo — privado, multimoeda e simples — fiz o Nossas Finanças. E abri de graça pra você usar.\n\nTô construindo à vista de todos. Bora junto? 🚀\n\n📲 Link na bio.",
    tags: ["buildinpublic", "devbr", "empreendedorismo", "startup", "multimoeda", "privacidade", "brasileirosnaitalia", "indiehacker", "financaspessoais", "fazendoacontecer"],
    photo: "/img/ads/life.jpg",
    eyebrow: "POR QUE EXISTE",
    title: ["Construí porque", "eu mesmo precisava."],
    sub: "Sou dev e me mudo do Brasil pra Itália. Fiz o app que eu queria — privado e multimoeda — e abri pra você.",
    chips: ["Sem anúncios", "Sem rastreio", "Grátis pra começar"],
  },
];

// ── helpers ─────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Opacidade da cena: fade-in nos 1ºs 0.45s, fade-out nos últimos 0.35s (sobre o bg persistente). */
function sceneAlpha(lt: number, dur: number) {
  return Math.min(clamp01(lt / 0.6), clamp01((dur - lt) / 0.5));
}

function fontSans(px: number, weight = 600) {
  return `${weight} ${px}px Inter, system-ui, sans-serif`;
}
function fontMono(px: number, weight = 500) {
  return `${weight} ${px}px "JetBrains Mono", ui-monospace, monospace`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Logo desenhado em PATHS (sem imagem externa → sem risco de "tainted canvas" na gravação):
 *  quadrado verde + dois anéis "C" sobrepostos (aproxima o ícone). */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, d: number) {
  ctx.fillStyle = ACCENT;
  roundRect(ctx, x, y, d, d, d * 0.26);
  ctx.fill();
  const cy = y + d / 2;
  ctx.lineWidth = d * 0.12;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0A0B0D";
  ctx.beginPath();
  ctx.arc(x + d * 0.4, cy, d * 0.2, Math.PI * 0.34, Math.PI * 1.66);
  ctx.stroke();
  ctx.strokeStyle = "#A9FFD8";
  ctx.beginPath();
  ctx.arc(x + d * 0.6, cy, d * 0.2, Math.PI * 1.34, Math.PI * 0.66);
  ctx.stroke();
}

/** Selo de moeda (mono) tipo badge do app. */
function badge(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, code: string, on: boolean) {
  const padX = 20 * s, h = 46 * s;
  ctx.font = fontMono(24 * s, 600);
  const w = ctx.measureText(code).width + padX * 2;
  ctx.fillStyle = on ? "rgba(62,207,142,0.14)" : CARD2;
  roundRect(ctx, x, y, w, h, 12 * s);
  ctx.fill();
  ctx.fillStyle = on ? ACCENT : MUTED;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(code, x + padX, y + h / 2 + 1 * s);
  return w;
}

/** Donut (arcos) — composição do orçamento. `reveal` (0..1) desenha só até essa fração (animação). */
function drawDonut(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, th: number, segs: [number, string][], reveal = 1) {
  ctx.lineWidth = th;
  ctx.lineCap = "butt";
  let cum = 0;
  for (const [frac, color] of segs) {
    if (reveal <= cum) break;
    const visEnd = Math.min(cum + frac, reveal);
    const a0 = -Math.PI / 2 + cum * 2 * Math.PI;
    const a1 = -Math.PI / 2 + visEnd * 2 * Math.PI;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
    cum += frac;
  }
}

/** Card-mockup do app (screenshot estilizado): os elementos se CONSTROEM ao longo da cena (número
 *  conta, linhas/legenda em cascata, dots um a um, donut desenhando), como o mock da landing.
 *  `a` = alpha da cena/pop; `lt` = tempo local da cena (dispara as animações internas). */
function drawMockCard(ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, w: number, kind: "currencies" | "masked" | "donut", a: number, lt: number) {
  const h = w * (kind === "donut" ? 1.05 : 0.84); // altura ajustada ao conteúdo de cada mockup
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  const x = -w / 2, y = -h / 2;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 70 * s;
  ctx.shadowOffsetY = 34 * s;
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, 30 * s);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2 * s;
  roundRect(ctx, x, y, w, h, 30 * s);
  ctx.stroke();

  const px = x + 42 * s, py = y + 62 * s, iw = w - 84 * s;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const fade = (delay: number, dur = 0.45) => clamp01((lt - delay) / dur); // progresso de 1 elemento
  const eyebrow = (txt: string) => {
    ctx.fillStyle = FAINT;
    ctx.font = fontMono(20 * s, 600);
    ctx.letterSpacing = `${2 * s}px`;
    ctx.fillText(txt, px, py);
    ctx.letterSpacing = "0px";
  };

  if (kind === "currencies") {
    eyebrow("PATRIMÔNIO LÍQUIDO");
    // número contando de 0 até o valor
    const n = Math.round(1284500 * easeOut(clamp01((lt - 0.5) / 1.3)));
    ctx.fillStyle = TEXT;
    ctx.font = fontSans(56 * s, 600);
    ctx.fillText("R$ " + n.toLocaleString("pt-BR"), px, py + 66 * s);
    ctx.globalAlpha = a * fade(1.0);
    ctx.fillStyle = ACCENT;
    ctx.font = fontSans(24 * s, 600);
    ctx.fillText("▲ 2,4% no mês", px, py + 108 * s);
    ctx.globalAlpha = a;
    // linhas de moeda entram em cascata
    const rows: [string, string, boolean][] = [["BRL", "R$ 1.284.500", true], ["EUR", "€ 214.900", false], ["USD", "$ 236.200", false]];
    rows.forEach((r, i) => {
      const rp = fade(1.25 + i * 0.22);
      if (rp <= 0) return;
      ctx.globalAlpha = a * rp;
      const ry = py + 190 * s + i * 76 * s;
      badge(ctx, s, px, ry - 30 * s, r[0], r[2]);
      ctx.fillStyle = TEXT;
      ctx.font = fontSans(30 * s, 500);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(r[1], px + iw, ry - 8 * s);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (i < rows.length - 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(px, ry + 32 * s);
        ctx.lineTo(px + iw, ry + 32 * s);
        ctx.stroke();
      }
      ctx.globalAlpha = a;
    });
  } else if (kind === "masked") {
    eyebrow("PATRIMÔNIO LÍQUIDO");
    // dots cifrando um a um
    const shown = Math.floor(easeOut(clamp01((lt - 0.5) / 1.2)) * 7 + 1e-4);
    ctx.fillStyle = TEXT;
    for (let i = 0; i < shown; i++) {
      ctx.beginPath();
      ctx.arc(px + 22 * s + i * 46 * s, py + 48 * s, 15 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // chip "🔒 Só você vê" aparece depois
    const chp = fade(1.3);
    if (chp > 0) {
      ctx.globalAlpha = a * chp;
      const ct = "Só você vê", chipY = py + 108 * s, chH = 56 * s;
      ctx.font = fontSans(26 * s, 600);
      const cw = ctx.measureText(ct).width + 92 * s;
      ctx.fillStyle = "rgba(62,207,142,0.14)";
      roundRect(ctx, px, chipY, cw, chH, chH / 2);
      ctx.fill();
      const lx = px + 30 * s, lyc = chipY + chH / 2;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.arc(lx, lyc - 5 * s, 9 * s, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = ACCENT;
      roundRect(ctx, lx - 12 * s, lyc - 3 * s, 24 * s, 19 * s, 4 * s);
      ctx.fill();
      ctx.textBaseline = "middle";
      ctx.fillText(ct, px + 62 * s, lyc + 1 * s);
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = a;
    }
    // "gráfico" fantasma se desenhando
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 8 * s;
    ctx.lineCap = "round";
    const gy = py + 250 * s, pts = [0.7, 0.55, 0.62, 0.4, 0.5, 0.3, 0.22], seg = pts.length - 1;
    const cp = clamp01((lt - 0.8) / 1.4) * seg;
    ctx.beginPath();
    for (let i = 0; i <= seg; i++) {
      const gx = px + (iw * i) / seg, gyy = gy + 130 * s * pts[i];
      if (i === 0) {
        ctx.moveTo(gx, gyy);
        continue;
      }
      if (cp >= i) ctx.lineTo(gx, gyy);
      else {
        const tt = cp - (i - 1);
        if (tt > 0) {
          const gx0 = px + (iw * (i - 1)) / seg, gy0 = gy + 130 * s * pts[i - 1];
          ctx.lineTo(gx0 + (gx - gx0) * tt, gy0 + (gyy - gy0) * tt);
        }
        break;
      }
    }
    ctx.stroke();
  } else {
    eyebrow("ORÇAMENTO DO MÊS");
    const dcx = x + w / 2, dcy = py + 175 * s, dr = 118 * s;
    // donut se desenhando (sweep)
    drawDonut(ctx, dcx, dcy, dr, 46 * s, [[0.53, ACCENT], [0.31, "#8A8F98"], [0.16, CARD2]], easeInOut(clamp01((lt - 0.5) / 1.4)));
    const legs: [string, string, string][] = [["Moradia", ACCENT, "R$ 3.2k"], ["Alimentação", "#8A8F98", "R$ 1.9k"], ["Outros", CARD2, "R$ 980"]];
    legs.forEach((l, i) => {
      const lp = fade(1.3 + i * 0.2);
      if (lp <= 0) return;
      ctx.globalAlpha = a * lp;
      const ly = py + 350 * s + i * 62 * s;
      ctx.fillStyle = l[1];
      roundRect(ctx, px, ly - 15 * s, 20 * s, 20 * s, 5 * s);
      ctx.fill();
      ctx.fillStyle = MUTED;
      ctx.font = fontSans(28 * s, 500);
      ctx.textBaseline = "middle";
      ctx.fillText(l[0], px + 34 * s, ly - 4 * s);
      ctx.fillStyle = TEXT;
      ctx.textAlign = "right";
      ctx.fillText(l[2], px + iw, ly - 4 * s);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = a;
    });
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Fundo-foto temático, BEM sutil e filtrado (dessaturado + tinte verde + escurecido) + zoom
 *  Ken-Burns lento pra dar vida. `photo` já carregada (same-origin → sem taint). `t` = tempo. */
function drawPhotoBg(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, W: number, H: number, t: number) {
  const p = photo as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const iw = p.naturalWidth || p.width || 0, ih = p.naturalHeight || p.height || 0;
  if (!iw || !ih) return;
  ctx.save();
  // foto cover-fit + zoom lento (5% ao longo do story) — dessaturada e escura, BEM opaca
  const zoom = 1 + 0.05 * clamp01(t / 16);
  const scale = Math.max(W / iw, H / ih) * zoom;
  const dw = iw * scale, dh = ih * scale;
  ctx.globalAlpha = 0.17;
  ctx.filter = "grayscale(0.9) brightness(0.85) contrast(1.05)";
  ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.filter = "none";
  // tinte verde sutil (mantém a marca)
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, H);
  // vinheta escura (topo/base) pra o texto respirar
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(10,11,13,0.55)");
  g.addColorStop(0.45, "rgba(10,11,13,0.28)");
  g.addColorStop(1, "rgba(10,11,13,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Fundo persistente: quase-preto + glow verde suave que respira. */
function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, gx = 0.32, gy = 0.22) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.6);
  const cx = W * gx, cy = H * gy, r = W * (0.9 + 0.06 * breathe);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(62,207,142,${0.16 + 0.04 * breathe})`);
  g.addColorStop(0.55, "rgba(62,207,142,0.03)");
  g.addColorStop(1, "rgba(62,207,142,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Barrinhas de progresso (topo, estilo Story): uma por cena, preenchendo. */
function drawProgress(ctx: CanvasRenderingContext2D, s: number, W: number, n: number, t: number) {
  const pad = 54 * s, gap = 10 * s, y = 46 * s, h = 6 * s;
  const bw = (W - pad * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = pad + i * (bw + gap);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(ctx, x, y, bw, h, h / 2);
    ctx.fill();
    const fill = clamp01((t - i * SCENE_DUR) / (i === n - 1 ? SCENE_DUR + LAST_HOLD : SCENE_DUR));
    if (fill > 0) {
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, x, y, bw * fill, h, h / 2);
      ctx.fill();
    }
  }
}

/** Logo + wordmark (topo dos stories). */
function drawBrand(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, size = 46) {
  const d = size * s;
  drawMark(ctx, x, y, d);
  ctx.fillStyle = TEXT;
  ctx.font = fontSans(30 * s, 600);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Nossas Finanças", x + d + 18 * s, y + d / 2 + 1 * s);
}

function drawEyebrow(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, text: string, a: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = ACCENT;
  ctx.font = fontMono(34 * s, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = `${3 * s}px`;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = "0px";
  ctx.globalAlpha = 1;
}

function drawTitle(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, lines: string[], a: number, dy: number, px = 96) {
  ctx.globalAlpha = a;
  ctx.fillStyle = TEXT;
  ctx.font = fontSans(px * s, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const lh = (px + 8) * s;
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh + dy));
  ctx.globalAlpha = 1;
  return y + lines.length * lh;
}

/** Maior px (entre minPx e maxPx) que faz a LINHA MAIS LARGA caber em targetW (px de canvas).
 *  Deixa o título preencher a largura: linhas curtas ficam grandes, linhas longas não estouram. */
function fitTitlePx(ctx: CanvasRenderingContext2D, s: number, lines: string[], targetW: number, minPx: number, maxPx: number) {
  ctx.font = fontSans(100 * s, 600);
  let maxW = 1;
  for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);
  const px = (targetW / maxW) * 100;
  return Math.max(minPx, Math.min(maxPx, px));
}

/** Pílulas de features (cena de amplitude) — quebra em linhas se não couber. */
function drawChips(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, chips: string[], a: number, maxW: number) {
  ctx.globalAlpha = a;
  ctx.font = fontMono(24 * s, 500);
  const h = 54 * s, padX = 24 * s, gap = 12 * s;
  let cxp = x, cyp = y;
  for (const c of chips) {
    const w = ctx.measureText(c).width + padX * 2;
    if (cxp + w > x + maxW) {
      cxp = x;
      cyp += h + gap;
    }
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, cxp, cyp, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5 * s;
    roundRect(ctx, cxp, cyp, w, h, h / 2);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(c, cxp + padX, cyp + h / 2 + 1 * s);
    cxp += w + gap;
  }
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}

function drawSub(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, W: number, text: string, a: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = MUTED;
  ctx.font = fontSans(34 * s, 400);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  // wrap simples por largura
  const maxW = W - x - 90 * s;
  const words = text.split(" ");
  let line = "";
  let yy = y;
  const lh = 46 * s;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  ctx.globalAlpha = 1;
}

// ── cenas ───────────────────────────────────────────────────────────────────
function sceneContent(ctx: CanvasRenderingContext2D, s: number, W: number, H: number, sc: Scene, lt: number, a: number) {
  const x = 90 * s;
  const midY = H * 0.5;
  const rise = (1 - easeOut(lt / 0.85)) * 40 * s; // sobe ao entrar (mais suave)

  if (sc.kind === "hook") {
    const availW = (W - x * 2) * 0.99; // largura útil (título preenche quase toda a coluna)
    if (sc.mock) {
      // O APP: mockup em cima + legenda (título + sub) embaixo, título auto-ajustado à largura.
      const pop = easeOut(clamp01((lt - 0.15) / 0.85));
      const cardY = H * 0.29 + (1 - pop) * 30 * s;
      // Card maior e RETO. Largura de design 700 (era 540); passo o s proporcional pra o conteúdo
      // (números, barras, donut) escalar junto e manter o mesmo preenchimento do card.
      const D = 700;
      drawMockCard(ctx, s * (D / 540), W / 2, cardY, D * s, sc.mock, a * (0.3 + 0.7 * pop), lt);
      const px = fitTitlePx(ctx, s, sc.title || [], availW, 84, 104);
      const eyeY = H * 0.605;
      drawEyebrow(ctx, s, x, eyeY, sc.eyebrow || "", a);
      const tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 50) * s, sc.title || [], a, rise, px);
      if (sc.sub) drawSub(ctx, s, x, tb + 26 * s, W, sc.sub, a);
    } else {
      // PROBLEMA / BENEFÍCIO: título GRANDE que preenche a largura + sub/chips opcionais.
      const lines = sc.title || [];
      const px = fitTitlePx(ctx, s, lines, availW, 104, 150);
      const lh = (px + 8) * s;
      // do baseline do eyebrow ao 1º baseline do título. Usa px*0.72 (altura de caixa-alta do título)
      // pra o VÃO até o topo do título ficar CONSTANTE (~56s), independente do tamanho do título.
      const eyeGap = (px * 0.72 + 56) * s;
      const titleH = lines.length * lh;
      const extraH = sc.sub ? 150 * s : sc.chips ? 150 * s : 0;
      const blockH = eyeGap + titleH + extraH;
      const eyeY = (H - blockH) / 2 + px * 0.35 * s; // centraliza o bloco todo verticalmente
      drawEyebrow(ctx, s, x, eyeY, sc.eyebrow || "", a);
      let tb = drawTitle(ctx, s, x, eyeY + eyeGap, lines, a, rise, px);
      if (sc.sub) {
        drawSub(ctx, s, x, tb + 34 * s, W, sc.sub, a);
        tb += 90 * s;
      }
      if (sc.chips) drawChips(ctx, s, x, tb + 46 * s, sc.chips, a, W - x * 2);
    }
    return;
  }

  if (sc.kind === "privacy") {
    drawEyebrow(ctx, s, x, midY - 300 * s, sc.eyebrow || "", a);
    drawTitle(ctx, s, x, midY - 184 * s, sc.title || [], a, rise);
    if (sc.sub) drawSub(ctx, s, x, midY + 30 * s, W, sc.sub, a);
    // "cadeado + ••••" cifrando
    const ly = midY + 200 * s;
    ctx.globalAlpha = a;
    // cadeado
    const lx = x, lw = 64 * s, lh = 52 * s, ah = 30 * s;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.arc(lx + lw / 2, ly, ah / 2 + 6 * s, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    roundRect(ctx, lx, ly, lw, lh, 12 * s);
    ctx.fill();
    // dots cifrados aparecendo
    const dotN = 8;
    const shown = Math.floor(clamp01((lt - 0.4) / 1.1) * dotN);
    ctx.fillStyle = ACCENT;
    for (let i = 0; i < shown; i++) {
      ctx.beginPath();
      ctx.arc(lx + lw + 44 * s + i * 40 * s, ly + lh / 2, 11 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (sc.kind === "networth") {
    drawEyebrow(ctx, s, x, midY - 300 * s, sc.eyebrow || "", a);
    // número contando
    const target = Number(sc.value || 0);
    const p = easeOut(clamp01((lt - 0.2) / 1.2));
    const n = Math.round(target * p);
    ctx.globalAlpha = a;
    ctx.fillStyle = TEXT;
    ctx.font = fontSans(120 * s, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("R$ " + n.toLocaleString("pt-BR"), x, midY - 170 * s + rise);
    // variação
    ctx.fillStyle = ACCENT;
    ctx.font = fontSans(38 * s, 600);
    ctx.fillText("▲ 2,4% no mês", x, midY - 110 * s);
    // badges de moeda
    let bx = x;
    (sc.badges || []).forEach((code, i) => {
      bx += badge(ctx, s, bx, midY - 60 * s, code, i === 0) + 12 * s;
    });
    // mini gráfico subindo (desenha progressivo)
    const gy0 = midY + 90 * s, gh = 210 * s, gw = W - x * 2;
    const pts = [0.62, 0.55, 0.6, 0.42, 0.48, 0.3, 0.36, 0.14];
    const prog = easeInOut(clamp01((lt - 0.3) / 1.4));
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 8 * s;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    const total = pts.length - 1;
    for (let i = 0; i < pts.length; i++) {
      const seg = i / total;
      if (seg > prog) break;
      const px = x + (gw * i) / total;
      const py = gy0 + gh * pts[i];
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (sc.sub) drawSub(ctx, s, x, midY + 360 * s, W, sc.sub, a);
    ctx.globalAlpha = 1;
    return;
  }

  if (sc.kind === "budget") {
    drawEyebrow(ctx, s, x, midY - 320 * s, sc.eyebrow || "", a);
    drawTitle(ctx, s, x, midY - 230 * s, sc.title || [], a, rise);
    // barras preenchendo em cascata
    const bars = sc.bars || [];
    const by0 = midY + 20 * s, bh = 22 * s, gap = 60 * s, tw = W - x * 2 - 200 * s;
    bars.forEach((b, i) => {
      const yy = by0 + i * gap;
      ctx.globalAlpha = a;
      // trilho
      ctx.fillStyle = CARD2;
      roundRect(ctx, x, yy, tw, bh, bh / 2);
      ctx.fill();
      // preenchimento
      const bp = easeOut(clamp01((lt - 0.3 - i * 0.15) / 0.7));
      ctx.fillStyle = b.c || ACCENT;
      roundRect(ctx, x, yy, tw * b.w * bp, bh, bh / 2);
      ctx.fill();
      // rótulo
      ctx.fillStyle = MUTED;
      ctx.font = fontSans(28 * s, 500);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, x + tw + 24 * s, yy + bh / 2);
      ctx.globalAlpha = 1;
    });
    return;
  }

  if (sc.kind === "cta") {
    // logo grande centralizado + tagline + url
    ctx.globalAlpha = a;
    const d = 150 * s, cx = W / 2 - d / 2, cy = midY - 260 * s + rise;
    drawMark(ctx, cx, cy, d);
    ctx.textAlign = "center";
    ctx.fillStyle = TEXT;
    ctx.font = fontSans(72 * s, 600);
    ctx.textBaseline = "alphabetic";
    ctx.fillText(sc.value || "Nossas Finanças", W / 2, cy + d + 100 * s);
    if (sc.tagline) {
      ctx.fillStyle = ACCENT;
      ctx.font = fontMono(30 * s, 500);
      ctx.letterSpacing = `${2 * s}px`;
      ctx.fillText(sc.tagline.toUpperCase(), W / 2, cy + d + 165 * s);
      ctx.letterSpacing = "0px";
    }
    // pílula "abra grátis"
    ctx.font = fontSans(34 * s, 600);
    const pillT = "Abra grátis";
    const pw = ctx.measureText(pillT).width + 96 * s, ph = 82 * s, ppx = W / 2 - pw / 2, ppy = cy + d + 240 * s;
    ctx.fillStyle = ACCENT;
    roundRect(ctx, ppx, ppy, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = "#08130C";
    ctx.textBaseline = "middle";
    ctx.fillText(pillT, W / 2, ppy + ph / 2 + 1 * s);
    if (sc.sub) {
      ctx.fillStyle = FAINT;
      ctx.font = fontMono(28 * s, 500);
      ctx.textBaseline = "alphabetic";
      ctx.fillText(sc.sub, W / 2, ppy + ph + 74 * s);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    return;
  }
}

/** Desenha o story inteiro no instante t (segundos, 0..duração). W×H = tamanho do canvas. */
export function drawStory(ctx: CanvasRenderingContext2D, story: Story, t: number, W: number, H: number, showProgress = true, photo: CanvasImageSource | null = null) {
  const s = W / 1080;
  if (photo) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawPhotoBg(ctx, photo, W, H, t);
  } else {
    // fallback (foto ainda carregando): glow verde
    const glow = GLOW[story.id] ?? [0.32, 0.22];
    drawBg(ctx, W, H, t, glow[0], glow[1]);
  }
  const n = story.scenes.length;
  const idx = Math.min(n - 1, Math.floor(t / SCENE_DUR));
  const lt = t - idx * SCENE_DUR;
  const sc = story.scenes[idx];
  // Última cena (CTA): só fade-IN, sem fade-out — fica visível até o fim pro usuário clicar.
  const isLast = idx === n - 1;
  const a = isLast ? clamp01(lt / 0.6) : sceneAlpha(lt, SCENE_DUR);
  // marca no topo — desce um pouco quando NÃO há barra de progresso (export), pra não colar no topo
  if (sc.kind !== "cta") drawBrand(ctx, s, 90 * s, (showProgress ? 92 : 70) * s, 46);
  sceneContent(ctx, s, W, H, sc, lt, a);
  // Barras de progresso: SÓ na prévia do admin. No vídeo exportado NÃO — o Instagram já põe as dele.
  if (showProgress) drawProgress(ctx, s, W, n, t);
}

// ── POSTS ESTÁTICOS (drawPost) ───────────────────────────────────────────────

/** Fundo verde PROFUNDO (variante esverdeada): base quase-preta esverdeada + brilho do verde
 *  fechado #15976A (não o acento aberto). Dá um clima diferente sem sair da marca. */
function drawPostGreenBg(ctx: CanvasRenderingContext2D, W: number, H: number, gx: number, gy: number) {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#0C1A14");
  base.addColorStop(1, "#080F0B");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const cx = W * gx, cy = H * gy, r = W * 0.95;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, "rgba(21,151,106,0.32)");
  g.addColorStop(0.5, "rgba(21,151,106,0.06)");
  g.addColorStop(1, "rgba(21,151,106,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Fundo com FOTO (cover), mais presente que a dos stories (aqui ela é o fundo, não textura):
 *  foto dessaturada/escura + tinte verde de marca + scrim vertical forte na base → texto sempre legível. */
function drawPostPhotoBg(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, W: number, H: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const p = photo as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const iw = p.naturalWidth || p.width || 0, ih = p.naturalHeight || p.height || 0;
  if (iw && ih) {
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.save();
    ctx.globalAlpha = 0.52;
    ctx.filter = "grayscale(0.4) brightness(0.72) contrast(1.03)";
    ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(10,11,13,0.42)");
  g.addColorStop(0.42, "rgba(10,11,13,0.5)");
  g.addColorStop(1, "rgba(10,11,13,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Rodapé do post: @handle (acento, mono) + site (fraco). Assinatura discreta em toda peça. */
function drawHandle(ctx: CanvasRenderingContext2D, s: number, x: number, y: number) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fontMono(26 * s, 600);
  ctx.fillStyle = ACCENT;
  ctx.letterSpacing = `${1 * s}px`;
  ctx.fillText("@nossasfinancasapp", x, y);
  const hw = ctx.measureText("@nossasfinancasapp").width + 16 * s;
  ctx.letterSpacing = "0px";
  ctx.font = fontSans(24 * s, 500);
  ctx.fillStyle = FAINT;
  ctx.fillText("nossasfinancas.com.br", x + hw, y);
}

/** Tabela de comparação BR × Itália (label + 2 valores por linha), com divisores hairline. */
function drawCompare(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, W: number, cmp: NonNullable<Post["compare"]>) {
  const fullW = W - x * 2;
  const labelW = fullW * 0.44;
  const colW = (fullW - labelW) / 2;
  const xa = x + labelW;
  const xb = xa + colW;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fontMono(23 * s, 700);
  ctx.letterSpacing = `${1.5 * s}px`;
  ctx.fillStyle = ACCENT;
  ctx.fillText(cmp.head[0], xa, y);
  ctx.fillStyle = MUTED;
  ctx.fillText(cmp.head[1], xb, y);
  ctx.letterSpacing = "0px";
  let ry = y + 30 * s;
  const rh = 108 * s;
  for (const r of cmp.rows) {
    const mid = ry + rh * 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(x, ry);
    ctx.lineTo(x + fullW, ry);
    ctx.stroke();
    ctx.font = fontSans(27 * s, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(r.label, x, mid);
    ctx.font = fontSans(38 * s, 600);
    ctx.fillStyle = TEXT;
    ctx.fillText(r.a, xa, mid);
    ctx.fillStyle = ACCENT;
    ctx.fillText(r.b, xb, mid);
    ry += rh;
  }
  return ry;
}

/** Desenha UM post estático 4:5 (1080×1350 no full). Compõe os mesmos primitivos dos stories, mas
 *  parado (alpha 1, sem rise, mock totalmente revelado com lt alto). 3 arranjos: mock / comparação /
 *  título-herói (com sub e/ou chips). Sempre marca no topo + @handle no rodapé. */
export function drawPost(ctx: CanvasRenderingContext2D, post: Post, W: number, H: number, photo: CanvasImageSource | null = null) {
  const s = W / 1080;
  if (post.photo && photo) drawPostPhotoBg(ctx, photo, W, H);
  else if (post.green) drawPostGreenBg(ctx, W, H, post.glow?.[0] ?? 0.5, post.glow?.[1] ?? 0.3);
  else drawBg(ctx, W, H, 0, post.glow?.[0] ?? 0.3, post.glow?.[1] ?? 0.18);
  drawBrand(ctx, s, 90 * s, 74 * s, 46);
  const x = 90 * s;
  const availW = (W - x * 2) * 0.99;

  if (post.mock) {
    drawMockCard(ctx, s * (540 / 540), W / 2, H * 0.3, 540 * s, post.mock, 1, 3);
    // Bloco eyebrow→título→sub ANCORADO acima do rodapé — assim 2 ou 3 linhas de título nunca
    // colam no @handle (o problema era o título de 3 linhas empurrar o sub por cima do rodapé).
    const px = fitTitlePx(ctx, s, post.title, availW, 72, 92);
    const lh = (px + 8) * s;
    const eyeGap = (px * 0.72 + 48) * s;
    const tb = H - (post.sub ? 210 : 120) * s; // base do título (reserva rodapé + ~2 linhas de sub)
    const eyeY = tb - post.title.length * lh - eyeGap;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1);
    drawTitle(ctx, s, x, eyeY + eyeGap, post.title, 1, 0, px);
    if (post.sub) drawSub(ctx, s, x, tb + 30 * s, W, post.sub, 1);
  } else if (post.compare) {
    const eyeY = H * 0.13;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1);
    const px = fitTitlePx(ctx, s, post.title, availW, 92, 112);
    const tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 52) * s, post.title, 1, 0, px);
    const cb = drawCompare(ctx, s, x, tb + 70 * s, W, post.compare);
    if (post.sub) drawSub(ctx, s, x, cb + 46 * s, W, post.sub, 1);
  } else {
    const px = fitTitlePx(ctx, s, post.title, availW, 96, 132);
    const lh = (px + 8) * s;
    const eyeGap = (px * 0.72 + 56) * s;
    const titleH = post.title.length * lh;
    const extraH = (post.sub ? 140 * s : 0) + (post.chips ? 120 * s : 0);
    const blockH = eyeGap + titleH + extraH;
    const eyeY = (H - blockH) / 2 + px * 0.35 * s;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1);
    let tb = drawTitle(ctx, s, x, eyeY + eyeGap, post.title, 1, 0, px);
    if (post.sub) {
      drawSub(ctx, s, x, tb + 36 * s, W, post.sub, 1);
      tb += 100 * s;
    }
    if (post.chips) drawChips(ctx, s, x, tb + 44 * s, post.chips, 1, W - x * 2);
  }
  drawHandle(ctx, s, x, H - 64 * s);
}
