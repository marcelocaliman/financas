/**
 * Cálculo puro de Ganho de Capital (GCAP) na venda de imóveis.
 * Sem I/O — pode rodar em client component pra preview ao vivo.
 *
 * Base legal:
 *   - Lei 7.713/88 art. 18 — alíquota 15% sobre o lucro
 *   - Lei 13.259/16 art. 2º — faixas progressivas acima de R$ 5M:
 *       Até R$ 5M       → 15%
 *       R$ 5M a R$ 10M  → 17,5%
 *       R$ 10M a R$ 30M → 20%
 *       Acima R$ 30M    → 22,5%
 *   - Lei 11.196/05 art. 39 — isenção: produto da venda de residencial
 *     usado pra comprar OUTRO residencial em 180 dias
 *   - Lei 9.250/95 art. 23 — isenção: imóvel residencial único < R$ 440k
 *   - Lei 11.196/05 art. 40 — fator de redução (FR1 e FR2) por tempo de posse
 */

const FAIXA_RATES = [
  { upTo: 5_000_000, rate: 0.15 },
  { upTo: 10_000_000, rate: 0.175 },
  { upTo: 30_000_000, rate: 0.20 },
  { upTo: Infinity, rate: 0.225 },
];

export type GcapCalculation = {
  salePrice: number;
  acquisitionCost: number;
  grossProfit: number;
  reductionFactorPre88: number | null;
  reductionFactor96To05: number | null;
  reductionApplied: number;
  taxableProfit: number;
  exemption: {
    kind: "unico_imovel_440k" | "reaplicacao_residencial" | "desapropriacao" | "permuta_sem_torna" | "bem_movel_35k" | "isencao_acoes_20k" | "none";
    applied: boolean;
    reason: string;
  };
  taxRate: number;
  taxDue: number;
  darfDueDate: string;
};

/** Asset kind pro cálculo: muda regras de isenção e fator de redução. */
export type GcapAssetKind = "real_estate" | "movable" | "other";

/**
 * Fator de redução FR1 (Lei 11.196/05 art. 40, I) — bens pré-1996.
 * Aproximação 1.0060^M nos meses dentro do período anterior a 1996.
 */
export function computeReductionFactorPre88(
  acquiredAt: string,
  saleDate: string,
): number | null {
  const acqYear = parseInt(acquiredAt.slice(0, 4));
  if (acqYear >= 1996) return null;
  const acquired = new Date(acquiredAt);
  const sale = new Date(saleDate);
  const monthsBetween =
    (sale.getFullYear() - acquired.getFullYear()) * 12 +
    (sale.getMonth() - acquired.getMonth());
  return 1 / Math.pow(1.0060, monthsBetween);
}

/**
 * Fator de redução FR2 (Lei 11.196/05 art. 40, II).
 * Aplica-se SÓ aos bens adquiridos entre 01/01/1996 e 31/12/2005.
 * Bens pós-2005 não têm FR2.
 */
export function computeReductionFactor96To05(
  acquiredAt: string,
  saleDate: string,
): number {
  const acquired = new Date(acquiredAt);
  const refStart = new Date("1996-01-01");
  const refEnd = new Date("2005-12-31");
  if (acquired < refStart || acquired > refEnd) return 1;
  const sale = new Date(saleDate);
  const months =
    (sale.getFullYear() - acquired.getFullYear()) * 12 +
    (sale.getMonth() - acquired.getMonth());
  if (months <= 0) return 1;
  return 1 / Math.pow(1.0035, months);
}

/**
 * Tabela progressiva: aplica alíquotas crescentes em cada faixa.
 */
export function calcProgressiveGcap(profit: number): { tax: number; effectiveRate: number } {
  if (profit <= 0) return { tax: 0, effectiveRate: 0 };
  let remaining = profit;
  let tax = 0;
  let lower = 0;
  for (const f of FAIXA_RATES) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, f.upTo - lower);
    tax += slice * f.rate;
    remaining -= slice;
    lower = f.upTo;
  }
  return { tax: Math.round(tax * 100) / 100, effectiveRate: tax / profit };
}

/**
 * Último dia útil do mês SEGUINTE à venda.
 */
function lastBusinessDayOfNextMonth(saleDate: string): string {
  const d = new Date(saleDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 2, 0);
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay.toISOString().slice(0, 10);
}

export function computeGcap(args: {
  salePrice: number;
  acquisitionCost: number;
  acquiredAt: string;
  saleDate: string;
  /** Tipo do bem (afeta isenções aplicáveis). Default: real_estate */
  assetKind?: GcapAssetKind;
  isUniqueResidencialUnder440k?: boolean;
  willReinvestIn180Days?: boolean;
  reinvestAmount?: number;
  /** Soma de outras vendas de bens móveis no MESMO mês — pra checar limite 35k */
  otherMovableSalesSameMonth?: number;
}): GcapCalculation {
  const assetKind = args.assetKind ?? "real_estate";
  const grossProfit = Math.max(0, args.salePrice - args.acquisitionCost);

  // FR1 e FR2 são pra IMÓVEIS — não se aplicam a bens móveis
  const fr1 = assetKind === "real_estate"
    ? computeReductionFactorPre88(args.acquiredAt, args.saleDate)
    : null;
  const fr2 = assetKind === "real_estate"
    ? computeReductionFactor96To05(args.acquiredAt, args.saleDate)
    : null;
  let taxableProfit = grossProfit;
  if (fr1 != null) taxableProfit *= fr1;
  if (fr2 != null && fr2 < 1) taxableProfit *= fr2;
  taxableProfit = Math.max(0, Math.round(taxableProfit * 100) / 100);

  let exemptionKind: GcapCalculation["exemption"]["kind"] = "none";
  let exemptionApplied = false;
  let exemptionReason = "";
  let taxablePostExemption = taxableProfit;

  // Isenções específicas por tipo de bem
  if (assetKind === "real_estate") {
    if (args.isUniqueResidencialUnder440k && args.salePrice <= 440_000) {
      exemptionKind = "unico_imovel_440k";
      exemptionApplied = true;
      exemptionReason = "Imóvel residencial único do contribuinte, valor de venda ≤ R$ 440k (Lei 9.250/95 art. 23).";
      taxablePostExemption = 0;
    } else if (args.willReinvestIn180Days) {
      const reinvestPct = args.reinvestAmount
        ? Math.min(1, args.reinvestAmount / args.salePrice)
        : 1;
      exemptionKind = "reaplicacao_residencial";
      exemptionApplied = true;
      exemptionReason =
        `Reaplicação em outro imóvel residencial em até 180 dias (Lei 11.196/05 art. 39). ` +
        `Isenção proporcional: ${(reinvestPct * 100).toFixed(0)}% do ganho.`;
      taxablePostExemption = Math.max(0, taxableProfit * (1 - reinvestPct));
    }
  } else if (assetKind === "movable") {
    // Isenção R$ 35.000/mês em vendas de bens móveis (Lei 9.250/95 art. 22)
    const totalMonth = args.salePrice + (args.otherMovableSalesSameMonth ?? 0);
    if (totalMonth <= 35_000) {
      exemptionKind = "bem_movel_35k";
      exemptionApplied = true;
      exemptionReason =
        `Vendas de bens móveis no mês (R$ ${totalMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) ≤ R$ 35.000 — isenta (Lei 9.250/95 art. 22).`;
      taxablePostExemption = 0;
    }
  }

  const { tax: taxDue, effectiveRate } = calcProgressiveGcap(taxablePostExemption);

  return {
    salePrice: args.salePrice,
    acquisitionCost: args.acquisitionCost,
    grossProfit: Math.round(grossProfit * 100) / 100,
    reductionFactorPre88: fr1,
    reductionFactor96To05: fr2,
    reductionApplied: Math.round((grossProfit - taxableProfit) * 100) / 100,
    taxableProfit: Math.round(taxablePostExemption * 100) / 100,
    exemption: {
      kind: exemptionKind,
      applied: exemptionApplied,
      reason: exemptionReason,
    },
    taxRate: effectiveRate,
    taxDue,
    darfDueDate: lastBusinessDayOfNextMonth(args.saleDate),
  };
}
