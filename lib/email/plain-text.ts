/**
 * Conversão HTML → texto puro pra fallback do email.
 *
 * Resend (e a maioria dos providers) aceita campo `text` separado de `html`.
 * Quando ambos estão presentes:
 *   - Cliente moderno renderiza HTML
 *   - Cliente legacy / acessibilidade renderiza text
 *   - Filtros anti-spam dão mais reputação a emails com text + html
 *
 * Implementação caseira (sem dependências), regra: pega só o conteúdo do
 * <body>, descarta scripts/styles, preserva quebras de linha em block elements,
 * extrai href em links como "label (url)", decodifica entities básicas.
 */

const BLOCK_TAGS = [
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
  "br", "hr", "li", "tr", "table", "section", "header", "footer", "blockquote",
];
const BLOCK_RE = new RegExp(
  `</?(?:${BLOCK_TAGS.join("|")})\\b[^>]*>`,
  "gi",
);

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&hellip;": "…",
  "&ndash;": "–",
  "&mdash;": "—",
  "&laquo;": "«",
  "&raquo;": "»",
  "&aacute;": "á",
  "&eacute;": "é",
  "&iacute;": "í",
  "&oacute;": "ó",
  "&uacute;": "ú",
  "&atilde;": "ã",
  "&otilde;": "õ",
  "&ccedil;": "ç",
  "&Aacute;": "Á",
  "&Eacute;": "É",
  "&Iacute;": "Í",
  "&Oacute;": "Ó",
  "&Uacute;": "Ú",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => {
      if (ENTITIES[m]) return ENTITIES[m];
      // &#nnn; numeric entities
      const numMatch = m.match(/&#(\d+);/);
      if (numMatch) return String.fromCharCode(parseInt(numMatch[1], 10));
      return m;
    });
}

/**
 * Converte HTML email pra plain text legível.
 */
export function htmlToText(html: string): string {
  let s = html;

  // Pega só o conteúdo do <body> (descarta head/title/meta)
  const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) s = bodyMatch[1];

  // Remove scripts e styles
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");

  // Extrai links como "label (url)"
  s = s.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, label: string) => {
      const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
      if (cleanLabel && cleanLabel !== href) {
        return `${cleanLabel} (${href})`;
      }
      return href;
    },
  );

  // Adiciona quebra após block elements (antes de remover tags)
  s = s.replace(BLOCK_RE, "\n");

  // Remove qualquer tag restante
  s = s.replace(/<[^>]+>/g, "");

  // Decode entities
  s = decodeEntities(s);

  // Normaliza whitespace: múltiplos espaços → 1, múltiplas \n → max 2
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}
