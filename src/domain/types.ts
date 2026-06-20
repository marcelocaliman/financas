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
  /** Valor aplicado/investido (custo), na moeda do ativo — p/ classes SEM ticker
   *  (renda fixa, outros). A rentabilidade = (valor atual − aplicado) / aplicado. */
  cost?: number;
}

export interface Expense {
  id: string;
  /** Mês de competência "AAAA-MM" (visão mensal/histórica). */
  month: string;
  /** Categoria (obrigatória) — id na taxonomia de categorias de gasto. */
  categoryId: string;
  /** Detalhe livre do item (opcional) — ex.: "Aluguel do apê". */
  name: string;
  currency: Currency;
  amount: number; // valor no mês
  /** Fixo/recorrente: entra sozinho nos meses seguintes (aluguel, assinaturas…). */
  recurring?: boolean;
  /** Dia de vencimento (1–31) — transforma o gasto numa CONTA A PAGAR. Ausente = sem vencimento. */
  dueDay?: number;
  /** Conta já paga no mês? Cada mês tem a sua linha, então `paid` é por competência. */
  paid?: boolean;
}

export interface Income {
  id: string;
  /** Mês de competência "AAAA-MM" (visão mensal/histórica). */
  month: string;
  /** Categoria (obrigatória) — id na taxonomia de categorias de receita. */
  categoryId: string;
  /** Detalhe livre do item (opcional). */
  name: string;
  currency: Currency;
  amount: number; // valor no mês
  /** Fixo/recorrente: entra sozinho nos meses seguintes (salário, aluguel recebido…). */
  recurring?: boolean;
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

/** Provento recebido (dividendo, JCP, rendimento de FII…) — renda passiva dos investimentos. */
export interface Dividend {
  id: string;
  /** Mês do recebimento, "AAAA-MM". */
  month: string;
  /** Fonte: ticker ou nome do ativo (ex.: "BBAS3"). */
  source: string;
  currency: Currency;
  /** Valor recebido (> 0). */
  amount: number;
}

/**
 * Configuração da métrica Liberdade. NADA é fixo: tudo aqui é editável pelo usuário (defaults
 * só como ponto de partida). A taxa de retirada e as premissas (aporte/retorno/inflação) vivem
 * no store da Projeção e são reusadas — não se duplicam aqui.
 */
export interface LiberdadeConfig {
  /** Quais CLASSES de ativo contam como patrimônio elegível (classId → conta?). Ausente = conta. */
  eligibleClasses?: Record<string, boolean>;
  /** Janela (meses) da média móvel do custo de vida ATUAL (do orçamento). Ausente = default. */
  costMonths?: number;
  /** Custo de vida MENSAL alvo na independência (moeda principal). Ausente/≤0 = usa o do
   *  orçamento. Permite planejar pra um custo futuro diferente do de hoje (ex.: sair de casa). */
  targetMonthlyCost?: number;
  /** Meses de custo que definem a reserva de emergência "completa". Ausente = default. */
  reserveMonths?: number;
  /** Marcos de patrimônio (valores na moeda principal) — limiares editáveis. */
  milestones?: number[];
  /** Saldo mínimo (moeda principal) p/ um mês contar no streak de constância (default 0). */
  streakMinBalance?: number;
  /** Categorias de receita que contam como renda passiva EXTERNA (abatem o custo). Default: ["aluguel"]. */
  passiveCategories?: string[];
}

/** Saúde financeira: pesos por dimensão + limiares editáveis (defaults só ponto de partida). */
export interface HealthConfig {
  /** Peso por dimensão (savings/diversification/reserve/debt/goals → peso). */
  weights?: Record<string, number>;
  /** Taxa de poupança alvo (%). */
  savingsTarget?: number;
  /** Dívida/ativos (%) onde o score de dívida zera. */
  maxDebtRatio?: number;
}

/** Configurações sincronizadas (singleton). */
export interface AppSettings {
  id: string;
  /** Alvo de alocação por classe (id da classe → % inteiro), p/ rebalanceamento. */
  allocationTargets: Record<string, number>;
  /** Moeda PRINCIPAL do usuário — fonte da verdade durável e sincronizada (cifrada).
   *  Espelhada no useUI p/ boot instantâneo; ausente = nunca escolhida (cai no default). */
  baseCurrency?: Currency;
  /** Configuração da métrica Liberdade (E2EE, multi-dispositivo). */
  liberdade?: LiberdadeConfig;
  /** Configuração do score de saúde financeira. */
  health?: HealthConfig;
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
