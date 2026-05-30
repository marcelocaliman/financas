import "server-only";

/**
 * Detecção de duplicatas no import de CSV.
 *
 * Cenário típico: usuário cadastrou uma recorrência (ex: Claude AI R$ 550
 * dia 15, paga no cartão). Quando importa a fatura do cartão depois, o CSV
 * traz a mesma cobrança ("CLAUDE.AI SUBSCRIPTION R$ 550 em 15/05"). Sem
 * dedupe, duplica.
 *
 * Estratégia: pra cada row do CSV, procura no DB tx existentes com:
 *   - mesma conta + kind
 *   - data ± 3 dias
 *   - valor ± max(R$ 1, 5%)
 *   - descrição compartilha pelo menos um keyword >= 4 chars
 *     (não-stopword)
 *
 * Se achar → pula a linha (mantém a existente como source of truth).
 *
 * False positives raros (ex: "GOOGLE ONE" vs "GOOGLE YOUTUBE" no mesmo
 * mês, mesmo valor) são quase impossíveis na prática: 2 serviços da
 * mesma marca, com mesmo valor e datas próximas. Se acontecer, usuário
 * vê no relatório de "puladas" e pode importar manualmente a linha
 * faltante.
 */

const STOPWORDS = new Set([
  "subscription",
  "pagamento",
  "compra",
  "boleto",
  "pix",
  "transferencia",
  "para",
  "com",
  "valor",
  "ltda",
  "ltd",
  "inc",
  "sa",
  "eireli",
  "service",
  "servico",
  "online",
  "comercio",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function extractKeywords(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

export function descriptionsLikelyMatch(a: string, b: string): boolean {
  const aWords = extractKeywords(a);
  const bWords = extractKeywords(b);
  if (aWords.size === 0 || bWords.size === 0) return false;
  for (const w of aWords) {
    if (bWords.has(w)) return true;
  }
  return false;
}

export function amountsLikelyMatch(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const tolerance = Math.max(1, Math.abs(a) * 0.05);
  return diff <= tolerance;
}

export function datesWithinRange(
  a: string,
  b: string,
  daysWindow = 3,
): boolean {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  const diff = Math.abs(da.getTime() - db.getTime()) / 86400000;
  return diff <= daysWindow;
}

export type ExistingTx = {
  id: string;
  account_id: string;
  kind: "income" | "expense" | "transfer";
  date: string;
  amount_account: number;
  description: string;
  recurring_rule_id: string | null;
};

export type DedupeCandidate = {
  account_id: string;
  kind: "income" | "expense" | "transfer";
  date: string;
  amount_account: number;
  description: string;
};

/**
 * Procura por uma transação existente que provavelmente é a mesma do
 * candidate. Retorna a primeira match ou null.
 *
 * `consumedIds` (opcional): ids de existing já casados por candidates
 * anteriores deste mesmo lote. Pular esses evita que duas linhas legítimas
 * iguais do CSV (ex: dois Ubers de R$25 no mesmo dia) casem AMBAS com a mesma
 * tx existente — o que faria uma transação real ser silenciosamente descartada.
 */
export function findDuplicate(
  candidate: DedupeCandidate,
  existing: ExistingTx[],
  consumedIds?: ReadonlySet<string>,
): ExistingTx | null {
  for (const tx of existing) {
    if (consumedIds?.has(tx.id)) continue;
    if (tx.account_id !== candidate.account_id) continue;
    if (tx.kind !== candidate.kind) continue;
    if (!datesWithinRange(tx.date, candidate.date)) continue;
    if (!amountsLikelyMatch(Number(tx.amount_account), candidate.amount_account)) continue;
    if (!descriptionsLikelyMatch(tx.description, candidate.description)) continue;
    return tx;
  }
  return null;
}
