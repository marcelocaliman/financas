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

/* ============================== INVESTIMENTOS ============================
 * Funções puras de projeção e estimativa — vivem aqui pra serem usadas tanto
 * em Server Components (services/*) quanto em Client Components (charts).
 */

export type ProjectionPoint = { month: number; balance: number; sacado: number };

/**
 * Projeta saldo de um ativo Selic com saques mensais por N meses.
 * Modelo: taxa diária composta · 21 dias úteis/mês.
 */
export function projectFiveYears(
  initialBalance: number,
  selicAnnualPct: number,
  monthlyWithdrawal: number,
  months = 60,
): {
  points: ProjectionPoint[];
  totalSacado: number;
  lastBalance: number;
  lastMonthYield: number;
} {
  const dailyRate = Math.pow(1 + selicAnnualPct / 100, 1 / 252) - 1;
  const monthlyFactor = Math.pow(1 + dailyRate, 21);

  const points: ProjectionPoint[] = [{ month: 0, balance: initialBalance, sacado: 0 }];
  let balance = initialBalance;
  let sacado = 0;
  let exhausted = false;

  for (let m = 1; m <= months; m++) {
    if (!exhausted) {
      balance = balance * monthlyFactor - monthlyWithdrawal;
      sacado += monthlyWithdrawal;
      if (balance < 0) {
        balance = 0;
        exhausted = true;
      }
    }
    points.push({ month: m, balance: Math.round(balance * 100) / 100, sacado });
  }

  const last = points[points.length - 1];
  const lastMonthYield = last.balance * (monthlyFactor - 1);
  return {
    points,
    totalSacado: sacado,
    lastBalance: last.balance,
    lastMonthYield: Math.round(lastMonthYield * 100) / 100,
  };
}

/**
 * Estima quando a meta será atingida pelo ritmo médio de aporte.
 */
export function estimateCompletion(
  current: number,
  target: number,
  monthlyAddition: number,
): { months: number | null; etaDate: string | null } {
  const remaining = target - current;
  if (remaining <= 0) return { months: 0, etaDate: null };
  if (monthlyAddition <= 0) return { months: null, etaDate: null };
  const months = Math.ceil(remaining / monthlyAddition);
  const eta = new Date();
  eta.setUTCMonth(eta.getUTCMonth() + months);
  return { months, etaDate: eta.toISOString().slice(0, 10) };
}
