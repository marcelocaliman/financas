/**
 * Dias úteis no Brasil — exclui finais de semana e feriados nacionais.
 *
 * Renda fixa indexada (Selic, CDI, IPCA+, prefixado) rende APENAS em dias
 * úteis na base 252. Pra que o "Rendimento acumulado" seja matematicamente
 * coerente com a realidade, precisamos:
 *  1. Não somar yield em sábado, domingo e feriados nacionais.
 *  2. Suportar fração de dia útil (interpolar entre 00h e 24h SP).
 *
 * Feriados fixos (DD/MM):
 *  - 01/01 Confraternização Universal
 *  - 21/04 Tiradentes
 *  - 01/05 Dia do Trabalho
 *  - 07/09 Independência
 *  - 12/10 N. Sra. Aparecida
 *  - 02/11 Finados
 *  - 15/11 Proclamação da República
 *  - 25/12 Natal
 *
 * Feriados móveis (relativos à Páscoa):
 *  - Carnaval (segunda e terça): Páscoa − 48 e − 47 dias
 *  - Sexta-feira Santa: Páscoa − 2 dias
 *  - Corpus Christi: Páscoa + 60 dias
 *
 * Não considera feriados estaduais/municipais (que tecnicamente B3 não opera,
 * mas a maioria dos sistemas financeiros nacionais ignoram).
 */

const DAY_MS = 86400000;

/**
 * Calcula a data da Páscoa de um ano (algoritmo de Gauss/Butcher).
 * Retorna [month (1-12), day].
 */
function easterDate(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDaysToDate(year: number, month: number, day: number, delta: number): [number, number, number] {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/**
 * Devolve um Set com todos os feriados nacionais de um ano (YYYY-MM-DD).
 * Memoizado por ano.
 */
const holidaysCache = new Map<number, Set<string>>();
function holidaysForYear(year: number): Set<string> {
  const cached = holidaysCache.get(year);
  if (cached) return cached;

  const set = new Set<string>();
  // Fixos
  set.add(dateKey(year, 1, 1));
  set.add(dateKey(year, 4, 21));
  set.add(dateKey(year, 5, 1));
  set.add(dateKey(year, 9, 7));
  set.add(dateKey(year, 10, 12));
  set.add(dateKey(year, 11, 2));
  set.add(dateKey(year, 11, 15));
  set.add(dateKey(year, 12, 25));

  // Móveis (a partir da Páscoa)
  const [em, ed] = easterDate(year);
  const carnavalMonday = addDaysToDate(year, em, ed, -48);
  const carnavalTuesday = addDaysToDate(year, em, ed, -47);
  const goodFriday = addDaysToDate(year, em, ed, -2);
  const corpusChristi = addDaysToDate(year, em, ed, 60);

  set.add(dateKey(...carnavalMonday));
  set.add(dateKey(...carnavalTuesday));
  set.add(dateKey(...goodFriday));
  set.add(dateKey(...corpusChristi));

  holidaysCache.set(year, set);
  return set;
}

/**
 * Devolve a data ISO "YYYY-MM-DD" do dia corrente em America/Sao_Paulo.
 */
export function dateInSP(now: Date = new Date()): { y: number; m: number; d: number; iso: string; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y, m, d, iso: dateKey(y, m, d), weekday: wkMap[weekdayShort] ?? 0 };
}

/**
 * True se a data (em SP) é dia útil — não é fim de semana E não é feriado nacional.
 */
export function isBusinessDay(date: Date | string = new Date()): boolean {
  let y: number, m: number, d: number, weekday: number;
  if (typeof date === "string") {
    const [yStr, mStr, dStr] = date.split("-").map(Number);
    y = yStr;
    m = mStr;
    d = dStr;
    const wk = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    weekday = wk;
  } else {
    const info = dateInSP(date);
    y = info.y;
    m = info.m;
    d = info.d;
    weekday = info.weekday;
  }
  if (weekday === 0 || weekday === 6) return false;
  return !holidaysForYear(y).has(dateKey(y, m, d));
}

// Re-exporta DAY_MS pra outros módulos sem duplicar
export { DAY_MS };
