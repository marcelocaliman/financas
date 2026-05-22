/**
 * Auto-categorização por regras armazenadas em categories.rules (jsonb).
 *
 * Cada categoria carrega um array de regras:
 *   [{ "match": "ifood", "field": "description", "weight": 1.0 }]
 *
 * Match: substring case-insensitive na descrição da transação.
 * Weight: confiança 0..1 que vai pra transactions.category_confidence.
 * Field: por enquanto só "description" — espaço pra evoluir.
 *
 * Política: a primeira categoria que casar ganha. Ordem é dada pelo sort_order
 * de categories, então o usuário pode priorizar regras especializadas antes
 * das genéricas (ex.: "iFood Restaurante X" antes de "Restaurante").
 */

import type { TransactionKind } from "@/types/database";

export type CategoryRule = {
  match: string;
  field?: "description";
  weight?: number;
};

type Rulable = {
  id: string;
  kind: TransactionKind;
  rules: unknown; // jsonb
};

export type CategorySuggestion = {
  categoryId: string;
  confidence: number;
  matched: string;
};

function asRules(raw: unknown): CategoryRule[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is CategoryRule =>
      typeof r === "object" && r !== null && typeof (r as CategoryRule).match === "string",
  );
}

export function suggestCategory(
  description: string,
  kind: TransactionKind,
  categories: Rulable[],
): CategorySuggestion | null {
  if (!description || kind === "transfer") return null;
  const desc = description.toLowerCase();

  for (const cat of categories) {
    if (cat.kind !== kind) continue;
    for (const rule of asRules(cat.rules)) {
      const needle = rule.match.toLowerCase().trim();
      if (!needle) continue;
      if (desc.includes(needle)) {
        return {
          categoryId: cat.id,
          confidence: typeof rule.weight === "number" ? rule.weight : 0.9,
          matched: rule.match,
        };
      }
    }
  }
  return null;
}

/**
 * Atualiza/insere uma regra para categoria. Retorna o novo array de rules.
 */
export function upsertRule(
  existing: unknown,
  newRule: CategoryRule,
): CategoryRule[] {
  const rules = asRules(existing);
  const idx = rules.findIndex((r) => r.match.toLowerCase() === newRule.match.toLowerCase());
  if (idx >= 0) {
    rules[idx] = { ...rules[idx], ...newRule };
  } else {
    rules.push(newRule);
  }
  return rules;
}

export function removeRule(existing: unknown, match: string): CategoryRule[] {
  return asRules(existing).filter((r) => r.match.toLowerCase() !== match.toLowerCase());
}
