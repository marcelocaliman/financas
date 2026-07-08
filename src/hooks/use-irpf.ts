import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { TaxReturn, TaxItem } from "@/domain/irpf";

/** Todos os cabeçalhos anuais do Organizador de IRPF, reativos. `null` enquanto carrega. */
export function useTaxReturns(): TaxReturn[] | null {
  const data = useLiveQuery(() => repository.listTaxReturns());
  return data ?? null;
}

/** Itens (Bens/Dívidas) de um ano-base, reativos. `null` enquanto carrega. */
export function useTaxItems(baseYear: number | null): TaxItem[] | null {
  const data = useLiveQuery(
    () => (baseYear == null ? Promise.resolve<TaxItem[]>([]) : repository.listTaxItems(baseYear)),
    [baseYear],
  );
  return data ?? null;
}
