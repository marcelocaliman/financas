import type { SeedData } from "./repository";

/**
 * Dados de exemplo que reproduzem o protótipo (docs/reference/prototipo-painel.jsx).
 * NÃO são mais carregados automaticamente — o app começa vazio. O usuário pode
 * carregá-los sob demanda na Config ("carregar dados de exemplo") pra explorar.
 */
export const SEED: SeedData = {
  assets: [
    { id: "a1", name: "Tesouro Direto", currency: "BRL", amount: 320000, type: "investment" },
    { id: "a2", name: "CDB", currency: "BRL", amount: 180000, type: "investment" },
    { id: "a3", name: "LCI/LCA", currency: "BRL", amount: 95000, type: "investment" },
    { id: "a4", name: "Imóvel (aluguel · RJ)", currency: "BRL", amount: 850000, type: "property" },
    { id: "a5", name: "Conta corrente · Itália", currency: "EUR", amount: 12000, type: "cash" },
    { id: "a6", name: "Reserva", currency: "EUR", amount: 25000, type: "cash" },
  ],
  liabilities: [
    { id: "l1", name: "Financiamento imóvel · RJ", currency: "BRL", amount: 180000, type: "mortgage" },
    { id: "l2", name: "Cartão de crédito", currency: "EUR", amount: 1800, type: "card" },
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
    { id: "s1", month: "Jan", currency: "EUR", amount: 262000 },
    { id: "s2", month: "Fev", currency: "EUR", amount: 268000 },
    { id: "s3", month: "Mar", currency: "EUR", amount: 271500 },
    { id: "s4", month: "Abr", currency: "EUR", amount: 274000 },
    { id: "s5", month: "Mai", currency: "EUR", amount: 277200 },
    { id: "s6", month: "Jun", currency: "EUR", amount: 279043 },
  ],
};
