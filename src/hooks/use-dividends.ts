import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { Dividend } from "@/domain/types";

/** Proventos/dividendos recebidos, reativos. `null` enquanto carrega. */
export function useDividends(): Dividend[] | null {
  return useLiveQuery(() => repository.listDividends()) ?? null;
}
