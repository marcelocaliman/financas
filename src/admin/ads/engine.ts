// Engine dos "stories" de divulgação (só super-admin): desenha cada anúncio num <canvas> 1080×1920
// (9:16, formato Story) ao longo do tempo — texto + motivos animados na estética da marca. O mesmo
// render serve pra prévia (loop) e pra exportar MP4 (grava o canvas com MediaRecorder). Resolução-
// independente: tudo escala por s = W/1080, então preview pequena e export grande usam o MESMO código.

export const SCENE_DUR = 3; // segundos por "página" do story
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
}
export interface Story {
  id: string;
  name: string; // rótulo no admin
  scenes: Scene[];
}

export const STORIES: Story[] = [
  {
    id: "privacidade",
    name: "Privacidade",
    scenes: [
      { kind: "hook", eyebrow: "PRIVACIDADE DE VERDADE", title: ["Seus números.", "Só seus."], mock: "masked" },
      {
        kind: "privacy",
        eyebrow: "CRIPTOGRAFIA PONTA A PONTA",
        title: ["Nem eu, no", "servidor, vejo."],
        sub: "Seus dados vão cifrados. A chave nunca sai do seu aparelho.",
      },
      { kind: "cta", value: "Nossas Finanças", tagline: "Grátis · Privado · Local-first", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "patrimonio",
    name: "Patrimônio multimoeda",
    scenes: [
      { kind: "hook", eyebrow: "DINHEIRO EM VÁRIAS MOEDAS?", title: ["Tudo num", "lugar só."], mock: "currencies" },
      {
        kind: "networth",
        eyebrow: "PATRIMÔNIO LÍQUIDO",
        value: "1284500",
        badges: ["BRL", "EUR", "USD"],
        sub: "Some tudo, em qualquer moeda — na cotação de hoje.",
      },
      { kind: "cta", value: "Nossas Finanças", tagline: "Multimoeda de verdade", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "orcamento",
    name: "Orçamento & independência",
    scenes: [
      { kind: "hook", eyebrow: "PRA ONDE VAI O SEU DINHEIRO?", title: ["Orçamento", "que faz sentido."], mock: "donut" },
      {
        kind: "budget",
        eyebrow: "ORÇAMENTO DO MÊS",
        title: ["Veja cada real —", "e projete o futuro."],
        bars: [
          { label: "Moradia", w: 0.84 },
          { label: "Alimentação", w: 0.62, c: "#8A8F98" },
          { label: "Transporte", w: 0.41, c: "#8A8F98" },
          { label: "Lazer", w: 0.28, c: CARD2 },
        ],
      },
      { kind: "cta", value: "Nossas Finanças", tagline: "Planeje · Projete · Conquiste", sub: "nossasfinancas.com.br" },
    ],
  },
];

export const storyDuration = (st: Story) => st.scenes.length * SCENE_DUR + LAST_HOLD;

// ── helpers ─────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Opacidade da cena: fade-in nos 1ºs 0.45s, fade-out nos últimos 0.35s (sobre o bg persistente). */
function sceneAlpha(lt: number, dur: number) {
  return Math.min(clamp01(lt / 0.45), clamp01((dur - lt) / 0.35));
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

/** Donut (arcos) — composição do orçamento. */
function drawDonut(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, th: number, segs: [number, string][]) {
  ctx.lineWidth = th;
  ctx.lineCap = "butt";
  let start = -Math.PI / 2;
  for (const [frac, color] of segs) {
    const end = start + frac * Math.PI * 2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.stroke();
    start = end;
  }
}

/** Card-mockup do app (screenshot estilizado) pro hook — preenche o vazio e VARIA por tema. */
function drawMockCard(ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, w: number, kind: "currencies" | "masked" | "donut", a: number) {
  const h = w * (kind === "donut" ? 1.05 : 0.84); // altura ajustada ao conteúdo de cada mockup
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.rotate((-3 * Math.PI) / 180);
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
  const eyebrow = (txt: string) => {
    ctx.fillStyle = FAINT;
    ctx.font = fontMono(20 * s, 600);
    ctx.letterSpacing = `${2 * s}px`;
    ctx.fillText(txt, px, py);
    ctx.letterSpacing = "0px";
  };

  if (kind === "currencies") {
    eyebrow("PATRIMÔNIO LÍQUIDO");
    ctx.fillStyle = TEXT;
    ctx.font = fontSans(56 * s, 600);
    ctx.fillText("R$ 1.284.500", px, py + 66 * s);
    ctx.fillStyle = ACCENT;
    ctx.font = fontSans(24 * s, 600);
    ctx.fillText("▲ 2,4% no mês", px, py + 108 * s);
    const rows: [string, string, boolean][] = [["BRL", "R$ 1.284.500", true], ["EUR", "€ 214.900", false], ["USD", "$ 236.200", false]];
    rows.forEach((r, i) => {
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
    });
  } else if (kind === "masked") {
    eyebrow("PATRIMÔNIO LÍQUIDO");
    ctx.fillStyle = TEXT;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(px + 22 * s + i * 46 * s, py + 48 * s, 15 * s, 0, Math.PI * 2);
      ctx.fill();
    }
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
    // "gráfico" fantasma
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 8 * s;
    ctx.lineCap = "round";
    const gy = py + 250 * s;
    const pts = [0.7, 0.55, 0.62, 0.4, 0.5, 0.3, 0.22];
    ctx.beginPath();
    pts.forEach((p, i) => {
      const gx = px + (iw * i) / (pts.length - 1);
      const gyy = gy + 130 * s * p;
      i === 0 ? ctx.moveTo(gx, gyy) : ctx.lineTo(gx, gyy);
    });
    ctx.stroke();
  } else {
    eyebrow("ORÇAMENTO DO MÊS");
    const dcx = x + w / 2, dcy = py + 175 * s, dr = 118 * s;
    drawDonut(ctx, dcx, dcy, dr, 46 * s, [[0.53, ACCENT], [0.31, "#8A8F98"], [0.16, CARD2]]);
    const legs: [string, string, string][] = [["Moradia", ACCENT, "R$ 3.2k"], ["Alimentação", "#8A8F98", "R$ 1.9k"], ["Outros", CARD2, "R$ 980"]];
    legs.forEach((l, i) => {
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
    });
  }
  ctx.restore();
  ctx.globalAlpha = 1;
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
  ctx.font = fontMono(26 * s, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = `${3 * s}px`;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = "0px";
  ctx.globalAlpha = 1;
}

function drawTitle(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, lines: string[], a: number, dy: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = TEXT;
  ctx.font = fontSans(96 * s, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const lh = 104 * s;
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh + dy));
  ctx.globalAlpha = 1;
  return y + lines.length * lh;
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
  const rise = (1 - easeOut(lt / 0.6)) * 40 * s; // sobe ao entrar

  if (sc.kind === "hook") {
    if (sc.mock) {
      // card-mockup entra com leve escala/subida; texto embaixo
      const pop = easeOut(clamp01((lt - 0.1) / 0.6));
      const cardY = H * 0.335 + (1 - pop) * 30 * s;
      drawMockCard(ctx, s, W / 2, cardY, 560 * s, sc.mock, a * (0.3 + 0.7 * pop));
      drawEyebrow(ctx, s, x, H * 0.655, sc.eyebrow || "", a);
      drawTitle(ctx, s, x, H * 0.655 + 92 * s, sc.title || [], a, rise);
    } else {
      drawEyebrow(ctx, s, x, midY - 220 * s, sc.eyebrow || "", a);
      drawTitle(ctx, s, x, midY - 130 * s, sc.title || [], a, rise);
    }
    return;
  }

  if (sc.kind === "privacy") {
    drawEyebrow(ctx, s, x, midY - 300 * s, sc.eyebrow || "", a);
    drawTitle(ctx, s, x, midY - 210 * s, sc.title || [], a, rise);
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
export function drawStory(ctx: CanvasRenderingContext2D, story: Story, t: number, W: number, H: number, showProgress = true) {
  const s = W / 1080;
  const glow = GLOW[story.id] ?? [0.32, 0.22];
  drawBg(ctx, W, H, t, glow[0], glow[1]);
  const n = story.scenes.length;
  const idx = Math.min(n - 1, Math.floor(t / SCENE_DUR));
  const lt = t - idx * SCENE_DUR;
  const sc = story.scenes[idx];
  // Última cena (CTA): só fade-IN, sem fade-out — fica visível até o fim pro usuário clicar.
  const isLast = idx === n - 1;
  const a = isLast ? clamp01(lt / 0.45) : sceneAlpha(lt, SCENE_DUR);
  // marca no topo — desce um pouco quando NÃO há barra de progresso (export), pra não colar no topo
  if (sc.kind !== "cta") drawBrand(ctx, s, 90 * s, (showProgress ? 92 : 70) * s, 46);
  sceneContent(ctx, s, W, H, sc, lt, a);
  // Barras de progresso: SÓ na prévia do admin. No vídeo exportado NÃO — o Instagram já põe as dele.
  if (showProgress) drawProgress(ctx, s, W, n, t);
}
