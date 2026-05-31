import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Serviço de leitura das tabelas IRPF dinâmicas (anual e mensal).
 *
 * Substitui as constantes hardcoded em imposto.ts e carne-leao.ts. Cada
 * ano-base tem sua tabela cadastrada em ir_tax_table_annual; cálculos
 * mensais buscam em ir_tax_table_monthly com fallback pra última
 * effective_from_month <= mês requisitado.
 *
 * Se o ano solicitado não existir no banco, throw com mensagem explícita
 * pro usuário saber que precisa cadastrar.
 */

export type TaxBracket = {
  upTo: number;
  rate: number;
  deduct: number;
};

export type AnnualTaxTable = {
  year: number;
  brackets: TaxBracket[];
  simplesPct: number;
  simplesLimit: number;
  dependentDeduction: number;
  educationLimitPerPerson: number;
  /** Parcela mensal isenta de aposentadoria 65+ (anual = ×13). */
  elderlyMonthlyExemption: number;
  source: string;
  publishedAt: string | null;
  isEstimate: boolean;
  notes: string | null;
};

export type MonthlyTaxTable = {
  year: number;
  effectiveFromMonth: number;
  brackets: TaxBracket[];
  dependentDeduction: number;
  source: string;
  isEstimate: boolean;
  notes: string | null;
};

export class IRTaxTableNotFoundError extends Error {
  constructor(kind: "annual" | "monthly", year: number) {
    super(
      `Nenhuma tabela IRPF ${kind === "annual" ? "anual" : "mensal"} cadastrada ` +
        `(nem pra ${year}, nem pra rollforward). Cadastre ao menos uma em ` +
        `ir_tax_table_${kind} antes de calcular o imposto.`,
    );
    this.name = "IRTaxTableNotFoundError";
  }
}

/**
 * Projeta uma tabela anual existente pra um ano sem tabela própria, marcando
 * como ESTIMATIVA (decisão D do ROADMAP — nunca calcular calado pra ano sem
 * tabela; rollforward + is_estimate=true + aviso bem visível). Puro/testável.
 */
export function rollforwardAnnual(
  base: AnnualTaxTable,
  targetYear: number,
): AnnualTaxTable {
  const dir = targetYear > base.year ? "projetada de" : "retroagida de";
  return {
    ...base,
    year: targetYear,
    isEstimate: true,
    publishedAt: null,
    source: `Estimativa (${dir} ${base.year})`,
    notes:
      `Sem tabela oficial do IRPF para ${targetYear}. Valores ${dir} ${base.year} ` +
      `(${base.source}). Sujeito a ajuste quando a tabela oficial for publicada.`,
  };
}

/** Rollforward da tabela mensal (carnê-leão). Mesma filosofia de estimativa. */
export function rollforwardMonthly(
  base: MonthlyTaxTable,
  targetYear: number,
): MonthlyTaxTable {
  const dir = targetYear > base.year ? "projetada de" : "retroagida de";
  return {
    ...base,
    year: targetYear,
    isEstimate: true,
    source: `Estimativa (${dir} ${base.year})`,
    notes: `Sem tabela mensal oficial para ${targetYear}; valores ${dir} ${base.year}.`,
  };
}

type RawAnnualRow = {
  year: number;
  brackets: TaxBracket[];
  simples_pct: number;
  simples_limit: number;
  dependent_deduction: number;
  education_limit_per_person: number;
  elderly_monthly_exemption: number;
  source: string;
  published_at: string | null;
  is_estimate: boolean;
  notes: string | null;
};

const ANNUAL_COLS =
  "year, brackets, simples_pct, simples_limit, dependent_deduction, education_limit_per_person, elderly_monthly_exemption, source, published_at, is_estimate, notes";

function rawToAnnual(d: RawAnnualRow): AnnualTaxTable {
  return {
    year: d.year,
    brackets: parseBrackets(d.brackets, "annual", d.year),
    simplesPct: Number(d.simples_pct),
    simplesLimit: Number(d.simples_limit),
    dependentDeduction: Number(d.dependent_deduction),
    educationLimitPerPerson: Number(d.education_limit_per_person),
    elderlyMonthlyExemption: Number(d.elderly_monthly_exemption ?? 1903.98),
    source: d.source,
    publishedAt: d.published_at,
    isEstimate: d.is_estimate,
    notes: d.notes,
  };
}

/**
 * Busca a tabela anual do ano-base. Se o ano exato não existir, faz ROLLFORWARD
 * da tabela mais próxima (preferindo a mais recente <= ano; senão a mais antiga
 * >= ano), marcando como estimativa — nunca lança por "ano sem tabela", só
 * lança se NÃO houver nenhuma tabela cadastrada. Cacheado por request.
 */
export const getAnnualTaxTable = cache(
  async (year: number): Promise<AnnualTaxTable> => {
    const supabase = await createClient();
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: number) => {
            maybeSingle: () => Promise<{ data: RawAnnualRow | null }>;
          };
          lte: (c: string, v: number) => {
            order: (c: string, o: object) => {
              limit: (n: number) => { maybeSingle: () => Promise<{ data: RawAnnualRow | null }> };
            };
          };
          gte: (c: string, v: number) => {
            order: (c: string, o: object) => {
              limit: (n: number) => { maybeSingle: () => Promise<{ data: RawAnnualRow | null }> };
            };
          };
        };
      };
    };

    // 1) Ano exato.
    const exact = await db.from("ir_tax_table_annual").select(ANNUAL_COLS).eq("year", year).maybeSingle();
    if (exact.data) return rawToAnnual(exact.data);

    // 2) Rollforward: tabela mais recente com ano <= solicitado.
    const below = await db
      .from("ir_tax_table_annual")
      .select(ANNUAL_COLS)
      .lte("year", year)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (below.data) return rollforwardAnnual(rawToAnnual(below.data), year);

    // 3) Retroação: tabela mais antiga com ano >= solicitado.
    const above = await db
      .from("ir_tax_table_annual")
      .select(ANNUAL_COLS)
      .gte("year", year)
      .order("year", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (above.data) return rollforwardAnnual(rawToAnnual(above.data), year);

    throw new IRTaxTableNotFoundError("annual", year);
  },
);

/**
 * JSONB do Postgres geralmente chega desserializado pelo client Supabase,
 * mas dependendo da versão/cast pode vir como string. Garantimos array
 * válido com tipos numéricos.
 */
function parseBrackets(
  raw: unknown,
  kind: "annual" | "monthly",
  year: number,
): TaxBracket[] {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      `Tabela IRPF ${kind} do ano ${year}: brackets vazio ou malformado. ` +
        `Verifique ir_tax_table_${kind} no banco.`,
    );
  }
  return parsed.map((b: { upTo: number | string; rate: number | string; deduct: number | string }) => ({
    upTo: Number(b.upTo),
    rate: Number(b.rate),
    deduct: Number(b.deduct),
  }));
}

type RawMonthlyRow = {
  year: number;
  effective_from_month: number;
  brackets: TaxBracket[];
  dependent_deduction: number;
  source: string;
  is_estimate: boolean;
  notes: string | null;
};

const MONTHLY_COLS =
  "year, effective_from_month, brackets, dependent_deduction, source, is_estimate, notes";

function rawToMonthly(d: RawMonthlyRow): MonthlyTaxTable {
  return {
    year: d.year,
    effectiveFromMonth: d.effective_from_month,
    brackets: parseBrackets(d.brackets, "monthly", d.year),
    dependentDeduction: Number(d.dependent_deduction),
    source: d.source,
    isEstimate: d.is_estimate,
    notes: d.notes,
  };
}

/**
 * Busca a tabela mensal vigente em (year, month) — maior effective_from_month
 * <= month do ano. Se o ANO não tiver tabela, faz rollforward do ano mais
 * próximo (estimativa). Só lança se não houver nenhuma tabela mensal.
 */
export const getMonthlyTaxTable = cache(
  async (year: number, month: number): Promise<MonthlyTaxTable> => {
    const supabase = await createClient();
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: number) => {
            lte: (c: string, v: number) => {
              order: (c: string, o: object) => {
                limit: (n: number) => { maybeSingle: () => Promise<{ data: RawMonthlyRow | null }> };
              };
            };
          };
          lte: (c: string, v: number) => {
            order: (c: string, o: object) => {
              limit: (n: number) => { maybeSingle: () => Promise<{ data: RawMonthlyRow | null }> };
            };
          };
          gte: (c: string, v: number) => {
            order: (c: string, o: object) => {
              limit: (n: number) => { maybeSingle: () => Promise<{ data: RawMonthlyRow | null }> };
            };
          };
        };
      };
    };

    // 1) Ano exato — tabela vigente no mês.
    const exact = await db
      .from("ir_tax_table_monthly")
      .select(MONTHLY_COLS)
      .eq("year", year)
      .lte("effective_from_month", month)
      .order("effective_from_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exact.data) return rawToMonthly(exact.data);

    // 2) Rollforward: ano <= solicitado (pega a competência mais recente dele).
    const below = await db
      .from("ir_tax_table_monthly")
      .select(MONTHLY_COLS)
      .lte("year", year)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (below.data) return rollforwardMonthly(rawToMonthly(below.data), year);

    // 3) Retroação: ano >= solicitado.
    const above = await db
      .from("ir_tax_table_monthly")
      .select(MONTHLY_COLS)
      .gte("year", year)
      .order("year", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (above.data) return rollforwardMonthly(rawToMonthly(above.data), year);

    throw new IRTaxTableNotFoundError("monthly", year);
  },
);

/**
 * Aplica a tabela progressiva sobre uma base de cálculo.
 * Genérico — funciona tanto pra anual quanto mensal.
 *
 * Throw se brackets vazio/inválido — evita o silent failure de retornar 0
 * (que escondeu o bug "imposto = R$ 0,00 com base R$ 28k").
 */
export function calcProgressiveTax(base: number, brackets: TaxBracket[]): number {
  if (!Array.isArray(brackets) || brackets.length === 0) {
    throw new Error(
      "calcProgressiveTax recebeu brackets vazio ou inválido. " +
        "Verifique se a tabela do ano correto está cadastrada em ir_tax_table_annual.",
    );
  }
  for (const b of brackets) {
    if (base <= b.upTo) {
      return Math.max(0, base * b.rate - b.deduct);
    }
  }
  // Base maior que upTo da última faixa não deveria acontecer (sempre tem
  // faixa-teto com upTo ~ Infinity), mas defendemos a degenerada.
  const last = brackets[brackets.length - 1];
  return Math.max(0, base * last.rate - last.deduct);
}

/**
 * Lista todas as tabelas anuais disponíveis. Útil pra UI de status/admin.
 */
export const listAnnualTaxTables = cache(async (): Promise<AnnualTaxTable[]> => {
  const supabase = await createClient();
  const { data } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          order: (c: string, o: object) => Promise<{ data: RawAnnualRow[] | null }>;
        };
      };
    }
  )
    .from("ir_tax_table_annual")
    .select(ANNUAL_COLS)
    .order("year", { ascending: false });

  return (data ?? []).map(rawToAnnual);
});
