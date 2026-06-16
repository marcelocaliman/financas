import { CLASS, LIABILITY_TYPE } from "@/domain/taxonomy";
import type { SeedData } from "./repository";

/**
 * Dados de exemplo no novo modelo de categorias (classId/subtypeId/regionId…).
 * NÃO são mais carregados automaticamente — o app começa vazio. O usuário pode
 * carregá-los sob demanda na Config ("carregar dados de exemplo") pra explorar.
 */
export const SEED: SeedData = {
  assets: [
    { id: "a1", name: "Tesouro IPCA+ 2035", classId: CLASS.rendaFixa, subtypeId: "renda-fixa-3", regionId: "brasil", currency: "BRL", amount: 320000, indexerId: "ipca" },
    { id: "a2", name: "CDB liquidez diária", classId: CLASS.rendaFixa, subtypeId: "renda-fixa-4", regionId: "brasil", currency: "BRL", amount: 180000, indexerId: "cdi", institution: "Banco Inter" },
    { id: "a3", name: "LCI", classId: CLASS.rendaFixa, subtypeId: "renda-fixa-5", regionId: "brasil", currency: "BRL", amount: 95000, indexerId: "cdi" },
    { id: "a4", name: "Imóvel de aluguel · RJ", classId: CLASS.imoveis, subtypeId: "imoveis-4", regionId: "brasil", currency: "BRL", amount: 850000 },
    { id: "a5", name: "Conta corrente · Itália", classId: CLASS.caixa, subtypeId: "caixa-3", regionId: "italia", currency: "EUR", amount: 12000, institution: "Intesa Sanpaolo" },
    { id: "a6", name: "Reserva de emergência", classId: CLASS.caixa, subtypeId: "caixa-5", regionId: "italia", currency: "EUR", amount: 25000 },
  ],
  liabilities: [
    { id: "l1", name: "Financiamento imóvel · RJ", typeId: LIABILITY_TYPE.financiamentoImobiliario, currency: "BRL", amount: 180000, interestRate: 9.5, installments: 180 },
    { id: "l2", name: "Cartão de crédito", typeId: LIABILITY_TYPE.cartaoCredito, currency: "EUR", amount: 1800 },
  ],
  expenses: [
    { id: "e1", name: "Moradia", currency: "EUR", amount: 600 },
    { id: "e2", name: "Alimentação", currency: "EUR", amount: 450 },
    { id: "e3", name: "Lazer", currency: "EUR", amount: 200 },
    { id: "e4", name: "Outros", currency: "EUR", amount: 150 },
    { id: "e5", name: "Transporte", currency: "EUR", amount: 120 },
    { id: "e6", name: "Saúde", currency: "EUR", amount: 90 },
  ],
  incomes: [
    { id: "i1", name: "Freela", currency: "EUR", amount: 3500 },
    { id: "i2", name: "Aluguel · RJ", currency: "BRL", amount: 4200 },
  ],
  snapshots: [
    { id: "s1", month: "2026-01", currency: "EUR", amount: 262000, contribution: 2500 },
    { id: "s2", month: "2026-02", currency: "EUR", amount: 268000, contribution: 2500 },
    { id: "s3", month: "2026-03", currency: "EUR", amount: 271500, contribution: 2000 },
    { id: "s4", month: "2026-04", currency: "EUR", amount: 274000, contribution: 2000 },
    { id: "s5", month: "2026-05", currency: "EUR", amount: 277200, contribution: 2500 },
    { id: "s6", month: "2026-06", currency: "EUR", amount: 279043, contribution: 2500 },
  ],
};
