import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { Goal } from "@/domain/types";

/** Objetivos / metas, reativos. `null` enquanto carrega. */
export function useObjetivos(): Goal[] | null {
  const data = useLiveQuery(() => repository.listGoals());
  return data ?? null;
}
