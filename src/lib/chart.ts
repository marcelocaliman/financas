// Utilitários puros p/ os gráficos de evolução (linha/área). Sem dependência de React/Recharts
// — fáceis de testar. A lógica de "domínio inteligente" é o que faz a curva PREENCHER a altura
// em vez de virar uma linha achatada no topo (quando os valores são grandes e próximos).

const MONTH_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT" };

/** "AAAA-MM" → "mmm/aa" no idioma corrente (rótulos discretos do eixo X). */
export function shortMonth(ym: string, lang: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(MONTH_LOCALE[lang] ?? "pt-BR", { month: "short", year: "2-digit" });
}

/**
 * Domínio Y "inteligente" p/ séries de evolução (patrimônio ao longo do tempo).
 * Começa perto do MÍNIMO da série (não em zero) pra a variação real ficar visível — a linha
 * arranca de baixo e sobe, em vez de colar no topo. Regras:
 *  - série plana (min == max): abre uma banda proporcional em torno do valor;
 *  - dá uma folga (`padFrac`) abaixo do min e acima do max pra a curva respirar;
 *  - se todos os valores são ≥ 0, nunca inventa um eixo negativo (piso trava em 0).
 * Retorna `[min, max]` pronto pro `domain` do YAxis.
 */
export function trendDomain(values: number[], padFrac = 0.12): [number, number] {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return [0, 1];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) {
    const band = Math.abs(min) * 0.08 || 1;
    return [min - band, max + band];
  }
  const pad = (max - min) * padFrac;
  let lo = min - pad;
  const hi = max + pad;
  if (min >= 0) lo = Math.max(0, lo); // dados positivos → não desce abaixo de zero
  return [lo, hi];
}
