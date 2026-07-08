import type { Currency } from "@/money/currency";

// ── Organizador de IRPF ──────────────────────────────────────────────────────
// Retrato ESTÁTICO de 31/12 (descrição + valor), separado do dia a dia (que é por totais por classe).
// O app ORGANIZA um documento pro contador digitar no programa da Receita — NÃO declara, NÃO envia,
// NÃO calcula imposto. Ver memória [[irpf-organizer-design]].

/** Cabeçalho anual: 1 registro por ano-base (a posição em 31/12 daquele ano). */
export interface TaxReturn {
  /** = String(baseYear), ex.: "2025". */
  id: string;
  /** Ano-base — a posição declarada é a de 31/12 deste ano. */
  baseYear: number;
  /** Moeda em que o contador digita a declaração (BRL). */
  reportingCurrency: Currency;
  status: "draft" | "ready";
  notes?: string;
  /** last-write-wins do sync. */
  updatedAt: number;
}

export type TaxItemKind = "asset" | "debt";

/** Uma linha de "Bens e Direitos" (ou "Dívidas e Ônus") — foto de 31/12. */
export interface TaxItem {
  /** Determinístico p/ os que vêm do patrimônio (`irpf-<ano>-a-<assetId>`); uuid p/ manuais. */
  id: string;
  /** Índice → TaxReturn.baseYear. */
  baseYear: number;
  kind: TaxItemKind;
  /** Grupo do IRPF "01".."99" — STRING (preserva zero à esquerda). Vazio = ainda sem código. */
  group: string;
  /** Código dentro do grupo — STRING. Vazio = ainda sem código. */
  code: string;
  /** Texto literal do campo "Discriminação" da Receita. */
  discriminacao: string;
  /** Usuário editou a discriminação → o template para de sobrescrever. */
  discriminacaoLocked?: boolean;
  /** Moeda do item (BRL doméstico; EUR/USD/… no exterior). */
  currency: Currency;
  /** Situação em 31/12 do ano-base, NA MOEDA `currency`. */
  valorAnoBase: number;
  /** Situação em 31/12 do ano anterior, NA MOEDA `currency`. */
  valorAnoAnterior?: number;
  /** O valor ainda é o "de hoje" (auto-puxado do patrimônio), não confirmado pro fim do ano →
   *  a UI mostra pill âmbar "revisar". Some quando o usuário toca no valor. */
  needsReview?: boolean;
  // Exterior (currency ≠ BRL): o valor em BRL que VAI pra declaração é SEMPRE manual/confirmado —
  // a regra é custo de aquisição pelo câmbio da DATA DA COMPRA, que o app NUNCA auto-calcula.
  valorBrlAnoBase?: number;
  valorBrlAnoAnterior?: number;
  /** Critério/taxa do câmbio informado (ex.: "PTAX compra 15/03/2024" | "manual"). */
  fxNote?: string;
  /** País/região (regionId da taxonomia) — bens no exterior. */
  country?: string;
  institution?: string;
  /** Campos específicos por tipo: cnpj, banco, agencia, conta, ticker, quantidade, matricula… */
  fields: Record<string, string>;
  /** Lembrete pessoal — NÃO vai ao documento do contador. */
  notas?: string;
  source?: "seed-asset" | "seed-liability" | "manual";
  /** Rastro do Asset/Liability de origem — chave da idempotência do seed. */
  sourceId?: string;
  /** Quando foi criado (manual) — pra novos itens aparecerem no topo. */
  createdAt?: number;
}
