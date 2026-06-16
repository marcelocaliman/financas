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
}

export interface Expense {
  id: string;
  name: string;
  currency: Currency;
  amount: number; // valor mensal
}

export interface Income {
  id: string;
  name: string;
  currency: Currency;
  amount: number; // valor mensal
}

export interface NetWorthSnapshot {
  id: string;
  month: string; // rótulo curto por enquanto (ex.: "Jun"); vira data ISO depois
  currency: Currency;
  amount: number;
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
