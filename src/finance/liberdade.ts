/**
 * Liberdade — métrica de progresso rumo à independência financeira (módulo PURO e testável).
 *
 * Reusa o núcleo FIRE (fire.ts): o "Número da Independência" é o número FIRE (gastos anuais ÷
 * taxa de retirada). Aqui adicionamos as leituras de produto: % de liberdade (pode passar de
 * 100), anos cobertos, data de chegada (via yearsToFI), streak de constância e marcos.
 *
 * NADA é fixo: taxa, base de custo, limiares e premissas vêm do usuário (defaults só na borda).
 * Tudo em MOEDA DE HOJE (coerente com fire.ts/Projeção): patrimônio cresce ao retorno REAL.
 */
import { yearsToFI } from "./fire";

/** Saldo mensal do orçamento de um mês ("AAAA-MM"): receitas − gastos, já na moeda de exibição. */
export interface MonthBalance {
  month: string;
  balance: number;
}

/**
 * % rumo à independência = patrimônio elegível ÷ Número da Independência (× 100). NÃO é capada
 * (pode passar de 100 → "mais que livre"); quem capa é só a barra visual. 0 se o alvo é inválido.
 */
export function freedomPct(eligibleWealth: number, independenceNumber: number): number {
  if (!Number.isFinite(independenceNumber) || independenceNumber <= 0) return 0;
  return (eligibleWealth / independenceNumber) * 100;
}

/** Anos de liberdade = patrimônio elegível ÷ custo de vida anual. `null` se o custo é ≤ 0. */
export function yearsOfFreedom(eligibleWealth: number, annualCost: number): number | null {
  if (annualCost <= 0) return null;
  return Math.max(0, eligibleWealth) / annualCost;
}

/** Meses até a independência, no ritmo atual. `null` = inalcançável. Reusa yearsToFI (retorno REAL). */
export function monthsToIndependence(params: {
  eligibleWealth: number;
  monthlyContribution: number;
  realAnnualReturn: number; // decimal
  independenceNumber: number;
}): number | null {
  const years = yearsToFI({
    portfolio: params.eligibleWealth,
    monthlyContribution: params.monthlyContribution,
    realAnnualReturn: params.realAnnualReturn,
    target: params.independenceNumber,
  });
  if (years == null) return null;
  return Math.round(years * 12);
}

/* ─────────────────────────── Datas "AAAA-MM" ─────────────────────────── */

/** Parseia "AAAA-MM" → [ano, mês(1-12)]; retorna null se malformado. */
function parseMonth(m: string): [number, number] | null {
  const match = /^(\d{4})-(\d{2})$/.exec(m);
  if (!match) return null;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  if (mo < 1 || mo > 12) return null;
  return [y, mo];
}

/** Índice absoluto de meses (ano*12 + mês) p/ comparar/derivar distância sem fuso. */
function monthIndex(m: string): number | null {
  const p = parseMonth(m);
  return p ? p[0] * 12 + (p[1] - 1) : null;
}

/** `b` é o mês de calendário imediatamente após `a`? (ambos "AAAA-MM"). */
export function isNextMonth(a: string, b: string): boolean {
  const ia = monthIndex(a);
  const ib = monthIndex(b);
  return ia != null && ib != null && ib - ia === 1;
}

/** Mês anterior, em "AAAA-MM". */
export function prevMonth(m: string): string {
  const p = parseMonth(m);
  if (!p) return m;
  let [y, mo] = p;
  mo -= 1;
  if (mo < 1) {
    mo = 12;
    y -= 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** Soma `n` meses a um Date e devolve "AAAA-MM" (p/ rotular a data de chegada). */
export function addMonthsLabel(base: Date, n: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ─────────────────────────── Streak de constância ─────────────────────────── */

export interface Streak {
  /** Sequência ATUAL: meses consecutivos (a partir do mais recente com dados) com saldo > limiar. */
  current: number;
  /** RECORDE: maior sequência consecutiva já observada (um tropeço não apaga o recorde). */
  record: number;
}

/**
 * Streak de meses consecutivos com saldo > `minBalance`, lido do orçamento/histórico.
 * Um mês negativo (ou um buraco no calendário) quebra a sequência atual, mas o recorde persiste.
 * `current` conta a partir do mês mais recente COM dados, andando pra trás no calendário.
 */
export function computeStreak(balances: MonthBalance[], minBalance = 0): Streak {
  const valid = balances.filter((b) => parseMonth(b.month) != null);
  if (valid.length === 0) return { current: 0, record: 0 };

  const sorted = [...valid].sort((a, b) => a.month.localeCompare(b.month));

  // Recorde: maior run de meses de calendário consecutivos, cada um com saldo > limiar.
  let record = 0;
  let run = 0;
  let prev: string | null = null;
  for (const { month, balance } of sorted) {
    if (prev != null && !isNextMonth(prev, month)) run = 0; // buraco quebra
    run = balance > minBalance ? run + 1 : 0;
    if (run > record) record = run;
    prev = month;
  }

  // Atual: do mês mais recente com dados, andando pra trás enquanto houver mês e saldo > limiar.
  const byMonth = new Map(sorted.map((b) => [b.month, b.balance]));
  let current = 0;
  let m: string | null = sorted[sorted.length - 1].month;
  while (m != null) {
    const bal = byMonth.get(m);
    if (bal === undefined || bal <= minBalance) break;
    current += 1;
    m = prevMonth(m);
  }

  return { current, record };
}

/* ─────────────────────────── Marcos ─────────────────────────── */

/**
 * Ladder de marcos de patrimônio sugeridos a partir de um valor de referência (ponto de partida
 * editável). Cobre da casa atual à próxima ordem de grandeza com passos "redondos" (1·, 2.5·, 5·).
 */
export function suggestWealthMilestones(reference: number): number[] {
  const out: number[] = [];
  // Começa numa base redonda razoável mesmo com patrimônio baixo/zero.
  const start = reference > 0 ? Math.pow(10, Math.floor(Math.log10(reference))) : 10_000;
  const steps = [1, 2.5, 5];
  let mag = start;
  while (out.length < 8 && mag <= Math.max(reference, start) * 1000) {
    for (const s of steps) {
      const v = mag * s;
      if (v > reference * 0.5) out.push(Math.round(v));
    }
    mag *= 10;
  }
  return out.slice(0, 6);
}
