import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { NetWorthSnapshot } from "@/domain/types";

/** Snapshots de patrimônio (histórico), reativos. `null` enquanto carrega. */
export function useHistorico(): NetWorthSnapshot[] | null {
  const data = useLiveQuery(() => repository.listNetWorthSnapshots());
  return data ?? null;
}
