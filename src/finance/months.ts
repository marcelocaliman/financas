/**
 * Aritmética de mês "AAAA-MM" sem fuso (índice absoluto ano*12+mês). Pura e testável —
 * usada pra preencher buracos do Histórico (meses em que o usuário não abriu o app).
 */

function monthIndex(m: string): number {
  const [y, mo] = m.split("-").map(Number);
  return y * 12 + (mo - 1);
}

function fromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const mo = (idx % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** Próximo mês de calendário em "AAAA-MM" (vira o ano corretamente). */
export function nextMonth(m: string): string {
  return fromIndex(monthIndex(m) + 1);
}

/**
 * Meses ESTRITAMENTE entre `startExcl` e `endExcl` (exclusivo nos dois lados), em ordem.
 * Ex.: monthsBetween("2026-03", "2026-07") → ["2026-04","2026-05","2026-06"].
 * Vazio se forem adjacentes, iguais ou invertidos.
 */
export function monthsBetween(startExcl: string, endExcl: string): string[] {
  const a = monthIndex(startExcl);
  const b = monthIndex(endExcl);
  const out: string[] = [];
  for (let i = a + 1; i < b; i++) out.push(fromIndex(i));
  return out;
}
