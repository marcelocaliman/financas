import type { Currency } from "@/money/currency";

/**
 * Tipos de domínio. REGRA central (BRIEF §5/§10): cada item guarda a PRÓPRIA
 * moeda; a conversão pra moeda de exibição é feita por uma camada à parte.
 */

export interface Asset {
  id: string;
  name: string;
  /** Classe de alocação (obrigatória) — id na taxonomia editável. */
  classId: string;
  /** Subtipo (opcional) — em cascata da Classe. */
  subtypeId?: string;
  /** Região/País (opcional). */
  regionId?: string;
  currency: Currency;
  /** Valor atual, na moeda do ativo (obrigatório). */
  amount: number;
  /** Indexador (opcional, só faz sentido em Renda Fixa). */
  indexerId?: string;
  /** Instituição / corretora (opcional, texto livre). */
  institution?: string;
  /** Ticker p/ cotação automática via brapi (ex.: PETR4, HGLG11) — opcional. */
  ticker?: string;
  /** Quantidade. Com ticker, o valor passa a ser quantidade × cotação do dia. */
  quantity?: number;
  /** Preço médio de compra (p/ ações/cotáveis) — base do custo e da rentabilidade. */
  avgPrice?: number;
}

export interface Expense {
  id: string;
  /** Categoria (obrigatória) — id na taxonomia de categorias de gasto. */
  categoryId: string;
  /** Detalhe livre do item (opcional) — ex.: "Aluguel do apê". */
  name: string;
  currency: Currency;
  amount: number; // valor mensal
}

export interface Income {
  id: string;
  /** Categoria (obrigatória) — id na taxonomia de categorias de receita. */
  categoryId: string;
  /** Detalhe livre do item (opcional). */
  name: string;
  currency: Currency;
  amount: number; // valor mensal
}

export interface NetWorthSnapshot {
  id: string;
  month: string; // "AAAA-MM" (ordenável)
  currency: Currency;
  amount: number;
  /** Aporte do período (opcional) — separa crescimento por aporte vs. rendimento. */
  contribution?: number;
  /** Capturado automaticamente do patrimônio. Edição manual vira `false`/ausente. */
  auto?: boolean;
}

/** Objetivo / meta financeira com barra de progresso (multimoeda). */
export interface Goal {
  id: string;
  name: string;
  currency: Currency;
  target: number; // valor alvo
  current: number; // já acumulado
  deadline?: string; // opcional (ex.: "2030" ou "12/2030")
}

/** Configurações sincronizadas (singleton). */
export interface AppSettings {
  id: string;
  /** Alvo de alocação por classe (id da classe → % inteiro), p/ rebalanceamento. */
  allocationTargets: Record<string, number>;
}

export interface Liability {
  id: string;
  name: string;
  /** Tipo de passivo (obrigatório) — id na taxonomia editável. */
  typeId: string;
  currency: Currency;
  amount: number; // saldo devedor (positivo, obrigatório)
  /** Taxa de juros % a.a. (opcional). */
  interestRate?: number;
  /** Parcelas restantes (opcional). */
  installments?: number;
}
