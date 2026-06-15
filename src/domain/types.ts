import type { Currency } from "@/money/currency";

/**
 * Tipos de domínio. REGRA central (BRIEF §5/§10): cada item guarda a PRÓPRIA
 * moeda; a conversão pra moeda de exibição é feita por uma camada à parte.
 */

export type AssetType = "investment" | "property" | "cash";

export interface Asset {
  id: string;
  name: string;
  currency: Currency;
  amount: number;
  type: AssetType;
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

export type LiabilityType = "loan" | "card" | "mortgage" | "other";

export interface Liability {
  id: string;
  name: string;
  currency: Currency;
  amount: number; // saldo devedor (positivo)
  type: LiabilityType;
}
