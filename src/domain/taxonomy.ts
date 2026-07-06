/**
 * Taxonomia editável (Classes, Subtipos em cascata, Regiões, Indexadores, Tipos
 * de passivo). Default rico semeado de docs/CATEGORIAS.md; TUDO editável no Config.
 * Vive como linha única (id = TAXONOMY_ID) na mesma camada local-first e sincroniza
 * cifrada junto com o resto (serialize.ts itera todas as tabelas).
 */

export interface TaxonomyItem {
  id: string;
  name: string;
}

/** Subtipo pertence a uma Classe (cascata). */
export interface SubtypeItem extends TaxonomyItem {
  classId: string;
}

export interface Taxonomy {
  id: string;
  assetClasses: TaxonomyItem[];
  subtypes: SubtypeItem[];
  regions: TaxonomyItem[];
  indexers: TaxonomyItem[];
  liabilityTypes: TaxonomyItem[];
  incomeCategories: TaxonomyItem[];
  expenseCategories: TaxonomyItem[];
}

/** Categoria-padrão "Outros" de cada lado do orçamento (fallback da migração). */
export const INCOME_OTHER = "receita-outros";
export const EXPENSE_OTHER = "gasto-outros";
/** Categoria "Cartão de Crédito" — um gasto nela é uma FATURA (guarda-chuva); outros itens podem
 *  ser marcados como DENTRO dela ("Na fatura"). Ver finance/statement + a UI do Orçamento. */
export const EXPENSE_CARD = "gasto-cartao";

export const TAXONOMY_ID = "taxonomy";

/** Ids estáveis das classes default (usados na migração e no cálculo do painel). */
export const CLASS = {
  rendaFixa: "renda-fixa",
  acoes: "acoes",
  fiis: "fiis",
  multimercado: "multimercado",
  previdencia: "previdencia",
  cripto: "cripto",
  commodities: "commodities",
  caixa: "caixa",
  imoveis: "imoveis",
  bens: "bens",
  privateEquity: "private-equity",
  outros: "outros",
} as const;

/**
 * MACRO-categorias que agrupam as classes nas ABAS de Patrimônio (Renda Fixa · Renda Variável ·
 * Caixa · Bens). A CLASSE segue sendo a unidade dos cálculos (investido/alocação/composição/FIRE);
 * a macro é só o agrupamento de exibição, e o "Tipo" da linha é o SUBTYPE. Fixas em código (por ora).
 */
export const MACRO = {
  rendaFixa: "m-renda-fixa",
  rendaVariavel: "m-renda-variavel",
  caixa: "m-caixa",
  bens: "m-bens",
} as const;

export interface AssetMacro {
  id: string;
  classIds: string[];
}
export const ASSET_MACROS: AssetMacro[] = [
  { id: MACRO.rendaFixa, classIds: [CLASS.rendaFixa, CLASS.previdencia] },
  { id: MACRO.rendaVariavel, classIds: [CLASS.acoes, CLASS.fiis, CLASS.multimercado, CLASS.cripto, CLASS.commodities, CLASS.privateEquity, CLASS.outros] },
  { id: MACRO.caixa, classIds: [CLASS.caixa] },
  { id: MACRO.bens, classIds: [CLASS.imoveis, CLASS.bens] },
];

const MACRO_OF: Record<string, string> = Object.fromEntries(
  ASSET_MACROS.flatMap((m) => m.classIds.map((c) => [c, m.id])),
);
/** Macro de uma classe. Classe nova/desconhecida cai em Renda Variável (catch-all financeiro). */
export function macroOf(classId: string): string {
  return MACRO_OF[classId] ?? MACRO.rendaVariavel;
}

/**
 * Sub-tipos "principais" por classe — a lista ENXUTA e profissional mostrada no seletor de "Tipo"
 * (a taxonomia completa segue existindo e 100% editável na Config; isto só cura o que aparece no
 * seletor pra não virar um paredão de 30+ opções). Ids do default (estáveis).
 */
export const CURATED_SUBTYPES: Record<string, string[]> = {
  [CLASS.rendaFixa]: ["renda-fixa-1", "renda-fixa-3", "renda-fixa-4", "renda-fixa-9", "renda-fixa-12", "renda-fixa-14"],
  [CLASS.previdencia]: ["previdencia-1", "previdencia-2", "previdencia-4"],
  [CLASS.acoes]: ["acoes-1", "acoes-2", "acoes-4"],
  [CLASS.fiis]: ["fiis-1", "fiis-2", "fiis-4"],
  [CLASS.multimercado]: ["multimercado-1"],
  [CLASS.cripto]: ["cripto-1", "cripto-2", "cripto-3"],
  [CLASS.commodities]: ["commodities-1", "commodities-3"],
  [CLASS.privateEquity]: ["private-equity-1", "private-equity-2"],
  [CLASS.caixa]: ["caixa-1", "caixa-2", "caixa-3", "caixa-5"],
  [CLASS.imoveis]: ["imoveis-1", "imoveis-2", "imoveis-3", "imoveis-4"],
  [CLASS.bens]: ["bens-1", "bens-4", "bens-7"],
  [CLASS.outros]: ["outros-1"],
};

/**
 * Sub-tipos a MOSTRAR no seletor de Tipo de uma classe: o subconjunto curado, quando presente.
 * Fallback pra TODOS os subtipos da classe se nenhum curado casar (taxonomia customizada/apagada).
 */
export function tipoSubtypesFor(subtypes: SubtypeItem[], classId: string): SubtypeItem[] {
  const all = subtypes.filter((s) => s.classId === classId);
  const wanted = CURATED_SUBTYPES[classId];
  if (!wanted) return all;
  const curated = all.filter((s) => wanted.includes(s.id));
  return curated.length ? curated : all;
}

/** Ids estáveis dos tipos de passivo default (usados na migração). */
export const LIABILITY_TYPE = {
  financiamentoImobiliario: "financiamento-imobiliario",
  financiamentoVeiculo: "financiamento-veiculo",
  emprestimoPessoal: "emprestimo-pessoal",
  emprestimoConsignado: "emprestimo-consignado",
  cartaoCredito: "cartao-credito",
  chequeEspecial: "cheque-especial",
  creditoEstudantil: "credito-estudantil",
  parcelamento: "parcelamento",
  impostos: "impostos",
  outrasDividas: "outras-dividas",
} as const;

function subs(classId: string, names: string[]): SubtypeItem[] {
  return names.map((name, i) => ({ id: `${classId}-${i + 1}`, classId, name }));
}

export const DEFAULT_TAXONOMY: Taxonomy = {
  id: TAXONOMY_ID,
  assetClasses: [
    { id: CLASS.rendaFixa, name: "Renda Fixa" },
    { id: CLASS.acoes, name: "Ações" },
    { id: CLASS.fiis, name: "Fundos Imobiliários (FIIs/REITs)" },
    { id: CLASS.multimercado, name: "Multimercado" },
    { id: CLASS.previdencia, name: "Previdência" },
    { id: CLASS.cripto, name: "Cripto" },
    { id: CLASS.commodities, name: "Commodities / Ouro" },
    { id: CLASS.caixa, name: "Caixa e Liquidez" },
    { id: CLASS.imoveis, name: "Imóveis (físicos)" },
    { id: CLASS.bens, name: "Bens (veículos e de valor)" },
    { id: CLASS.privateEquity, name: "Private Equity / Alternativos" },
    { id: CLASS.outros, name: "Outros" },
  ],
  subtypes: [
    ...subs(CLASS.rendaFixa, [
      "Tesouro Selic (LFT)", "Tesouro Prefixado (LTN)", "Tesouro IPCA+ (NTN-B)", "CDB",
      "LCI", "LCA", "CRI", "CRA", "Debênture", "Debênture incentivada",
      "Letra de Câmbio (LC)", "Fundo de Renda Fixa", "Fundo DI", "Bond/Título internacional", "Outro",
    ]),
    ...subs(CLASS.acoes, ["Ação (BR)", "Stock (internacional)", "BDR", "ETF de ações", "Fundo de ações", "Outro"]),
    ...subs(CLASS.fiis, ["FII de tijolo", "FII de papel", "FII de fundos (FOF)", "REIT internacional", "FI-Infra", "Outro"]),
    ...subs(CLASS.multimercado, ["Fundo multimercado", "Long & short", "Macro", "Hedge fund", "Outro"]),
    ...subs(CLASS.previdencia, ["PGBL", "VGBL", "Fundo de previdência", "Plano fechado (empresa)", "Outro"]),
    ...subs(CLASS.cripto, ["Bitcoin", "Ethereum", "Altcoins", "Stablecoin", "Fundo cripto", "Outro"]),
    ...subs(CLASS.commodities, ["Ouro", "Prata", "ETF de ouro/commodities", "Fundo de commodities", "Outro"]),
    ...subs(CLASS.caixa, ["Conta corrente", "Conta poupança", "Conta internacional", "Money market", "Reserva de emergência", "Outro"]),
    ...subs(CLASS.imoveis, ["Residencial", "Comercial", "Terreno", "Imóvel de aluguel", "Outro"]),
    ...subs(CLASS.bens, ["Veículo", "Motocicleta", "Bicicleta", "Joias e relógios", "Eletrônicos", "Móveis e eletrodomésticos", "Arte e colecionáveis", "Outro"]),
    ...subs(CLASS.privateEquity, ["Private equity", "Venture capital", "Participação em empresa", "Arte/colecionáveis", "Outro"]),
    ...subs(CLASS.outros, ["Outro"]),
  ],
  regions: [
    { id: "brasil", name: "Brasil" },
    { id: "italia", name: "Itália" },
    { id: "zona-euro", name: "Zona do Euro (outros)" },
    { id: "eua", name: "Estados Unidos" },
    { id: "reino-unido", name: "Reino Unido" },
    { id: "global", name: "Global/Mundo" },
    { id: "outro", name: "Outro" },
  ],
  indexers: [
    { id: "prefixado", name: "Prefixado" },
    { id: "cdi", name: "CDI" },
    { id: "ipca", name: "IPCA" },
    { id: "selic", name: "Selic" },
  ],
  liabilityTypes: [
    { id: LIABILITY_TYPE.financiamentoImobiliario, name: "Financiamento imobiliário" },
    { id: LIABILITY_TYPE.financiamentoVeiculo, name: "Financiamento de veículo" },
    { id: LIABILITY_TYPE.emprestimoPessoal, name: "Empréstimo pessoal" },
    { id: LIABILITY_TYPE.emprestimoConsignado, name: "Empréstimo consignado" },
    { id: LIABILITY_TYPE.cartaoCredito, name: "Cartão de crédito" },
    { id: LIABILITY_TYPE.chequeEspecial, name: "Cheque especial" },
    { id: LIABILITY_TYPE.creditoEstudantil, name: "Crédito estudantil" },
    { id: LIABILITY_TYPE.parcelamento, name: "Parcelamento" },
    { id: LIABILITY_TYPE.impostos, name: "Impostos a pagar" },
    { id: LIABILITY_TYPE.outrasDividas, name: "Outras dívidas" },
  ],
  incomeCategories: [
    { id: "salario", name: "Salário" },
    { id: "freela", name: "Freela / PJ" },
    { id: "aluguel", name: "Aluguel" },
    { id: "dividendos", name: "Dividendos e juros" },
    { id: "reembolso", name: "Reembolso" },
    { id: INCOME_OTHER, name: "Outros" },
  ],
  expenseCategories: [
    { id: "moradia", name: "Moradia" },
    { id: "alimentacao", name: "Alimentação" },
    { id: "transporte", name: "Transporte" },
    { id: "saude", name: "Saúde" },
    { id: "educacao", name: "Educação" },
    { id: "lazer", name: "Lazer" },
    { id: "vestuario", name: "Vestuário" },
    { id: "servicos", name: "Serviços e assinaturas" },
    { id: "impostos-gasto", name: "Impostos e taxas" },
    { id: EXPENSE_CARD, name: "Cartão de Crédito" },
    { id: EXPENSE_OTHER, name: "Outros" },
  ],
};

/** Normaliza pra casar nomes (minúsculo, sem acento, sem espaços extras). */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Acha o id da categoria cujo nome casa com `name` (usado na migração v5). */
export function matchCategory(name: string, items: TaxonomyItem[]): string | undefined {
  const n = norm(name);
  return items.find((i) => norm(i.name) === n)?.id;
}

/** Nome de um item por id (para exibir Classe/Região/etc. em tabelas e cards). */
export function nameById(items: TaxonomyItem[], id?: string): string {
  if (!id) return "";
  return items.find((i) => i.id === id)?.name ?? "";
}

/**
 * Classes que NÃO contam como "investido" (financeiro): Caixa, Imóveis e Bens físicos.
 * Seletor ÚNICO usado no Painel e em Investimentos pra "Investido" nunca divergir entre telas.
 */
const NON_INVESTED = new Set<string>([CLASS.caixa, CLASS.imoveis, CLASS.bens]);
export function isInvestedClass(classId: string): boolean {
  return !NON_INVESTED.has(classId);
}

/**
 * Modelo "cotável" (ticker · qtd · preço médio) REATIVADO (jun/2026) para as classes negociadas
 * por UNIDADE/cota — valor = qtd × (cotação do dia, se houver; senão preço médio). As demais
 * investidas (renda fixa, fundos) seguem no modelo de VALOR (aplicado → atual → rentabilidade),
 * que é melhor pra elas. A COTAÇÃO automática é do super-admin (brapi free) e do Pro Investidor
 * quando a flag 'quotes_live' estiver ON — ver api/quote.js + use-quotes-sync.
 */
const QUOTABLE_CLASSES = new Set<string>([CLASS.acoes, CLASS.fiis, CLASS.cripto, CLASS.commodities]);
export function isQuotableClass(classId: string): boolean {
  return QUOTABLE_CLASSES.has(classId);
}

/**
 * Modo DETALHADO de ativos (ticker · quantidade · preço médio · cotação) — DESLIGADO no modelo
 * "totais por classe": a gestão é por VALOR total por ativo/classe, sem cotação automática (que
 * teria custo e licença). A UI de ativos usa este seletor no lugar de isQuotableClass; com a flag
 * OFF, todo ativo é editado como valor. Vire `DETAILED_ASSETS` pra `true` pra reativar sem mais nada.
 */
export const DETAILED_ASSETS = false;
export function isDetailedAssetClass(classId: string): boolean {
  return DETAILED_ASSETS && isQuotableClass(classId);
}

/**
 * Elegibilidade PADRÃO p/ a métrica Liberdade: por padrão NÃO contam os ativos ilíquidos que
 * não geram renda sacável — Imóveis (físicos) e Bens (veículos etc.). Tudo mais (investido +
 * Caixa) conta. É só o ponto de partida: o usuário liga/desliga cada classe no Config (ex.:
 * reincluir Imóveis quando há imóvel de aluguel).
 */
const NON_ELIGIBLE_DEFAULT = new Set<string>([CLASS.imoveis, CLASS.bens]);
export function defaultEligibleClass(classId: string): boolean {
  return !NON_ELIGIBLE_DEFAULT.has(classId);
}
