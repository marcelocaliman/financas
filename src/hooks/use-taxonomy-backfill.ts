import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "@/data/dexie-repository";
import { actions } from "@/data/actions";
import { CLASS, DEFAULT_TAXONOMY, EXPENSE_CARD, EXPENSE_OTHER, type Taxonomy } from "@/domain/taxonomy";

/**
 * Backfills ÚNICOS por dispositivo: garantem defaults NOVOS nas taxonomias já existentes —
 * a `useTaxonomy` mescla por CHAVE, então uma lista salva antes de um item novo não o herdaria
 * sozinha. Cada backfill roda UMA vez (flag em localStorage) e RESPEITA o usuário: se ele apagar
 * o item depois, NÃO volta (a flag já está marcada). Nunca injetar em `useTaxonomy` (tornaria o
 * item indelével — contra a promessa de taxonomia 100% editável).
 */
const BENS_FLAG = "tax_backfill_bens_v1";
const CARD_FLAG = "tax_backfill_cartao_v1";
const RFINTL_FLAG = "tax_backfill_rf_intl_v1";
/** Sub-tipos de renda fixa INTERNACIONAL (novos) — paridade com os detalhados do Brasil. */
const RF_INTL_IDS = ["renda-fixa-16", "renda-fixa-17"];
let bensRan = false;
let cardRan = false;
let rfIntlRan = false;

export function useTaxonomyBackfill(): void {
  const tax = useLiveQuery(() => repository.getTaxonomy());
  useEffect(() => {
    if (tax === undefined) return; // undefined = ainda carregando
    // No máximo UM write por passe: se um backfill escreveu, espera o `tax` atualizar (useLiveQuery)
    // antes de rodar o próximo — assim o segundo write parte do estado já com o primeiro (sem clobber).
    if (backfillBens(tax)) return;
    if (backfillCard(tax)) return;
    backfillRfIntl(tax);
  }, [tax]);
}

/** Garante a classe "Bens" (nova) em `assetClasses`. Retorna true se escreveu. */
function backfillBens(tax: Taxonomy | null): boolean {
  if (bensRan) return false;
  if (localStorage.getItem(BENS_FLAG)) {
    bensRan = true;
    return false;
  }
  bensRan = true;
  localStorage.setItem(BENS_FLAG, "1");
  if (!tax) return false; // usuário novo: o DEFAULT já inclui "Bens"
  if (tax.assetClasses?.some((c) => c.id === CLASS.bens)) return false;

  const bensClass = DEFAULT_TAXONOMY.assetClasses.find((c) => c.id === CLASS.bens)!;
  const bensSubs = DEFAULT_TAXONOMY.subtypes.filter((s) => s.classId === CLASS.bens);
  const assetClasses = [...tax.assetClasses];
  const idx = assetClasses.findIndex((c) => c.id === CLASS.imoveis);
  assetClasses.splice(idx >= 0 ? idx + 1 : assetClasses.length, 0, bensClass);
  void actions.putTaxonomy({ ...tax, assetClasses, subtypes: [...(tax.subtypes ?? []), ...bensSubs] });
  return true;
}

/** Garante a categoria de gasto "Cartão de Crédito" (nova) em `expenseCategories`. True se escreveu. */
function backfillCard(tax: Taxonomy | null): boolean {
  if (cardRan) return false;
  if (localStorage.getItem(CARD_FLAG)) {
    cardRan = true;
    return false;
  }
  cardRan = true;
  localStorage.setItem(CARD_FLAG, "1");
  if (!tax) return false; // usuário novo: o DEFAULT já inclui "Cartão de Crédito"
  if (tax.expenseCategories?.some((c) => c.id === EXPENSE_CARD)) return false;

  const card = DEFAULT_TAXONOMY.expenseCategories.find((c) => c.id === EXPENSE_CARD)!;
  const cats = [...(tax.expenseCategories ?? DEFAULT_TAXONOMY.expenseCategories)];
  const otherIdx = cats.findIndex((c) => c.id === EXPENSE_OTHER);
  cats.splice(otherIdx >= 0 ? otherIdx : cats.length, 0, card); // antes de "Outros" (ou no fim)
  void actions.putTaxonomy({ ...tax, expenseCategories: cats });
  return true;
}

/** Garante os sub-tipos de renda fixa INTERNACIONAL (novos) em `subtypes`. True se escreveu. */
function backfillRfIntl(tax: Taxonomy | null): boolean {
  if (rfIntlRan) return false;
  if (localStorage.getItem(RFINTL_FLAG)) {
    rfIntlRan = true;
    return false;
  }
  rfIntlRan = true;
  localStorage.setItem(RFINTL_FLAG, "1");
  if (!tax) return false; // usuário novo: o DEFAULT já inclui
  const have = new Set((tax.subtypes ?? []).map((s) => s.id));
  const missing = DEFAULT_TAXONOMY.subtypes.filter((s) => RF_INTL_IDS.includes(s.id) && !have.has(s.id));
  if (missing.length === 0) return false;
  void actions.putTaxonomy({ ...tax, subtypes: [...(tax.subtypes ?? []), ...missing] });
  return true;
}
