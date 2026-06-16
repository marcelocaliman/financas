import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { AppSettings } from "@/domain/types";

const EMPTY: AppSettings = { id: "settings", allocationTargets: {} };

/** Configurações sincronizadas (alvos de alocação). Cai no vazio enquanto carrega. */
export function useSettings(): AppSettings {
  const s = useLiveQuery(() => repository.getSettings());
  return s ?? EMPTY;
}
