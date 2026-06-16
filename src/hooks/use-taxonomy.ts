import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { DEFAULT_TAXONOMY, type Taxonomy } from "@/domain/taxonomy";

/**
 * Taxonomia editável, reativa. Cai no DEFAULT_TAXONOMY enquanto carrega ou quando
 * o usuário nunca editou (assim os dropdowns já vêm ricos num app zerado). Quando
 * o usuário edita no Config, a versão persistida passa a valer.
 */
export function useTaxonomy(): Taxonomy {
  const tax = useLiveQuery(() => repository.getTaxonomy());
  return tax ?? DEFAULT_TAXONOMY;
}
