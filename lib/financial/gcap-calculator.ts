/**
 * Cálculo puro de Ganho de Capital (GCAP) na venda de imóveis/bens.
 * Sem I/O — pode rodar em client component pra preview ao vivo.
 *
 * Base legal:
 *   - Lei 7.713/88 art. 18 — redução percentual por ano de aquisição até 1988
 *     (≤1969 = 100%; −5 p.p./ano; 1988 = 5%; ≥1989 = sem redução).
 *   - Lei 13.259/16 art. 2º — faixas progressivas:
 *       Até R$ 5M → 15% · 5–10M → 17,5% · 10–30M → 20% · >30M → 22,5%
 *   - Lei 11.196/05 art. 39 — isenção: produto da venda de residencial usado
 *     pra comprar OUTRO residencial em 180 dias (uma vez a cada 5 anos).
 *   - Lei 9.250/95 art. 23 — isenção: imóvel residencial único ≤ R$ 440k.
 *   - Lei 11.196/05 art. 40 — fatores de redução FR1 e FR2 por tempo de posse.
 *   - Lei 9.250/95 art. 22 — isenção: bens móveis até R$ 35k/mês.
 *
 * ⚠️ Conferir com contador (MIR/Perguntão IRPF do ano): a contagem de meses dos
 * fatores usa meses-calendário (não arredonda fração de mês pra cima).
 */

import { isBusinessDay } from "./business-days";

const FAIXA_RATES = [
  { upTo: 5_000_000, rate: 0.15 },
  { upTo: 10_000_000, rate: 0.175 },
  { upTo: 30_000_000, rate: 0.20 },
  { upTo: Infinity, rate: 0.225 },
];

// Marcos da Lei 11.196/05 (publicada em 21/11/2005).
const FR1_FLOOR = { y: 1996, m: 1 }; // §2º: imóvel adquirido até 1995 conta a partir de jan/1996
const FR1_END = { y: 2005, m: 11 }; // §1º I: m1 vai até o mês da publicação (nov/2005)
const FR2_START = { y: 2005, m: 12 }; // §1º II: m2 começa no mês seguinte (dez/2005)

export type GcapCalculation = {
  salePrice: number;
  acquisitionCost: number;
  grossProfit: number;
  /** Redução da Lei 7.713/88 art. 18 (fração 0..1) aplicada antes dos FR. null = não-imóvel. */
  art18Reduction: number | null;
  /** FR1 (Lei 11.196/05 art. 40 I). null = não-imóvel. */
  reductionFactorPre88: number | null;
  /** FR2 (Lei 11.196/05 art. 40 II). null = não-imóvel. */
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

function ym(dateStr: string): { y: number; m: number } {
  return { y: parseInt(dateStr.slice(0, 4), 10), m: parseInt(dateStr.slice(5, 7), 10) };
}
function monthsDiff(from: { y: number; m: number }, to: { y: number; m: number }): number {
  return (to.y - from.y) * 12 + (to.m - from.m);
}
function isAfter(a: { y: number; m: number }, b: { y: number; m: number }): boolean {
  return a.y > b.y || (a.y === b.y && a.m > b.m);
}
function maxYM(a: { y: number; m: number }, b: { y: number; m: number }) {
  return isAfter(a, b) ? a : b;
}

/**
 * Redução por ano de aquisição até 1988 (Lei 7.713/88 art. 18; IN SRF 84/2001
 * art. 26). ≤1969 → 100%; cai 5 p.p./ano; 1988 → 5%; ≥1989 → 0%.
 * Retorna a FRAÇÃO de redução (0..1) — multiplicar o ganho por (1 − retorno).
 */
export function computeArt18Reduction(acqYear: number): number {
  if (acqYear <= 1969) return 1;
  if (acqYear >= 1989) return 0;
  return (100 - (acqYear - 1969) * 5) / 100;
}

/**
 * FR1 (Lei 11.196/05 art. 40, §1º, I): 1/1,0060^m1.
 * m1 = nº de meses entre max(aquisição, jan/1996) e nov/2005 (mês da publicação).
 * Imóvel adquirido APÓS nov/2005 não tem FR1 (retorna 1).
 * NB: independe da data da venda (o 2º arg é mantido por compat de assinatura).
 */
export function computeReductionFactorPre88(acquiredAt: string, _saleDate?: string): number {
  void _saleDate;
  const acq = ym(acquiredAt);
  if (isAfter(acq, FR1_END)) return 1;
  const start = maxYM(acq, FR1_FLOOR);
  const m1 = Math.max(0, monthsDiff(start, FR1_END));
  return 1 / Math.pow(1.006, m1);
}

/**
 * FR2 (Lei 11.196/05 art. 40, §1º, II): 1/1,0035^m2.
 * m2 = nº de meses entre max(dez/2005, aquisição) e a venda.
 * Aplica-se a TODO imóvel (cumulativo com FR1), inclusive os adquiridos após 2005.
 */
export function computeReductionFactor96To05(acquiredAt: string, saleDate: string): number {
  const start = maxYM(ym(acquiredAt), FR2_START);
  const m2 = Math.max(0, monthsDiff(start, ym(saleDate)));
  if (m2 <= 0) return 1;
  return 1 / Math.pow(1.0035, m2);
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
 * Último dia ÚTIL do mês seguinte à venda (vencimento do DARF de GCAP).
 * Exclui sábado, domingo E feriados nacionais (Lei 8.981/95 art. 21 §1º).
 */
function lastBusinessDayOfNextMonth(saleDate: string): string {
  const y = parseInt(saleDate.slice(0, 4), 10);
  const mo = parseInt(saleDate.slice(5, 7), 10); // 1-12
  const d = new Date(Date.UTC(y, mo + 1, 0)); // último dia do mês seguinte
  while (!isBusinessDay(d.toISOString().slice(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

export function computeGcap(args: {
  salePrice: number;
  acquisitionCost: number;
  acquiredAt: string;
  saleDate: string;
  /** Tipo do bem (afeta isenções aplicáveis). Default: real_estate */
  assetKind?: GcapAssetKind;
  /** Benfeitorias comprovadas — somam ao custo (RIR/2018 art. 137). */
  improvements?: number;
  /** Corretagem/ITBI da COMPRA — soma ao custo. */
  acquisitionExtras?: number;
  /** Despesas da VENDA (corretagem de venda) — abatem do preço de venda. */
  sellingExpenses?: number;
  isUniqueResidencialUnder440k?: boolean;
  willReinvestIn180Days?: boolean;
  reinvestAmount?: number;
  /** true = já usou a isenção de reaplicação nos últimos 5 anos (Lei 11.196/05
   *  art. 39 §5º) → a isenção NÃO se aplica de novo. */
  reinvestBlockedBy5yr?: boolean;
  /** Soma de outras vendas de bens móveis no MESMO mês — pra checar limite 35k */
  otherMovableSalesSameMonth?: number;
}): GcapCalculation {
  const assetKind = args.assetKind ?? "real_estate";
  const isRealEstate = assetKind === "real_estate";
  // Custo efetivo = preço pago + benfeitorias + corretagem de compra.
  // Venda efetiva = preço de venda − despesas de venda.
  const totalCost = args.acquisitionCost + (args.improvements ?? 0) + (args.acquisitionExtras ?? 0);
  const netSale = args.salePrice - (args.sellingExpenses ?? 0);
  const grossProfit = Math.max(0, netSale - totalCost);

  // Reduções por tempo de posse — só pra IMÓVEIS.
  // Ordem (GCAP da Receita): ganho × (1 − art.18) × FR1 × FR2.
  const acqYear = parseInt(args.acquiredAt.slice(0, 4), 10);
  const art18 = isRealEstate ? computeArt18Reduction(acqYear) : null;
  const fr1 = isRealEstate ? computeReductionFactorPre88(args.acquiredAt, args.saleDate) : null;
  const fr2 = isRealEstate ? computeReductionFactor96To05(args.acquiredAt, args.saleDate) : null;

  let taxableProfit = grossProfit;
  if (art18 != null) taxableProfit *= 1 - art18;
  if (fr1 != null) taxableProfit *= fr1;
  if (fr2 != null) taxableProfit *= fr2;
  taxableProfit = Math.max(0, Math.round(taxableProfit * 100) / 100);

  let exemptionKind: GcapCalculation["exemption"]["kind"] = "none";
  let exemptionApplied = false;
  let exemptionReason = "";
  let taxablePostExemption = taxableProfit;

  // Isenções específicas por tipo de bem
  if (isRealEstate) {
    if (args.isUniqueResidencialUnder440k && args.salePrice <= 440_000) {
      exemptionKind = "unico_imovel_440k";
      exemptionApplied = true;
      exemptionReason = "Imóvel residencial único do contribuinte, valor de venda ≤ R$ 440k (Lei 9.250/95 art. 23).";
      taxablePostExemption = 0;
    } else if (args.willReinvestIn180Days && args.reinvestBlockedBy5yr) {
      // Isenção pedida mas BLOQUEADA pela trava de 5 anos (art. 39 §5º).
      exemptionKind = "none";
      exemptionApplied = false;
      exemptionReason =
        "Reaplicação não isenta: a isenção do art. 39 só pode ser usada UMA vez a cada 5 anos, e já houve uma venda com essa isenção no período.";
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
    art18Reduction: art18,
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
