/**
 * Parser de entrada rápida — transforma um texto solto em campos de transação.
 *
 *   "30 mercado"          → { amount: 30,   description: "mercado", kind: "expense" }
 *   "1.234,56 aluguel"    → { amount: 1234.56, description: "aluguel" }
 *   "+5000 salário"       → { amount: 5000, description: "salário", kind: "income" }
 *   "uber 27,90"          → { amount: 27.9,  description: "uber" }
 *
 * É a base do "modo rápido": o usuário digita uma linha, a gente preenche o
 * formulário (valor + descrição + categoria sugerida) e ele só confirma.
 *
 * Função PURA e testável — não toca em React, rede ou Supabase. A categoria é
 * sugerida reaproveitando as regras de `auto-categorize` (suggestCategory), com
 * fallback de match pelo NOME da categoria.
 */

import type { TransactionKind } from "@/types/database";
import { suggestCategory } from "./auto-categorize";

export interface QuickEntryCategory {
  id: string;
  name: string;
  kind: TransactionKind;
  rules?: unknown; // jsonb de regras (opcional)
}

export interface ParsedQuickEntry {
  /** Valor em reais (não centavos). null se nenhum número foi reconhecido. */
  amount: number | null;
  /** Texto restante depois de tirar o valor/sinal. Pode ser "". */
  description: string;
  kind: "expense" | "income";
  /** true quando o kind veio de sinal explícito (+/-) no texto. */
  kindExplicit: boolean;
  /** Categoria sugerida (id) — null se nada casou. */
  categoryId: string | null;
  /** O termo que casou (nome da categoria ou regra) — pra UI mostrar "≈ Mercado". */
  categoryMatch: string | null;
}

/**
 * Converte um token numérico em pt-BR (ou US) pra number.
 *   "1.234,56" → 1234.56   (ponto=milhar, vírgula=decimal)
 *   "1234,56"  → 1234.56
 *   "1234.56"  → 1234.56   (ponto decimal isolado, 1-2 casas)
 *   "1.234"    → 1234      (ponto de milhar, 3 casas)
 *   "30"       → 30
 */
function parseAmountToken(token: string): number | null {
  const hasDot = token.includes(".");
  const hasComma = token.includes(",");

  let normalized: string;
  if (hasDot && hasComma) {
    // Formato BR completo: ponto é milhar, vírgula é decimal.
    normalized = token.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Só vírgula → decimal.
    normalized = token.replace(",", ".");
  } else if (hasDot) {
    const afterDot = token.slice(token.lastIndexOf(".") + 1);
    if (afterDot.length === 3) {
      // "1.234" → milhar.
      normalized = token.replace(/\./g, "");
    } else {
      // "1234.56" → decimal US.
      normalized = token;
    }
  } else {
    normalized = token;
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Casa o primeiro número da string (com R$, milhar e decimal opcionais).
const AMOUNT_RE = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;

// Palavras "ruído" que sobram depois de extrair o valor e não viram descrição.
const NOISE_WORDS = new Set(["r$", "rs", "reais", "real", "de", "no", "na", "do", "da", "em"]);

function cleanDescription(raw: string): string {
  return raw
    .split(/\s+/)
    .filter((w) => w.length > 0 && !NOISE_WORDS.has(w.toLowerCase()))
    .join(" ")
    .trim();
}

export function parseQuickEntry(
  input: string,
  categories: QuickEntryCategory[] = [],
  /** Kind a assumir quando NÃO há sinal explícito (default "expense"). */
  kindHint: "expense" | "income" = "expense",
): ParsedQuickEntry {
  const trimmed = input.trim();

  // Sinal explícito de receita/despesa no começo: "+5000", "-30".
  let kind: "expense" | "income" = kindHint;
  let kindExplicit = false;
  let rest = trimmed;
  if (rest.startsWith("+")) {
    kind = "income";
    kindExplicit = true;
    rest = rest.slice(1).trim();
  } else if (rest.startsWith("-")) {
    kind = "expense";
    kindExplicit = true;
    rest = rest.slice(1).trim();
  }

  // Extrai o primeiro valor monetário.
  let amount: number | null = null;
  const match = rest.match(AMOUNT_RE);
  if (match) {
    amount = parseAmountToken(match[1]);
    // Remove só a ocorrência casada (preserva o resto do texto).
    rest = (rest.slice(0, match.index) + rest.slice((match.index ?? 0) + match[0].length)).trim();
  }

  const description = cleanDescription(rest);

  // Sugere categoria: 1) regras de auto-categorize; 2) nome da categoria como
  // substring da descrição (ex.: descrição "mercado" casa categoria "Mercado").
  let categoryId: string | null = null;
  let categoryMatch: string | null = null;

  if (description) {
    const rulable = categories.map((c) => ({ id: c.id, kind: c.kind, rules: c.rules ?? [] }));
    const byRule = suggestCategory(description, kind, rulable);
    if (byRule) {
      categoryId = byRule.categoryId;
      categoryMatch = byRule.matched;
    } else {
      const descLower = description.toLowerCase();
      const byName = categories.find(
        (c) => c.kind === kind && c.name.length >= 3 && descLower.includes(c.name.toLowerCase()),
      );
      if (byName) {
        categoryId = byName.id;
        categoryMatch = byName.name;
      }
    }
  }

  return { amount, description, kind, kindExplicit, categoryId, categoryMatch };
}
