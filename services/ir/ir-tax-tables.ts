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
      `Tabela IRPF ${kind === "annual" ? "anual" : "mensal"} do ano ${year} ` +
        `não está cadastrada. Adicione um INSERT em ir_tax_table_${kind} ` +
        `pra esse ano-base antes de calcular o imposto.`,
    );
    this.name = "IRTaxTableNotFoundError";
  }
}

/**
 * Busca a tabela anual do ano-base solicitado. Throw se não existir.
 * Cacheado por request (React `cache()`).
 */
export const getAnnualTaxTable = cache(
  async (year: number): Promise<AnnualTaxTable> => {
    const supabase = await createClient();
    // Cast: tabela ir_tax_table_annual criada via migration 20260527040000
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (
              c: string,
              v: number,
            ) => {
              maybeSingle: () => Promise<{
                data: {
                  year: number;
                  brackets: TaxBracket[];
                  simples_pct: number;
                  simples_limit: number;
                  dependent_deduction: number;
                  education_limit_per_person: number;
                  source: string;
                  published_at: string | null;
                  is_estimate: boolean;
                  notes: string | null;
                } | null;
              }>;
            };
          };
        };
      }
    )
      .from("ir_tax_table_annual")
      .select(
        "year, brackets, simples_pct, simples_limit, dependent_deduction, education_limit_per_person, source, published_at, is_estimate, notes",
      )
      .eq("year", year)
      .maybeSingle();

    if (!data) throw new IRTaxTableNotFoundError("annual", year);

    return {
      year: data.year,
      brackets: parseBrackets(data.brackets, "annual", year),
      simplesPct: Number(data.simples_pct),
      simplesLimit: Number(data.simples_limit),
      dependentDeduction: Number(data.dependent_deduction),
      educationLimitPerPerson: Number(data.education_limit_per_person),
      source: data.source,
      publishedAt: data.published_at,
      isEstimate: data.is_estimate,
      notes: data.notes,
    };
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

/**
 * Busca a tabela mensal vigente em (year, month). Retorna a tabela com
 * maior effective_from_month <= month do mesmo ano. Throw se não existir.
 * Cacheado por (year, month).
 */
export const getMonthlyTaxTable = cache(
  async (year: number, month: number): Promise<MonthlyTaxTable> => {
    const supabase = await createClient();
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (
              c: string,
              v: number,
            ) => {
              lte: (
                c: string,
                v: number,
              ) => {
                order: (
                  c: string,
                  o: object,
                ) => {
                  limit: (n: number) => {
                    maybeSingle: () => Promise<{
                      data: {
                        year: number;
                        effective_from_month: number;
                        brackets: TaxBracket[];
                        dependent_deduction: number;
                        source: string;
                        is_estimate: boolean;
                        notes: string | null;
                      } | null;
                    }>;
                  };
                };
              };
            };
          };
        };
      }
    )
      .from("ir_tax_table_monthly")
      .select(
        "year, effective_from_month, brackets, dependent_deduction, source, is_estimate, notes",
      )
      .eq("year", year)
      .lte("effective_from_month", month)
      .order("effective_from_month", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) throw new IRTaxTableNotFoundError("monthly", year);

    return {
      year: data.year,
      effectiveFromMonth: data.effective_from_month,
      brackets: parseBrackets(data.brackets, "monthly", year),
      dependentDeduction: Number(data.dependent_deduction),
      source: data.source,
      isEstimate: data.is_estimate,
      notes: data.notes,
    };
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
          order: (c: string, o: object) => Promise<{
            data: Array<{
              year: number;
              brackets: TaxBracket[];
              simples_pct: number;
              simples_limit: number;
              dependent_deduction: number;
              education_limit_per_person: number;
              source: string;
              published_at: string | null;
              is_estimate: boolean;
              notes: string | null;
            }> | null;
          }>;
        };
      };
    }
  )
    .from("ir_tax_table_annual")
    .select(
      "year, brackets, simples_pct, simples_limit, dependent_deduction, education_limit_per_person, source, published_at, is_estimate, notes",
    )
    .order("year", { ascending: false });

  return (data ?? []).map((d) => ({
    year: d.year,
    brackets: parseBrackets(d.brackets, "annual", d.year),
    simplesPct: Number(d.simples_pct),
    simplesLimit: Number(d.simples_limit),
    dependentDeduction: Number(d.dependent_deduction),
    educationLimitPerPerson: Number(d.education_limit_per_person),
    source: d.source,
    publishedAt: d.published_at,
    isEstimate: d.is_estimate,
    notes: d.notes,
  }));
});
