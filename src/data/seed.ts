import { CLASS, LIABILITY_TYPE } from "@/domain/taxonomy";
import type { SeedData } from "./repository";
import type { Currency } from "@/money/currency";

/**
 * Dados de exemplo ANCORADOS na moeda principal. O dia a dia (moradia, mercado,
 * transporte, salário, reserva, patrimônio local e toda a história de patrimônio)
 * nasce na moeda principal do usuário; só 2 itens "do exterior" ficam numa moeda
 * contraparte — o suficiente pra demonstrar o multimoeda sem dominar a visão.
 * NÃO são carregados automaticamente — o app começa vazio (opt-in pela Config).
 */

/** Moeda "do outro país" pra a demonstração cross-border (sem dominar a tela). */
const COUNTERPART: Record<Currency, Currency> = {
  BRL: "EUR",
  EUR: "BRL",
  USD: "EUR",
  GBP: "EUR",
};

/** Escala aproximada vs. uma referência em EUR, pra valores realistas em cada moeda. */
const SCALE: Record<Currency, number> = { EUR: 1, USD: 1.08, GBP: 0.85, BRL: 5.6 };

/** Converte um valor de referência (EUR) pra a moeda dada e arredonda pra número redondo. */
function nice(eurRef: number, c: Currency): number {
  const v = eurRef * SCALE[c];
  const step = v >= 100000 ? 10000 : v >= 10000 ? 1000 : v >= 1000 ? 100 : v >= 100 ? 10 : 5;
  return Math.max(step, Math.round(v / step) * step);
}

/** Mês "AAAA-MM" deslocado de `back` meses a partir de um âncora fixo (junho/2026). */
function pastMonth(back: number): string {
  const m = 6 - back; // junho = 6
  return `2026-${String(m).padStart(2, "0")}`;
}

export function buildSeed(main: Currency): SeedData {
  const ab = COUNTERPART[main];
  const m = (eurRef: number) => nice(eurRef, main); // item local (moeda principal)
  const a = (eurRef: number) => nice(eurRef, ab); // item "do exterior" (contraparte)

  return {
    assets: [
      { id: "a1", name: "Tesouro / Renda fixa", classId: CLASS.rendaFixa, subtypeId: "renda-fixa-3", regionId: "brasil", currency: main, amount: m(57000), cost: m(52000), indexerId: "ipca" },
      { id: "a2", name: "CDB liquidez diária", classId: CLASS.rendaFixa, subtypeId: "renda-fixa-4", currency: main, amount: m(32000), cost: m(30000), indexerId: "cdi", institution: "Banco digital" },
      { id: "a3", name: "Imóvel", classId: CLASS.imoveis, subtypeId: "imoveis-4", currency: main, amount: m(150000) },
      { id: "a4", name: "Reserva de emergência", classId: CLASS.caixa, subtypeId: "caixa-5", currency: main, amount: m(25000) },
      // Itens "do exterior" — demonstram o multimoeda sem dominar a tela.
      { id: "a5", name: "Conta no exterior", classId: CLASS.caixa, subtypeId: "caixa-3", regionId: "italia", currency: ab, amount: a(12000), institution: "Conta internacional" },
      { id: "a6", name: "Ações", classId: CLASS.acoes, subtypeId: "acoes-1", regionId: "brasil", currency: "BRL", amount: 2500, ticker: "BBAS3", quantity: 100, avgPrice: 25, institution: "Corretora" },
    ],
    liabilities: [
      { id: "l1", name: "Financiamento imóvel", typeId: LIABILITY_TYPE.financiamentoImobiliario, currency: main, amount: m(32000), interestRate: 9.5, installments: 180 },
      { id: "l2", name: "Cartão de crédito", typeId: LIABILITY_TYPE.cartaoCredito, currency: main, amount: m(450) },
    ],
    expenses: [
      { id: "e1", categoryId: "moradia", name: "Aluguel + condomínio", currency: main, amount: m(900) },
      { id: "e2", categoryId: "alimentacao", name: "Mercado", currency: main, amount: m(500) },
      { id: "e3", categoryId: "lazer", name: "Restaurantes e saídas", currency: main, amount: m(220) },
      { id: "e4", categoryId: "gasto-outros", name: "Diversos", currency: main, amount: m(160) },
      { id: "e5", categoryId: "transporte", name: "Transporte", currency: main, amount: m(130) },
      { id: "e6", categoryId: "saude", name: "Plano de saúde", currency: main, amount: m(95) },
    ],
    incomes: [
      { id: "i1", categoryId: "freela", name: "Salário / PJ", currency: main, amount: m(3800) },
      // Renda recebida no exterior — segunda metade da história cross-border.
      { id: "i2", categoryId: "aluguel", name: "Aluguel recebido (exterior)", currency: ab, amount: a(700) },
    ],
    // Orçado mensal por categoria (na moeda principal) — um pouco acima do gasto, e
    // "lazer" abaixo de propósito pra demonstrar o estouro (vermelho).
    budgetTargets: {
      moradia: m(1000),
      alimentacao: m(550),
      lazer: m(200),
      "gasto-outros": m(200),
      transporte: m(150),
      saude: m(120),
    },
    // SÓ meses passados — o mês corrente é COMPUTADO do patrimônio (useAutoSnapshot),
    // então Painel (herói) = última ponta da tendência = Histórico (atual), sempre.
    snapshots: [
      { id: "s1", month: pastMonth(5), currency: main, amount: m(226000), contribution: m(2300) },
      { id: "s2", month: pastMonth(4), currency: main, amount: m(231000), contribution: m(2300) },
      { id: "s3", month: pastMonth(3), currency: main, amount: m(235000), contribution: m(2000) },
      { id: "s4", month: pastMonth(2), currency: main, amount: m(239000), contribution: m(2000) },
      { id: "s5", month: pastMonth(1), currency: main, amount: m(242000), contribution: m(2300) },
    ],
  };
}

/** Compat: alguns call-sites/testes importam o exemplo estático (principal = BRL). */
export const SEED: SeedData = buildSeed("BRL");
