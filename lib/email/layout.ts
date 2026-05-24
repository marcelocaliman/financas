/**
 * Sistema de email do Finanças — minimalista, profissional, mobile-first.
 *
 * Princípios:
 *  - Table-based layout (Outlook compat, Gmail compat)
 *  - Inline styles em TUDO (clients strippam <style> de <head>)
 *  - max-width 600px, padding generoso
 *  - Tipografia system font (sem @font-face — sketchy em email)
 *  - Single accent color (navy #1d3866 da marca)
 *  - Footer com link pro domínio + nota LGPD
 *
 * Estilo de referência: Linear, Stripe, Vercel — sóbrio, sem decoração
 * desnecessária, tipografia + espaço fazem o trabalho.
 */

// ============================================================================
// Tokens da marca (espelham globals.css)
// ============================================================================
const T = {
  // Cores
  bg: "#f5f6f8",              // page bg fora do card
  card: "#ffffff",            // card bg
  border: "#e6e8eb",          // card border
  divider: "#f0f1f3",         // divisórias internas
  footer: "#fafbfc",          // footer bg sutil
  text: "#1a1a1a",            // primary text
  textBody: "#2a2a2a",        // body text
  textMuted: "#6a6a6a",       // secondary
  textFaint: "#8a8a8a",       // legal/footer

  // Marca
  navy: "#1d3866",            // accent primário
  navyDark: "#14294f",        // hover/dark variant
  olive: "#11a13d",           // sucesso
  rust: "#db3914",            // alerta/erro
  gold: "#936421",            // warning

  // Tipografia
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontDisplay: "Georgia, 'Times New Roman', serif",
} as const;

// ============================================================================
// Helpers de escape (segurança contra HTML injection nos templates)
// ============================================================================
export function escapeHtml(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// COMPONENTS — blocos reutilizáveis pros templates
// ============================================================================

/**
 * Título do email (geralmente o primeiro elemento do body).
 */
export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-family:${T.fontStack};font-size:22px;font-weight:600;line-height:1.3;color:${T.text};letter-spacing:-0.01em;">${escapeHtml(text)}</h1>`;
}

/**
 * Subtítulo / lead paragraph.
 */
export function lead(text: string): string {
  return `<p style="margin:0 0 20px 0;font-family:${T.fontStack};font-size:15px;line-height:1.55;color:${T.textMuted};">${escapeHtml(text)}</p>`;
}

/**
 * Parágrafo do corpo. Aceita HTML interno (já escapado por quem chama).
 */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${T.fontStack};font-size:14px;line-height:1.6;color:${T.textBody};">${html}</p>`;
}

/**
 * Botão CTA — link estilado. Variant primary (navy) é o padrão.
 */
export function button(
  label: string,
  url: string,
  variant: "primary" | "secondary" = "primary",
): string {
  const bg = variant === "primary" ? T.navy : "transparent";
  const color = variant === "primary" ? "#ffffff" : T.navy;
  const border = variant === "primary" ? T.navy : T.navy;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px;background:${bg};border:1px solid ${border};">
          <a href="${escapeHtml(url)}"
             style="display:inline-block;padding:11px 22px;font-family:${T.fontStack};font-size:14px;font-weight:600;color:${color};text-decoration:none;border-radius:8px;letter-spacing:-0.005em;">
            ${escapeHtml(label)} →
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Lista chave-valor estruturada (ex: detalhes de acesso, parâmetros).
 */
export function infoList(items: Array<{ label: string; value: string | number }>): string {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;font-family:${T.fontStack};font-size:13px;color:${T.textMuted};vertical-align:top;width:40%;">${escapeHtml(i.label)}</td>
        <td style="padding:8px 0;font-family:${T.fontStack};font-size:13px;color:${T.text};vertical-align:top;font-weight:500;">${escapeHtml(i.value)}</td>
      </tr>`,
    )
    .join("");
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;border-top:1px solid ${T.divider};border-bottom:1px solid ${T.divider};">
      ${rows}
    </table>
  `.trim();
}

/**
 * KPI box — destaque pra um número/valor importante (ex: DARF a pagar).
 */
export function kpiBox(args: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "negative" | "positive";
}): string {
  const accent =
    args.tone === "negative" ? T.rust : args.tone === "positive" ? T.olive : T.navy;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;background:${T.footer};border-radius:8px;border-left:3px solid ${accent};">
      <tr>
        <td style="padding:14px 18px;">
          <div style="font-family:${T.fontStack};font-size:11px;color:${T.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:500;">${escapeHtml(args.label)}</div>
          <div style="font-family:${T.fontStack};font-size:20px;color:${T.text};margin-top:4px;font-weight:600;letter-spacing:-0.01em;">${escapeHtml(args.value)}</div>
          ${args.hint ? `<div style="font-family:${T.fontStack};font-size:12px;color:${T.textFaint};margin-top:2px;">${escapeHtml(args.hint)}</div>` : ""}
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Notice/alerta — caixa com fundo sutil colorido.
 */
export function notice(
  html: string,
  variant: "info" | "warning" | "danger" = "info",
): string {
  const colors = {
    info: { bg: "#eef2f8", border: T.navy, text: T.navyDark },
    warning: { bg: "#fdf6e8", border: T.gold, text: "#6f4a18" },
    danger: { bg: "#fdeae5", border: T.rust, text: "#ad2d10" },
  }[variant];
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;background:${colors.bg};border-radius:6px;border-left:3px solid ${colors.border};">
      <tr>
        <td style="padding:12px 16px;font-family:${T.fontStack};font-size:13px;line-height:1.5;color:${colors.text};">
          ${html}
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Divisor horizontal sutil.
 */
export function divider(): string {
  return `<div style="height:1px;background:${T.divider};margin:24px 0;"></div>`;
}

/**
 * URL display (quando precisa mostrar URL completa pro usuário copiar).
 */
export function urlBox(url: string): string {
  return `
    <div style="margin:12px 0;padding:10px 12px;background:${T.footer};border:1px solid ${T.border};border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:${T.textBody};word-break:break-all;line-height:1.4;">
      ${escapeHtml(url)}
    </div>
  `.trim();
}

// ============================================================================
// WRAP — envelopa qualquer conteúdo no layout master
// ============================================================================

export type WrapOptions = {
  /** Aparece como teaser na inbox (Gmail/Apple Mail mostram antes do user abrir) */
  preheader?: string;
  /** Pequeno texto acima do conteúdo (eyebrow tipo "Notificação · IRPF") */
  eyebrow?: string;
  /** Conteúdo principal (HTML já formatado via components acima) */
  content: string;
  /** Linha personalizada acima do footer padrão (opcional) */
  footerNote?: string;
};

export function wrapEmail(opts: WrapOptions): string {
  const preheader = opts.preheader
    ? `<div style="display:none;font-size:1px;color:${T.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>`
    : "";

  const eyebrow = opts.eyebrow
    ? `<div style="font-family:${T.fontStack};font-size:11px;color:${T.textMuted};text-transform:uppercase;letter-spacing:0.12em;font-weight:500;margin-top:14px;">${escapeHtml(opts.eyebrow)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Finanças</title>
</head>
<body style="margin:0;padding:0;background:${T.bg};">
  ${preheader}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${T.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${T.card};border-radius:12px;overflow:hidden;border:1px solid ${T.border};">

          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 20px 36px;border-bottom:1px solid ${T.divider};">
              <div style="font-family:${T.fontDisplay};font-style:italic;font-size:22px;color:${T.navy};letter-spacing:-0.02em;line-height:1;">
                finanças<span style="color:${T.olive};">.</span>
              </div>
              ${eyebrow}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 36px 32px 36px;font-family:${T.fontStack};font-size:14px;line-height:1.6;color:${T.textBody};">
              ${opts.content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 36px;background:${T.footer};border-top:1px solid ${T.divider};font-family:${T.fontStack};font-size:11px;line-height:1.5;color:${T.textFaint};">
              ${opts.footerNote ? `<div style="margin-bottom:8px;color:${T.textMuted};">${opts.footerNote}</div>` : ""}
              <a href="https://nossasfinancas.com.br" style="color:${T.navy};text-decoration:none;font-weight:500;">nossasfinancas.com.br</a>
              <span style="color:${T.textFaint};"> · Email automático · Conforme LGPD (Lei 13.709/2018)</span>
            </td>
          </tr>
        </table>

        <!-- Marca leve abaixo do card (estilo Linear/Stripe) -->
        <div style="margin-top:20px;font-family:${T.fontStack};font-size:11px;color:#a8a8a8;text-align:center;line-height:1.5;">
          Você está recebendo isto porque tem uma conta no Finanças.<br>
          <a href="https://nossasfinancas.com.br" style="color:#a8a8a8;text-decoration:underline;">nossasfinancas.com.br</a>
        </div>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
