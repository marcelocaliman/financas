// Gera as imagens OG (preview de compartilhamento, 1200×630) por CÓDIGO — satori (HTML/CSS → SVG)
// + resvg (SVG → PNG), puro JS, sem navegador. Assim o texto vira 1 linha editável (não um PNG
// congelado feito em design tool). Rode: `node scripts/gen-og.mjs`. Gera public/og.png (PT) e
// public/og-en.png (EN). Foco: gestão patrimonial + orçamento + privacidade (multimoeda é suporte).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const font = (f) => readFileSync(here(`./og-assets/${f}`));

const FONTS = [
  { name: "Inter", data: font("inter-400.woff"), weight: 400, style: "normal" },
  { name: "Inter", data: font("inter-600.woff"), weight: 600, style: "normal" },
  { name: "Inter", data: font("inter-700.woff"), weight: 700, style: "normal" },
  { name: "JetBrains Mono", data: font("jbmono-500.woff"), weight: 500, style: "normal" },
];

const ACCENT = "#3ECF8E";
const ICON = `data:image/svg+xml;base64,${readFileSync(here("../public/icon.svg")).toString("base64")}`;

// Copy por idioma. Editar aqui é o suficiente pra mudar o texto do preview.
const COPY = {
  pt: {
    eyebrow: "GESTÃO PATRIMONIAL · ORÇAMENTO · PRIVADO",
    headline: "Seu patrimônio e orçamento, só seus.",
    sub: "Criptografia ponta a ponta — o servidor nunca vê os seus números.",
    tags: "E2EE · MULTIMOEDA · LOCAL-FIRST · GRÁTIS PRA COMEÇAR",
    out: "../public/og.png",
  },
  en: {
    eyebrow: "WEALTH · BUDGET · PRIVATE",
    headline: "Your wealth and budget, only yours.",
    sub: "End-to-end encryption — the server never sees your numbers.",
    tags: "E2EE · MULTICURRENCY · LOCAL-FIRST · FREE TO START",
    out: "../public/og-en.png",
  },
};

const h = (type, style, children) => ({ type, props: { style, children } });

function tree(c) {
  return h(
    "div",
    {
      width: 1200, height: 630, display: "flex", flexDirection: "column", position: "relative",
      justifyContent: "space-between", padding: "66px 74px", backgroundColor: "#0A0B0D",
      fontFamily: "Inter", color: "#F3F4F6", overflow: "hidden",
    },
    [
      // glow verde (canto superior esquerdo), full-bleed atrás do conteúdo
      h("div", {
        position: "absolute", top: -260, left: -160, width: 980, height: 760, display: "flex",
        backgroundImage: `radial-gradient(circle at center, rgba(62,207,142,0.20), rgba(62,207,142,0.0) 62%)`,
      }, []),
      // hairline superior sutil
      h("div", { position: "absolute", top: 0, left: 0, right: 0, height: 1, display: "flex", backgroundColor: "rgba(255,255,255,0.06)" }, []),

      // Marca
      h("div", { display: "flex", alignItems: "center" }, [
        { type: "img", props: { width: 54, height: 54, src: ICON, style: { display: "flex", borderRadius: 14 } } },
        h("div", { display: "flex", marginLeft: 16, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" }, "Nossas Finanças"),
      ]),

      // Miolo
      h("div", { display: "flex", flexDirection: "column" }, [
        h("div", {
          display: "flex", fontFamily: "JetBrains Mono", fontSize: 19, fontWeight: 500,
          letterSpacing: 3, color: ACCENT, marginBottom: 22,
        }, c.eyebrow),
        h("div", {
          display: "flex", fontSize: 66, fontWeight: 600, letterSpacing: "-0.035em",
          lineHeight: 1.04, maxWidth: 940,
        }, c.headline),
        h("div", { display: "flex", fontSize: 27, color: "#9CA2AC", lineHeight: 1.45, marginTop: 26, maxWidth: 880 }, c.sub),
      ]),

      // Rodapé: tags + url
      h("div", { display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "JetBrains Mono", fontSize: 16, letterSpacing: 1.5 }, [
        h("div", { display: "flex", color: "#5F646C" }, c.tags),
        h("div", { display: "flex", color: ACCENT }, "nossasfinancas.com.br"),
      ]),
    ],
  );
}

for (const lang of Object.keys(COPY)) {
  const c = COPY[lang];
  const svg = await satori(tree(c), { width: 1200, height: 630, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
  writeFileSync(here(c.out), png);
  console.log(`✓ ${c.out.replace("../public/", "")} (${(png.length / 1024).toFixed(0)} KB)`);
}
