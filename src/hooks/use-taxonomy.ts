import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { DEFAULT_TAXONOMY, type Taxonomy } from "@/domain/taxonomy";

/**
 * Taxonomia editável, reativa. Cai no DEFAULT_TAXONOMY enquanto carrega ou quando
 * o usuário nunca editou. MESCLA com o default por chave: taxonomias salvas antes
 * de um campo novo (ex.: categorias de orçamento) herdam o default sem quebrar.
 * Memoizada na taxonomia crua (do Dexie) pra manter referência estável.
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
