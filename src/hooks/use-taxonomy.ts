import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { DEFAULT_TAXONOMY, type Taxonomy } from "@/domain/taxonomy";

/**
 * Taxonomia editável, reativa. Cai no DEFAULT_TAXONOMY enquanto carrega ou quando
 * o usuário nunca editou. MESCLA com o default por chave: taxonomias salvas antes
 * de um campo novo (ex.: categorias de orçamento) herdam o default sem quebrar.
 * Memoizada na taxonomia crua (do Dexie) pra manter referência estável.
 *
 * NOTA: categorias NOVAS (ex.: "Cartão de Crédito") entram no DEFAULT (usuário novo) e,
 * para quem já tem taxonomia salva, via BACKFILL único que RESPEITA a exclusão do usuário
 * (ver use-taxonomy-backfill.ts) — nunca injetadas aqui incondicionalmente (isso as tornaria
 * indeléveis, contra a promessa de taxonomia 100% editável).
 */
export function useTaxonomy(): Taxonomy {
  const tax = useLiveQuery(() => repository.getTaxonomy());
  return useMemo(() => {
    if (!tax) return DEFAULT_TAXONOMY;
    return {
      ...DEFAULT_TAXONOMY,
      ...tax,
      incomeCategories: tax.incomeCategories ?? DEFAULT_TAXONOMY.incomeCategories,
      expenseCategories: tax.expenseCategories ?? DEFAULT_TAXONOMY.expenseCategories,
    };
  }, [tax]);
}
