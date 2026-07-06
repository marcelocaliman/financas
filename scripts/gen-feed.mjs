// Gera as miniaturas do "mini-feed" do Instagram na LANDING (public/img/feed/1..6.png):
// renderiza os primeiros posts na ORDEM DE POSTAGEM (planner) com o MESMO canvas do estúdio de Ads.
// Fontes reais (Inter/JetBrains Mono) via scripts/og-assets → acentos corretos.
//
// NÃO roda no build (pra não fixar @napi-rs/canvas como dependência). Regenere quando as peças
// mudarem de conteúdo/ordem:
//     npm i -D @napi-rs/canvas && node scripts/gen-feed.mjs
//
// (esbuild já é dependência via Vite; @napi-rs/canvas é o único extra e pode ser removido depois.)
import { execSync } from "node:child_process";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TMP = join(tmpdir(), "nf-feed-build");
mkdirSync(TMP, { recursive: true });

// compila engine (auto-contido) + planner (bundle, importa o engine) pra ESM importável no node
const esbuild = (src, extra = "") =>
  execSync(`npx esbuild ${ROOT}src/admin/ads/${src} --outfile=${TMP}/${src.replace(".ts", ".mjs")} --format=esm --platform=node ${extra}`, { stdio: "ignore" });
esbuild("engine.ts");
esbuild("planner.ts", "--bundle");
const E = await import(TMP + "/engine.mjs");
const P = await import(TMP + "/planner.mjs");

const font = (f, name) => GlobalFonts.registerFromPath(ROOT + "scripts/og-assets/" + f, name);
font("inter-400.woff", "Inter");
font("inter-600.woff", "Inter");
font("inter-700.woff", "Inter");
font("jbmono-500.woff", "JetBrains Mono");
for (const [, path] of Object.entries(E.SHOT_SRC)) {
  try { E.setAdImage(path, await loadImage(ROOT + "public" + path)); } catch { /* screenshot ausente */ }
}

const byId = {};
for (const p of [...E.POSTS, ...E.EDU_POSTS]) byId[`post:${p.id}`] = p;
for (const c of [...E.CAROUSELS, ...E.EDU_CAROUSELS]) byId[`carousel:${c.id}`] = c.slides[0];

// ordem de postagem (planner) — só feed (posts/carrosséis), sem repetir, primeiros 6
const seen = new Set(), order = [];
for (const e of P.generateSchedule(new Date(), 8, "equilibrado")) {
  if (e.pieceId.startsWith("story:") || seen.has(e.pieceId)) continue;
  seen.add(e.pieceId);
  order.push(e.pieceId);
}
const pick = order.slice(0, 6);

const W = 440, H = 550;
mkdirSync(ROOT + "public/img/feed", { recursive: true });
for (let i = 0; i < pick.length; i++) {
  const v = byId[pick[i]];
  const cv = createCanvas(W, H);
  const photo = v.photo ? await loadImage(ROOT + "public" + v.photo) : null;
  E.drawPost(cv.getContext("2d"), v, W, H, photo);
  writeFileSync(`${ROOT}public/img/feed/${i + 1}.png`, cv.toBuffer("image/png"));
}
console.log("✓ mini-feed: " + pick.length + " imagens em public/img/feed/ · ordem:", pick.join(", "));
