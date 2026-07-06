import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { Subscription } from "@/domain/types";

/** Assinaturas recorrentes (documentação), reativas. `null` enquanto carrega. */
export function useSubscriptions(): Subscription[] | null {
  const data = useLiveQuery(() => repository.listSubscriptions());
  return data ?? null;
}
