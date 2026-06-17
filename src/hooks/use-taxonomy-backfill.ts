import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";
import { CLASS, DEFAULT_TAXONOMY } from "@/domain/taxonomy";

/**
 * Backfill ÚNICO por dispositivo: garante a classe "Bens" (nova) nas taxonomias já
 * existentes — a `useTaxonomy` mescla por CHAVE, então um `assetClasses` salvo antes
 * desta classe não a herdaria sozinho. Roda uma vez (flag em localStorage) e respeita
 * o usuário: se ele apagar "Bens" depois, NÃO volta (a flag já está marcada).
 */
const FLAG = "tax_backfill_bens_v1";
let ran = false;

export function useTaxonomyBackfill(): void {
  const tax = useLiveQuery(() => repository.getTaxonomy());
  useEffect(() => {
    if (ran || tax === undefined) return; // undefined = ainda carregando
    if (localStorage.getItem(FLAG)) {
      ran = true;
      return;
    }
    ran = true;
    localStorage.setItem(FLAG, "1");
    // Usuário novo (sem taxonomia salva): o DEFAULT já inclui "Bens" — nada a fazer.
    if (!tax) return;
    if (tax.assetClasses?.some((c) => c.id === CLASS.bens)) return;

    const bensClass = DEFAULT_TAXONOMY.assetClasses.find((c) => c.id === CLASS.bens)!;
    const bensSubs = DEFAULT_TAXONOMY.subtypes.filter((s) => s.classId === CLASS.bens);
    const assetClasses = [...tax.assetClasses];
    const idx = assetClasses.findIndex((c) => c.id === CLASS.imoveis);
    assetClasses.splice(idx >= 0 ? idx + 1 : assetClasses.length, 0, bensClass);
    void actions.putTaxonomy({ ...tax, assetClasses, subtypes: [...(tax.subtypes ?? []), ...bensSubs] });
  }, [tax]);
}
