/**
 * Aliases e normalização pra classificar rendimentos por NOME de categoria.
 *
 * Antes: dois `Set` de igualdade exata ("salário" casava, "Salario" não). Renda
 * com qualquer variação de acento/grafia escapava da classificação e era
 * descartada em silêncio. Aqui normalizamos (lowercase + remove acentos) e
 * casamos contra listas de sinônimos. Sem match → o chamador manda pra
 * `naoClassificado` (nunca descarta).
 *
 * Puro e sem deps — testável isolado.
 */

/** lowercase + remove acentos (NFD) + colapsa espaços. */
export function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/º/g, "o") // ordinal masculino (13º → 13o)
    .replace(/ª/g, "a") // ordinal feminino
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Listas já normalizadas (sem acento, lowercase).
const SALARY_ALIASES = [
  "salario",
  "salarios",
  "holerite",
  "contracheque",
  "pro-labore",
  "pro labore",
  "prolabore",
  "honorarios",
  "remuneracao",
  "vencimentos",
  "ordenado",
  "soldo",
];

// 13º salário é tributação EXCLUSIVA na fonte (cód. 01), fora da base
// progressiva — separado de SALARY_ALIASES (antes caía como tributável).
const THIRTEENTH_ALIASES = [
  "13o salario",
  "13 salario",
  "decimo terceiro",
  "decimo terceiro salario",
  "13o",
  "gratificacao natalina",
];

// JCP (Juros sobre Capital Próprio) é tributação EXCLUSIVA 15% na fonte
// (cód. 10), NÃO isento como dividendo — separado de DIVIDEND_ALIASES.
const JCP_ALIASES = [
  "jcp",
  "juros sobre capital proprio",
  "juros sobre o capital proprio",
  "juros sobre capital",
  "juros sobre o capital",
];

const APOSENTADORIA_ALIASES = [
  "aposentadoria",
  "aposentadorias",
  "pensao",
  "pensoes",
  "proventos",
  "reforma",
  "previdencia",
];

const RENT_ALIASES = [
  "aluguel",
  "alugueis",
  "aluguel recebido",
  "alugueis recebidos",
  "locacao",
  "locacoes",
  "arrendamento",
];

const DIVIDEND_ALIASES = ["dividendo", "dividendos", "lucros e dividendos"];

const DISTRIBUICAO_LUCROS_ALIASES = [
  "distribuicao de lucros",
  "distribuicao de lucro",
  "distribuicao lucros",
  "lucros distribuidos",
  "pro-labore lucros",
];

const RENDA_PASSIVA_GENERIC = ["renda passiva", "rendimentos", "rendimento"];

function matchesAny(cat: string, aliases: string[]): boolean {
  const n = normalize(cat);
  if (!n) return false;
  return aliases.some((a) => n === a || n.includes(a));
}

/** Salário, pró-labore, honorários, 13º — base progressiva tributável. */
export function isSalaryCategory(cat: string): boolean {
  return matchesAny(cat, SALARY_ALIASES);
}

/** Aposentadoria/pensão — tributável (isenção 65+ tratada à parte). */
export function isAposentadoriaCategory(cat: string): boolean {
  return matchesAny(cat, APOSENTADORIA_ALIASES);
}

/** Aluguel/locação — tributável (carnê-leão). */
export function isRentCategory(cat: string): boolean {
  return matchesAny(cat, RENT_ALIASES);
}

/** Dividendos — isento cód. 09 (até 2025; ver gate de vigência 2026). */
export function isDividendCategory(cat: string): boolean {
  return matchesAny(cat, DIVIDEND_ALIASES);
}

/** 13º salário — tributação exclusiva na fonte (cód. 01). */
export function isThirteenthCategory(cat: string): boolean {
  return matchesAny(cat, THIRTEENTH_ALIASES);
}

/** JCP — tributação exclusiva 15% na fonte (cód. 10). */
export function isJcpCategory(cat: string): boolean {
  return matchesAny(cat, JCP_ALIASES);
}

/**
 * Distribuição de lucros (categoria EXPLÍCITA) — isento cód. 09. Sinal explícito
 * que substitui a heurística frágil de description.includes("distribu").
 */
export function isDistribuicaoLucrosCategory(cat: string): boolean {
  return matchesAny(cat, DISTRIBUICAO_LUCROS_ALIASES);
}

/**
 * "Renda passiva"/"rendimentos" — bucket GENÉRICO. Não dá pra afirmar se é
 * aluguel (tributável), dividendo (isento) ou outro. Vira naoClassificado.
 */
export function isGenericPassiveCategory(cat: string): boolean {
  const n = normalize(cat);
  return RENDA_PASSIVA_GENERIC.some((a) => n === a);
}
