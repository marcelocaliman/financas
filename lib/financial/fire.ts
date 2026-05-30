/**
 * Cálculos FIRE (Financial Independence / Retire Early).
 *
 * Conceitos:
 *   - SWR (Safe Withdrawal Rate): % anual que vc pode sacar do patrimônio
 *     sem esgotá-lo. 4% = regra Trinity clássica (90% sucesso em 30 anos).
 *   - FIRE Target: patrimônio = renda_anual_alvo / (SWR/100) = 25× renda anual
 *     se SWR=4%
 *   - Tipos de FIRE:
 *     · Lean: renda cobre necessidades básicas (~60% da despesa atual)
 *     · Regular: renda = despesa atual confortável
 *     · Fat: renda > 130% da despesa (estilo de vida elevado)
 *     · Coast: já tem patrimônio que crescerá sozinho até FIRE
 *     · Barista: renda passiva + meio-período cobrem despesa
 *
 * Convenções:
 *   - Todas as taxas em % a.a. nominal (não decimal). Ex: 6 = 6% a.a.
 *   - Patrimônio em moeda atual (R$, EUR, USD) — sempre coerente.
 *   - "Real" = descontada inflação. "Nominal" = bruto.
 *
 * Pure, sem dependência. Pode rodar client ou server.
 */

export type FireInputs = {
  /** Patrimônio atual líquido (R$) */
  currentNetWorth: number;
  /** Sobra mensal aportada (R$). Pode ser negativa. */
  monthlyAddition: number;
  /** Renda passiva mensal desejada na aposentadoria (R$, valor real hoje) */
  targetMonthlyIncome: number;
  /** Retorno REAL anual esperado da carteira (% a.a., já descontada inflação) */
  realAnnualReturnPct: number;
  /** Safe Withdrawal Rate (% a.a.). Default 4. */
  swrPct: number;
  /** Estimativa de INSS mensal (R$). Reduz necessidade de patrimônio. */
  inssMonthlyEstimate?: number;
  /** Idade atual (anos). Opcional, pra mostrar idade-alvo. */
  currentAge?: number;
};

export type FireBreakdown = {
  /** Renda mensal que vc PRECISA cobrir com a carteira (líquido de INSS) */
  netTargetMonthlyIncome: number;
  /** Renda anual alvo (líquido de INSS) */
  netTargetAnnualIncome: number;
  /** Patrimônio necessário pra atingir FIRE (renda_anual / SWR) */
  fireTargetNetWorth: number;
  /** Gap atual em patrimônio (R$) */
  gap: number;
  /** Cobertura atual (0..1+, % das despesas que a renda passiva já cobre) */
  coverageRatio: number;
  /** Renda passiva atual implícita = netWorth × SWR/12 */
  currentPassiveMonthlyIncome: number;
  /** Meses até FIRE (com juros compostos reais + aporte mensal) */
  monthsToFire: number | null;
  /** Anos pra FIRE (= meses/12) */
  yearsToFire: number | null;
  /** Idade ao atingir FIRE (se currentAge informada) */
  ageAtFire: number | null;
  /** Classificação do estado atual */
  classification: FireClassification;
};

export type FireClassification =
  | "achieved" // já atingiu o target
  | "fat" // > 130% do target
  | "regular" // >= target
  | "lean" // ~60-100% do target
  | "coast" // não precisa mais aportar, só esperar crescer
  | "barista" // renda parcial cobre parte
  | "building"; // ainda construindo

// ============================================================================
// Cálculo principal
// ============================================================================

export function computeFire(inputs: FireInputs): FireBreakdown {
  const {
    currentNetWorth,
    monthlyAddition,
    targetMonthlyIncome,
    realAnnualReturnPct,
    swrPct,
    inssMonthlyEstimate = 0,
    currentAge,
  } = inputs;

  // INSS reduz o que a carteira precisa cobrir
  const netTargetMonthlyIncome = Math.max(0, targetMonthlyIncome - inssMonthlyEstimate);
  const netTargetAnnualIncome = netTargetMonthlyIncome * 12;

  // Patrimônio necessário: renda anual / SWR
  const fireTargetNetWorth =
    swrPct > 0 ? netTargetAnnualIncome / (swrPct / 100) : Infinity;

  const gap = Math.max(0, fireTargetNetWorth - currentNetWorth);

  // Renda passiva atual implícita pelo SWR
  const currentPassiveMonthlyIncome = (currentNetWorth * (swrPct / 100)) / 12;
  // Cobertura: quanto da renda alvo a passiva atual já cobre
  const coverageRatio =
    targetMonthlyIncome > 0
      ? (currentPassiveMonthlyIncome + inssMonthlyEstimate) / targetMonthlyIncome
      : 0;

  // Meses até FIRE com juros compostos
  const monthsToFire = computeMonthsToFire({
    currentNetWorth,
    targetNetWorth: fireTargetNetWorth,
    monthlyAddition,
    realAnnualReturnPct,
  });

  const yearsToFire = monthsToFire != null ? monthsToFire / 12 : null;
  const ageAtFire =
    currentAge != null && yearsToFire != null
      ? currentAge + yearsToFire
      : null;

  const classification = classifyFire({
    currentNetWorth,
    fireTargetNetWorth,
    targetMonthlyIncome,
    currentPassiveMonthlyIncome,
    inssMonthlyEstimate,
    monthlyAddition,
    monthsToFire,
    realAnnualReturnPct,
  });

  return {
    netTargetMonthlyIncome,
    netTargetAnnualIncome,
    fireTargetNetWorth: round2(fireTargetNetWorth),
    gap: round2(gap),
    coverageRatio,
    currentPassiveMonthlyIncome: round2(currentPassiveMonthlyIncome),
    monthsToFire: monthsToFire != null ? Math.round(monthsToFire * 10) / 10 : null,
    yearsToFire: yearsToFire != null ? Math.round(yearsToFire * 10) / 10 : null,
    ageAtFire: ageAtFire != null ? Math.round(ageAtFire * 10) / 10 : null,
    classification,
  };
}

// ============================================================================
// Juros compostos: meses pra FV = PV(1+r)^n + PMT·[(1+r)^n − 1]/r
// Resolvendo pra n:
//   n = log((FV·r + PMT) / (PV·r + PMT)) / log(1+r)
//
// Casos especiais:
//   - r = 0: linear → n = (FV - PV) / PMT
//   - PMT ≤ 0 e PV < FV: cresce só por juros → n = log(FV/PV) / log(1+r)
//   - Impossível atingir: retorna null
// ============================================================================

export function computeMonthsToFire(args: {
  currentNetWorth: number;
  targetNetWorth: number;
  monthlyAddition: number;
  realAnnualReturnPct: number;
}): number | null {
  const { currentNetWorth: pv, targetNetWorth: fv, monthlyAddition: pmt, realAnnualReturnPct } = args;

  if (pv >= fv) return 0; // já atingiu
  if (fv === Infinity) return null;

  const r = annualToMonthlyRate(realAnnualReturnPct);

  // r = 0: linear (sem juros)
  if (r <= 0) {
    if (pmt <= 0) return null; // sem aporte nem juros → impossível
    return (fv - pv) / pmt;
  }

  // r > 0, com ou sem aporte
  if (pmt <= 0) {
    // Só juros, sem aporte. n = log(fv/pv) / log(1+r)
    if (pv <= 0) return null;
    return Math.log(fv / pv) / Math.log(1 + r);
  }

  // Caso geral: PV·(1+r)^n + PMT·[(1+r)^n − 1]/r = FV
  // → (1+r)^n · (PV·r + PMT) = FV·r + PMT
  // → n = log((FV·r + PMT) / (PV·r + PMT)) / log(1+r)
  const num = fv * r + pmt;
  const den = pv * r + pmt;
  if (den <= 0) return null;
  const ratio = num / den;
  if (ratio <= 0) return null;
  return Math.log(ratio) / Math.log(1 + r);
}

export function annualToMonthlyRate(annualPct: number): number {
  if (annualPct <= 0) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

// ============================================================================
// Trajetória do patrimônio (curva de crescimento até FIRE)
// ============================================================================

export type TrajectoryPoint = {
  month: number;
  age?: number;
  netWorth: number;
  passiveMonthlyIncome: number; // = netWorth × SWR / 12
  coverageRatio: number; // vs targetMonthlyIncome
};

export function projectTrajectory(args: {
  currentNetWorth: number;
  monthlyAddition: number;
  realAnnualReturnPct: number;
  targetMonthlyIncome: number;
  swrPct: number;
  inssMonthlyEstimate?: number;
  maxMonths?: number;
  currentAge?: number;
}): TrajectoryPoint[] {
  const r = annualToMonthlyRate(args.realAnnualReturnPct);
  const points: TrajectoryPoint[] = [];
  let nw = args.currentNetWorth;
  const maxMonths = args.maxMonths ?? 600; // 50 anos teto
  const inss = args.inssMonthlyEstimate ?? 0;

  const fireTarget = args.targetMonthlyIncome * 12 / Math.max(0.001, args.swrPct / 100);

  for (let m = 0; m <= maxMonths; m += 1) {
    const passive = (nw * (args.swrPct / 100)) / 12;
    const coverage =
      args.targetMonthlyIncome > 0
        ? (passive + inss) / args.targetMonthlyIncome
        : 0;
    points.push({
      month: m,
      age: args.currentAge != null ? args.currentAge + m / 12 : undefined,
      netWorth: round2(nw),
      passiveMonthlyIncome: round2(passive),
      coverageRatio: Math.round(coverage * 1000) / 1000,
    });
    if (nw >= fireTarget) break;
    // Avança um mês: aplica juros + aporta
    nw = nw * (1 + r) + args.monthlyAddition;
  }

  return points;
}

// ============================================================================
// Cenários comparativos
// ============================================================================

export type ScenarioInput = {
  label: string;
  variant: "current" | "more_savings" | "less_expense" | "higher_return" | "coast";
  monthlyAdditionDelta?: number; // R$ a mais ou a menos
  targetMonthlyIncomeMultiplier?: number; // 0.9 = -10% despesa
  realAnnualReturnDelta?: number; // pp a mais
  zeroOutAddition?: boolean; // pra Coast FIRE
};

export type ScenarioResult = {
  label: string;
  variant: ScenarioInput["variant"];
  monthsToFire: number | null;
  yearsToFire: number | null;
  ageAtFire: number | null;
  fireTargetNetWorth: number;
  description: string;
};

export function simulateScenarios(
  base: FireInputs,
  scenarios: ScenarioInput[],
): ScenarioResult[] {
  return scenarios.map((s) => {
    const inputs: FireInputs = {
      ...base,
      monthlyAddition: s.zeroOutAddition
        ? 0
        : base.monthlyAddition + (s.monthlyAdditionDelta ?? 0),
      targetMonthlyIncome:
        base.targetMonthlyIncome * (s.targetMonthlyIncomeMultiplier ?? 1),
      realAnnualReturnPct:
        base.realAnnualReturnPct + (s.realAnnualReturnDelta ?? 0),
    };
    const r = computeFire(inputs);

    let description = "";
    if (s.variant === "current") description = "Ritmo e parâmetros atuais";
    else if (s.variant === "more_savings")
      description = `Aporta +${formatBRL(s.monthlyAdditionDelta ?? 0)}/mês`;
    else if (s.variant === "less_expense")
      description = `Gasta ${Math.round((1 - (s.targetMonthlyIncomeMultiplier ?? 1)) * 100)}% menos`;
    else if (s.variant === "higher_return")
      description = `Retorno real +${s.realAnnualReturnDelta}pp a.a.`;
    else if (s.variant === "coast")
      description = "Para de aportar HOJE (Coast FIRE)";

    return {
      label: s.label,
      variant: s.variant,
      monthsToFire: r.monthsToFire,
      yearsToFire: r.yearsToFire,
      ageAtFire: r.ageAtFire,
      fireTargetNetWorth: r.fireTargetNetWorth,
      description,
    };
  });
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

// ============================================================================
// Monte Carlo simples — cone otimista / base / pessimista
// ============================================================================
// Modelagem: assume retornos com distribuição normal (média = expected,
// std-dev = volatility). Roda N simulações e retorna percentis (10/50/90).
//
// Implementação: Box-Muller pra normal, sem dependência externa.

export type MonteCarloPoint = {
  month: number;
  p10: number; // pessimista (10º percentil)
  p50: number; // mediana
  p90: number; // otimista (90º percentil)
};

export function simulateMonteCarlo(args: {
  currentNetWorth: number;
  monthlyAddition: number;
  realAnnualReturnPct: number;
  volatilityAnnualPct?: number; // default 12% a.a. (carteira diversificada)
  monthsHorizon?: number;
  trials?: number;
}): MonteCarloPoint[] {
  const monthsHorizon = args.monthsHorizon ?? 360; // 30 anos
  const trials = args.trials ?? 500;
  const annualVol = args.volatilityAnnualPct ?? 12;
  const monthlyMean = annualToMonthlyRate(args.realAnnualReturnPct);
  const monthlyVol = annualVol / Math.sqrt(12) / 100;

  // Roda trials trajetórias. Pra economia de memória, armazena só a matriz [month][trial]
  const results: number[][] = Array.from({ length: monthsHorizon + 1 }, () => []);

  for (let t = 0; t < trials; t += 1) {
    let nw = args.currentNetWorth;
    results[0].push(nw);
    for (let m = 1; m <= monthsHorizon; m += 1) {
      const rand = boxMuller();
      const monthlyReturn = monthlyMean + monthlyVol * rand;
      nw = nw * (1 + monthlyReturn) + args.monthlyAddition;
      if (nw < 0) nw = 0;
      results[m].push(nw);
    }
  }

  // Calcula percentis
  return results.map((arr, m) => {
    arr.sort((a, b) => a - b);
    return {
      month: m,
      p10: round2(arr[Math.floor(arr.length * 0.1)] ?? 0),
      p50: round2(arr[Math.floor(arr.length * 0.5)] ?? 0),
      p90: round2(arr[Math.floor(arr.length * 0.9)] ?? 0),
    };
  });
}

function boxMuller(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ============================================================================
// Classificação FIRE
// ============================================================================

function classifyFire(args: {
  currentNetWorth: number;
  fireTargetNetWorth: number;
  targetMonthlyIncome: number;
  currentPassiveMonthlyIncome: number;
  inssMonthlyEstimate: number;
  monthlyAddition: number;
  monthsToFire: number | null;
  realAnnualReturnPct: number;
}): FireClassification {
  const { currentNetWorth, fireTargetNetWorth, targetMonthlyIncome, currentPassiveMonthlyIncome, inssMonthlyEstimate, monthlyAddition, monthsToFire, realAnnualReturnPct } = args;

  const totalPassive = currentPassiveMonthlyIncome + inssMonthlyEstimate;
  const coverage = targetMonthlyIncome > 0 ? totalPassive / targetMonthlyIncome : 0;

  if (currentNetWorth >= fireTargetNetWorth * 1.3) return "fat";
  if (currentNetWorth >= fireTargetNetWorth) return "achieved";
  if (coverage >= 1) return "regular";

  // Coast FIRE: se parasse de aportar HOJE, ainda chegaria a FIRE em X anos razoável
  if (monthlyAddition > 0) {
    // simula sem aporte
    const monthsCoast = computeMonthsToFire({
      currentNetWorth,
      targetNetWorth: fireTargetNetWorth,
      monthlyAddition: 0,
      realAnnualReturnPct, // usa o retorno configurado pelo usuário (antes era 6% fixo)
    });
    if (monthsCoast != null && monthsCoast <= 30 * 12) return "coast";
  }

  // Barista: passiva (sem INSS) cobre > 40% mas < 100% do target
  if (
    currentPassiveMonthlyIncome / Math.max(1, targetMonthlyIncome) >= 0.4 &&
    coverage < 1
  )
    return "barista";

  // Lean: cobertura ≥ 0.6
  if (coverage >= 0.6) return "lean";

  return "building";
}

function round2(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

// ============================================================================
// Idade atual a partir de birth_date
// ============================================================================

export function computeAge(birthDate: string): number {
  const d = new Date(birthDate + "T00:00:00Z");
  if (isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return diff / (1000 * 60 * 60 * 24 * 365.25);
}
