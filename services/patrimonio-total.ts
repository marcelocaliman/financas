import "server-only";
import { cache } from "react";
import { getAccountsTotals } from "@/services/accounts";
import { getPortfolioStats } from "@/services/investments";
import { getPhysicalAssetsTotals } from "@/services/physical-assets";
import { getDebtsReport } from "@/services/debts";
import type { Currency } from "@/types/database";

/**
 * Fonte ÚNICA do "patrimônio total" (auditoria UX: "patrimônio" significava 3
 * coisas em 3 páginas e nenhuma respondia 'qual é o meu patrimônio total?').
 *
 * Patrimônio líquido = contas líquidas + carteira (investimentos) + bens − dívidas.
 * Tudo na moeda de exibição. Memoizado por request.
 */

export interface PatrimonioTotal {
  /** Saldo em contas (exclui o caixa que já está alocado em investimentos). */
  contas: number;
  /** Carteira de investimentos. */
  carteira: number;
  /** Bens imobilizados (imóveis, veículos, etc.). */
  bens: number;
  /** Dívidas (valor positivo a abater). */
  dividas: number;
  /** Bruto = contas + carteira + bens. */
  bruto: number;
  /** Líquido = bruto − dívidas. */
  liquido: number;
  displayCurrency: Currency;
}

export const getPatrimonioTotal = cache(async (): Promise<PatrimonioTotal> => {
  const [accountsTotals, portfolio, physical, debts] = await Promise.all([
    getAccountsTotals(),
    getPortfolioStats(),
    getPhysicalAssetsTotals(),
    getDebtsReport(),
  ]);

  const contas = accountsTotals.liquidExcludingInvestmentCash;
  const carteira = portfolio.total;
  const bens = physical.total;
  const dividas = debts.totalCurrent;
  const bruto = contas + carteira + bens;

  return {
    contas,
    carteira,
    bens,
    dividas,
    bruto,
    liquido: bruto - dividas,
    displayCurrency: accountsTotals.displayCurrency,
  };
});
