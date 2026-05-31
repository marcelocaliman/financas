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
  "13o salario",
  "decimo terceiro",
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

const DIVIDEND_ALIASES = ["dividendo", "dividendos", "lucros e dividendos", "jcp"];

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

/** Dividendos/JCP — isento (ou exclusivo no caso de JCP). */
export function isDividendCategory(cat: string): boolean {
  return matchesAny(cat, DIVIDEND_ALIASES);
}

/**
 * "Renda passiva"/"rendimentos" — bucket GENÉRICO. Não dá pra afirmar se é
 * aluguel (tributável), dividendo (isento) ou outro. Vira naoClassificado.
 */
export function isGenericPassiveCategory(cat: string): boolean {
  const n = normalize(cat);
  return RENDA_PASSIVA_GENERIC.some((a) => n === a);
}
