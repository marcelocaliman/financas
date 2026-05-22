/**
 * Projeção de fim de mês a partir do que já correu.
 *
 * Receitas: NÃO projetadas — são pontuais (salário cai ou não cai).
 * Despesas: projetadas pelo ritmo diário do que já saiu.
 *
 * Confiança baixa no começo do mês (poucos dias de amostra).
 */
export function projectMonthEnd(
  totalIncome: number,
  totalExpense: number,
  daysElapsed: number,
  daysInMonth: number,
): {
  projectedExpense: number;
  projectedNet: number;
  confidence: "low" | "high";
  remainingDays: number;
} {
  const remainingDays = Math.max(0, daysInMonth - daysElapsed);
  const dailyExpenseRate = daysElapsed > 0 ? totalExpense / daysElapsed : 0;
  const projectedExpense = totalExpense + dailyExpenseRate * remainingDays;
  return {
    projectedExpense: Math.round(projectedExpense * 100) / 100,
    projectedNet: Math.round((totalIncome - projectedExpense) * 100) / 100,
    confidence: daysElapsed > 7 ? "high" : "low",
    remainingDays,
  };
}

/**
 * Calcula a parcela do mês corrente já transcorrida (0 a 1).
 * Usado pra renderizar a régua editorial "47% do mês transcorrido".
 */
export function monthProgress(now: Date = new Date()): {
  elapsed: number;
  daysElapsed: number;
  daysInMonth: number;
  ratio: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    elapsed: d,
    daysElapsed: d,
    daysInMonth,
    ratio: d / daysInMonth,
  };
}
