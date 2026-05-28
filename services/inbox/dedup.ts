import "server-only";

/**
 * Helper genérico de dedup por contagem.
 *
 * Problema: ao importar uma fatura, queremos:
 *  - Re-upload do mesmo arquivo → NÃO duplicar nada
 *  - Re-upload com 3 itens novos → inserir só os 3
 *  - Apply parcial que falhou → retomar sem duplicar
 *  - 2 cafés iguais legítimos no mesmo dia → inserir AMBOS
 *
 * Solução: dedup por (chave estável) com CONTAGEM. Pra cada chave única
 * no batch, conta quantas ocorrências há. Pra cada chave, conta quantas
 * já existem no DB. Insere `max(0, batch_count - db_count)` novas.
 *
 * Exemplo:
 *  - Batch: [coffee R$5, coffee R$5] → key "coffee-5-2026-05-01" aparece 2x
 *  - DB: zero matches → insere 2 ✓
 *  - Re-upload: batch=2, db=2 → insere 0 ✓
 *  - Manual cadastrou 1 café antes: batch=2, db=1 → insere 1 ✓
 */

export type DedupResult<T> = {
  /** Itens a serem efetivamente inseridos */
  toInsert: T[];
  /** Quantos foram pulados por já existir */
  skippedCount: number;
};

/**
 * Devolve `{toInsert, skippedCount}` dado:
 * - itens a inserir (com chaves)
 * - chaves já presentes no DB (com contagem)
 *
 * Tudo client-side, sem queries — caller faz a busca antes.
 */
export function applyDedupCounts<T>(
  items: Array<{ item: T; key: string }>,
  existingCountsByKey: Map<string, number>,
): DedupResult<T> {
  // Conta ocorrências no batch
  const batchCounts = new Map<string, number>();
  for (const { key } of items) {
    batchCounts.set(key, (batchCounts.get(key) ?? 0) + 1);
  }

  // Pra cada chave, calcula quantas inserir
  const toInsertByKey = new Map<string, number>();
  for (const [key, batchCount] of batchCounts) {
    const dbCount = existingCountsByKey.get(key) ?? 0;
    const newCount = Math.max(0, batchCount - dbCount);
    toInsertByKey.set(key, newCount);
  }

  // Itera o batch novamente, contabilizando até atingir o limite por chave
  const remainingByKey = new Map(toInsertByKey);
  const toInsert: T[] = [];
  for (const { item, key } of items) {
    const remaining = remainingByKey.get(key) ?? 0;
    if (remaining > 0) {
      toInsert.push(item);
      remainingByKey.set(key, remaining - 1);
    }
  }

  const skippedCount = items.length - toInsert.length;
  return { toInsert, skippedCount };
}

/**
 * Normaliza descrição pra dedup estável:
 * - Remove sufixo de parcela ("· 1/6", "· 3/4")
 * - Colapsa whitespace múltiplo
 * - Lowercase
 * - Remove acentos (NFD + remove diacritics)
 */
export function normalizeDescription(desc: string): string {
  return desc
    .replace(/\s*·\s*\d+\/\d+\s*$/g, "") // remove "· N/M" no final
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacritics
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Chave de dedup pra transações de fatura/extrato.
 * Considera (date, amount em centavos, descrição normalizada, account_id).
 */
export function transactionDedupKey(args: {
  accountId: string;
  date: string;
  amount: number;
  description: string;
}): string {
  const cents = Math.round(args.amount * 100);
  const desc = normalizeDescription(args.description);
  return `tx|${args.accountId}|${args.date}|${cents}|${desc}`;
}
