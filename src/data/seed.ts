import { CLASS, LIABILITY_TYPE } from "@/domain/taxonomy";
import type { SeedData } from "./repository";
import type { Currency } from "@/money/currency";

/**
 * Dados de exemplo — um retrato COMPLETO e coerente de quem vive entre países:
 * patrimônio diversificado, orçamento com fatura de cartão e contas a vencer,
 * histórico de 11 meses, metas, proventos e alvos de alocação. Serve tanto de
 * ponto de partida pro novo usuário quanto de "perfil vitrine" pra demonstração.
 *
 * Tudo nasce na MOEDA PRINCIPAL do usuário; uma fatia fica em duas moedas
 * contraparte (ex.: EUR + USD) — o suficiente pra o multimoeda aparecer de
 * verdade (composição, "equivale a") sem deixar de ser crível/local-first.
 * NÃO é carregado automaticamente — o app começa vazio (opt-in pela Config).
 */

/** As duas moedas "do exterior" pra a demonstração cross-border, por moeda principal. */
const FOREIGN: Record<Currency, [Currency, Currency]> = {
  BRL: ["EUR", "USD"],
  EUR: ["BRL", "USD"],
  USD: ["EUR", "BRL"],
  GBP: ["EUR", "USD"],
};

/** Escala aproximada vs. uma referência em EUR, pra valores realistas em cada moeda. */
const SCALE: Record<Currency, number> = { EUR: 1, USD: 1.08, GBP: 0.85, BRL: 5.6 };

/** Converte um valor de referência (EUR) pra a moeda dada e arredonda pra número redondo. */
function nice(eurRef: number, c: Currency): number {
  const v = eurRef * SCALE[c];
  const step = v >= 100000 ? 10000 : v >= 10000 ? 1000 : v >= 1000 ? 100 : v >= 100 ? 10 : 5;
  return Math.max(step, Math.round(v / step) * step);
}

/** Mês "AAAA-MM" deslocado de `offset` meses a partir do mês atual (negativo = passado). */
function monthKey(offset: number): string {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

export function buildSeed(main: Currency): SeedData {
  const [c2, c3] = FOREIGN[main]; // contrapartes (ex.: EUR, USD)
  const m = (eurRef: number) => nice(eurRef, main); // item local (moeda principal)
  const f2 = (eurRef: number) => nice(eurRef, c2); // item na 1ª moeda do exterior
  const f3 = (eurRef: number) => nice(eurRef, c3); // item na 2ª moeda do exterior

  // ── Orçamento: 3 meses (atual + 2 anteriores) com leve variação → visão histórica. ──
  const months = [monthKey(-2), monthKey(-1), monthKey(0)];
  const vary = [0.94, 1, 1.06];
  // Gastos recorrentes/avulsos (fora a fatura do cartão, tratada à parte).
  const EXP = [
    { key: "moradia", categoryId: "moradia", name: "Aluguel + condomínio", eur: 250, recurring: true, dueDay: 5 },
    { key: "mercado", categoryId: "alimentacao", name: "Mercado", eur: 220 },
    { key: "transporte", categoryId: "transporte", name: "Transporte", eur: 70, recurring: true },
    { key: "saude", categoryId: "saude", name: "Plano de saúde", eur: 115, recurring: true, dueDay: 10 },
    { key: "lazer", categoryId: "lazer", name: "Restaurantes e lazer", eur: 90 },
    { key: "assinaturas", categoryId: "servicos", name: "Assinaturas (apps, streaming)", eur: 22, recurring: true },
    { key: "italiano", categoryId: "educacao", name: "Curso de italiano", eur: 55, recurring: true },
    { key: "impostos", categoryId: "impostos-gasto", name: "Impostos e taxas", eur: 35 },
  ];
  const expenses = months.flatMap((mo, mi) => {
    const rows = EXP.map((e) => ({
      id: `e-${mi}-${e.key}`,
      month: mo,
      categoryId: e.categoryId,
      name: e.name,
      currency: main,
      amount: m(Math.round(e.eur * vary[mi])),
      ...(e.recurring ? { recurring: true } : {}),
      ...("dueDay" in e && e.dueDay ? { dueDay: e.dueDay } : {}),
      // Nos meses passados as contas já foram pagas; o mês corrente segue em aberto.
      ...(mi < 2 ? { paid: true } : {}),
    }));
    // Fatura do cartão (guarda-chuva) + itens DENTRO dela (discriminados, sem dupla contagem).
    const faturaId = `e-${mi}-fatura`;
    rows.push({
      id: faturaId,
      month: mo,
      categoryId: "gasto-cartao",
      name: "Fatura do cartão",
      currency: main,
      amount: m(Math.round(320 * vary[mi])),
      recurring: true,
      dueDay: 15,
      isStatement: true,
      ...(mi < 2 ? { paid: true } : {}),
    } as (typeof rows)[number]);
    if (mi >= 1) {
      rows.push(
        { id: `e-${mi}-c1`, month: mo, categoryId: "servicos", name: "Streaming", currency: main, amount: m(11), parentId: faturaId } as (typeof rows)[number],
        { id: `e-${mi}-c2`, month: mo, categoryId: "gasto-outros", name: "Compras online", currency: main, amount: m(Math.round(70 * vary[mi])), parentId: faturaId } as (typeof rows)[number],
      );
    }
    return rows;
  });

  const incomes = months.flatMap((mo, mi) => {
    const rows = [
      { id: `i-${mi}-salario`, month: mo, categoryId: "salario", name: "Salário", currency: main, amount: m(Math.round(750 * vary[mi])), recurring: true },
      { id: `i-${mi}-freela`, month: mo, categoryId: "freela", name: "Freela / PJ", currency: main, amount: m(Math.round(270 * vary[mi])), recurring: true },
      // Renda "do exterior" na moeda contraparte — demonstra receber numa moeda, gastar noutra.
      { id: `i-${mi}-aluguel`, month: mo, categoryId: "aluguel", name: "Aluguel recebido (Itália)", currency: c2, amount: f2(700), recurring: true },
    ];
    // Proventos caem no mês corrente (variedade de categorias de receita).
    if (mi === 2) rows.push({ id: `i-${mi}-div`, month: mo, categoryId: "dividendos", name: "Proventos recebidos", currency: main, amount: m(45), recurring: false });
    return rows;
  });

  return {
    assets: [
      // Modelo POR CLASSE × MOEDA: um valor por classe/moeda (sem discriminar item). Onde faz
      // sentido, guarda o aplicado (cost) além do atual pra a rentabilidade aparecer.
      // Renda Fixa (principal).
      { id: "a-rf", name: "", classId: CLASS.rendaFixa, currency: main, amount: m(18300), cost: m(16900) },
      // Ações — BR (principal) + Europa (EUR) + EUA (USD): o multimoeda de verdade.
      { id: "a-ac-main", name: "", classId: CLASS.acoes, currency: main, amount: m(8600), cost: m(6800) },
      { id: "a-ac-eu", name: "", classId: CLASS.acoes, currency: c2, amount: f2(5000), cost: f2(4000) },
      { id: "a-ac-us", name: "", classId: CLASS.acoes, currency: c3, amount: f3(5000), cost: f3(4000) },
      // FIIs (principal) — geram os proventos abaixo.
      { id: "a-fii", name: "", classId: CLASS.fiis, currency: main, amount: m(5400), cost: m(4800) },
      // Previdência (principal).
      { id: "a-prev", name: "", classId: CLASS.previdencia, currency: main, amount: m(9800), cost: m(8200) },
      // Cripto (USD) e Ouro (principal) — diversificam o donut.
      { id: "a-cripto", name: "", classId: CLASS.cripto, currency: c3, amount: f3(2800), cost: f3(1600) },
      { id: "a-ouro", name: "", classId: CLASS.commodities, currency: main, amount: m(2500), cost: m(2150) },
      // Caixa — reserva + conta (principal) e conta no exterior (EUR).
      { id: "a-cx-main", name: "", classId: CLASS.caixa, currency: main, amount: m(12850) },
      { id: "a-cx-eu", name: "", classId: CLASS.caixa, currency: c2, amount: f2(18000) },
      // Patrimônio físico (principal).
      { id: "a-imo", name: "", classId: CLASS.imoveis, currency: main, amount: m(37500) },
      { id: "a-bens", name: "", classId: CLASS.bens, currency: main, amount: m(8000) },
    ],
    liabilities: [
      { id: "l1", name: "Financiamento do apê", typeId: LIABILITY_TYPE.financiamentoImobiliario, currency: main, amount: m(17000), interestRate: 9.5, installments: 156 },
      { id: "l2", name: "Financiamento do carro", typeId: LIABILITY_TYPE.financiamentoVeiculo, currency: main, amount: m(3200), interestRate: 18, installments: 30 },
      { id: "l3", name: "Cartão de crédito", typeId: LIABILITY_TYPE.cartaoCredito, currency: main, amount: m(450) },
    ],
    expenses,
    incomes,
    // Proventos (renda passiva) dos últimos 6 meses — do FII e do ETF, na moeda principal.
    dividends: [-6, -5, -4, -3, -2, -1].map((off, i) => ({
      id: `d${i + 1}`,
      month: monthKey(off),
      source: i % 2 === 0 ? "FII de tijolo" : "ETF de ações (BR)",
      currency: main,
      amount: m([20, 18, 24, 19, 26, 22][i]),
    })),
    // SÓ meses passados (11) — o mês corrente é COMPUTADO do patrimônio (useAutoSnapshot),
    // então Painel (herói) = última ponta da tendência = Histórico (atual), sempre.
    snapshots: Array.from({ length: 11 }, (_, i) => {
      const eurRef = Math.round(76000 + (107000 - 76000) * (i / 10)); // sobe suave até ~atual
      return { id: `s${i + 1}`, month: monthKey(i - 11), currency: main, amount: m(eurRef), contribution: m(500) };
    }),
    goals: [
      { id: "g1", name: "Reserva de emergência", currency: main, target: m(12000), current: m(10700) },
      { id: "g2", name: "Entrada do apê na Itália", currency: c2, target: f2(40000), current: f2(15000), deadline: "2028" },
      { id: "g3", name: "Fundo de viagem", currency: main, target: m(4000), current: m(1500), deadline: "12/2027" },
      { id: "g4", name: "Independência financeira", currency: main, target: m(180000), current: m(70000), deadline: "2040" },
    ],
    settings: {
      // Alvos de alocação (%) — o rebalanceamento mostra o quanto falta/sobra por classe.
      allocationTargets: {
        [CLASS.rendaFixa]: 28,
        [CLASS.acoes]: 22,
        [CLASS.fiis]: 12,
        [CLASS.previdencia]: 10,
        [CLASS.cripto]: 5,
        [CLASS.commodities]: 3,
        [CLASS.caixa]: 20,
      },
      liberdade: {
        milestones: [m(45000), m(90000), m(180000)],
        passiveCategories: ["aluguel"],
        reserveMonths: 6,
      },
    },
  };
}

/** Compat: alguns call-sites/testes importam o exemplo estático (principal = BRL). */
export const SEED: SeedData = buildSeed("BRL");
