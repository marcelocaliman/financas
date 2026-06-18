// Gera as landings localizadas /en e /it no BUILD a partir de dist/index.html (PT) +
// o dicionário de tradução do landing.js — assim ficam SEMPRE em sincronia com a landing.
// Cada página sai com o conteúdo traduzido NO HTML (não só via JS), head localizado
// (title/description/og/twitter/canonical) e hreflang ligando as três (bom p/ ranking).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITE = "https://nossasfinancas.com.br";
const DIST = "dist";

// Dicionário de tradução (fonte única; a landing.js não o embarca mais).
const I18N = JSON.parse(
  readFileSync(fileURLToPath(new URL("./landing-i18n.json", import.meta.url)), "utf8"),
);

const META = {
  en: {
    lang: "en", ogLocale: "en_US", url: "/en", og: "/og-en.png",
    title: "Nossas Finanças — multicurrency wealth, private & cross-border",
    desc: "The complete dashboard to manage your wealth in any currency and country, with end-to-end encryption. The server never sees your numbers. Free, private and local-first.",
  },
  it: {
    lang: "it", ogLocale: "it_IT", url: "/it", og: "/og-it.png",
    title: "Nossas Finanças — patrimonio multivaluta, privato e cross-border",
    desc: "La dashboard completa per gestire il tuo patrimonio in qualsiasi valuta e paese, con crittografia end-to-end. Il server non vede mai i tuoi numeri. Gratis, privato e local-first.",
  },
};

const HREFLANG = [
  `<link rel="alternate" hreflang="pt-BR" href="${SITE}/" />`,
  `<link rel="alternate" hreflang="en" href="${SITE}/en" />`,
  `<link rel="alternate" hreflang="it" href="${SITE}/it" />`,
  `<link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
].join("\n  ");

// Strings do JSON-LD que não vêm do dicionário da landing (descrições + featureList).
const LD = {
  en: {
    orgDesc: "Multicurrency, private and cross-border wealth management, with end-to-end encryption.",
    appDesc: "Multicurrency wealth and budget dashboard with end-to-end encryption (E2EE). Net worth, investments, budget, goals, projection and financial independence — for people who live between countries.",
    features: ["Multicurrency (BRL, EUR, USD, GBP)", "End-to-end encryption (E2EE)", "Local-first and offline (PWA)", "Net worth and investments", "Multicurrency monthly budget", "Projection and financial independence (FIRE)", "Export/import (JSON and CSV)"],
  },
  it: {
    orgDesc: "Gestione patrimoniale multivaluta, privata e cross-border, con crittografia end-to-end.",
    appDesc: "Dashboard di gestione patrimoniale e budget multivaluta con crittografia end-to-end (E2EE). Patrimonio, investimenti, budget, obiettivi, proiezione e indipendenza finanziaria — per chi vive tra paesi.",
    features: ["Multivaluta (BRL, EUR, USD, GBP)", "Crittografia end-to-end (E2EE)", "Local-first e offline (PWA)", "Patrimonio e investimenti", "Budget mensile multivaluta", "Proiezione e indipendenza finanziaria (FIRE)", "Export/import (JSON e CSV)"],
  },
};

// Reconstrói o JSON-LD @graph no idioma da página (FAQ vem do dicionário traduzido).
function buildJsonLd(lang) {
  const m = META[lang], ld = LD[lang], d = I18N[lang];
  const faq = [];
  for (let n = 1; n <= 8; n++) {
    faq.push({ "@type": "Question", name: d[`faq.q${n}`], acceptedAnswer: { "@type": "Answer", text: d[`faq.a${n}`] } });
  }
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE}/#org`, name: "Nossas Finanças", url: `${SITE}/`, logo: `${SITE}/og.png`, description: ld.orgDesc },
      { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "Nossas Finanças", inLanguage: m.lang, publisher: { "@id": `${SITE}/#org` } },
      { "@type": "SoftwareApplication", name: "Nossas Finanças", applicationCategory: "FinanceApplication", operatingSystem: "Web, iOS, Android (PWA)", url: `${SITE}/app`, inLanguage: ["pt-BR", "en", "it"], description: ld.appDesc, offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" }, featureList: ld.features },
      { "@type": "FAQPage", inLanguage: m.lang, mainEntity: faq },
    ],
  }, null, 2);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const injectHreflang = (html) => html.replace(/(<link rel="canonical"[^>]*>)/, `$1\n  ${HREFLANG}`);

const base = readFileSync(`${DIST}/index.html`, "utf8");

function gen(lang) {
  const m = META[lang];
  const dict = I18N[lang] || {};
  let html = base;
  // traduz cada elemento [data-i18n] (todos são texto puro)
  html = html.replace(/(data-i18n="([^"]+)"[^>]*>)([^<]*)(<)/g, (full, open, key, _t, close) => {
    const t = dict[key];
    return t != null ? open + esc(t) + close : full;
  });
  // traduz placeholders marcados (ordem no HTML: data-i18n-ph="k" placeholder="...")
  html = html.replace(/data-i18n-ph="([^"]+)"(\s+placeholder=")[^"]*(")/g, (full, key, mid, end) => {
    const t = dict[key];
    return t != null ? `data-i18n-ph="${key}"${mid}${esc(t)}${end}` : full;
  });
  html = html
    .replace(/<html lang="[^"]*">/, `<html lang="${m.lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${SITE}${m.url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(m.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${SITE}${m.url}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${SITE}${m.og}$2`)
    .replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${m.ogLocale}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(m.title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${SITE}${m.og}$2`)
    // JSON-LD localizado (FAQ, inLanguage e descrições no idioma da página)
    .replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/, `$1\n${buildJsonLd(lang)}\n  $2`);
  // og:locale:alternate → os OUTROS dois idiomas (não repetir o principal)
  const ALT = { en: ["pt_BR", "it_IT"], it: ["pt_BR", "en_US"] };
  let ai = 0;
  html = html.replace(/(<meta property="og:locale:alternate" content=")[^"]*(")/g, (_m, a, b) => `${a}${ALT[lang][ai++]}${b}`);
  return injectHreflang(html);
}

writeFileSync(`${DIST}/en.html`, gen("en"));
writeFileSync(`${DIST}/it.html`, gen("it"));
writeFileSync(`${DIST}/index.html`, injectHreflang(base));
console.log("✓ i18n landing: dist/en.html, dist/it.html geradas + hreflang em index.html");
