import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import type { Asset, Liability } from "@/domain/types";

export interface PatrimonioData {
  assets: Asset[];
  liabilities: Liability[];
}

/** Ativos + passivos, reativos (useLiveQuery). `null` enquanto carrega. */
export function usePatrimonio(): PatrimonioData | null {
  const data = useLiveQuery(async () => {
    const [assets, liabilities] = await Promise.all([
      repository.listAssets(),
      repository.listLiabilities(),
    ]);
    return { assets, liabilities };
  });

  return data ?? null;
}
