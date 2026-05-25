/**
 * Parser OFX (Open Financial Exchange) — formato padrão exportado por bancos
 * brasileiros (Itaú, Bradesco, Santander, BB, Caixa, Nubank, Inter).
 *
 * Suporta OFX 1.x (SGML) e OFX 2.x (XML). Extrai apenas STMTTRN (statement
 * transactions) com data, valor, tipo e descrição. Ignora outros blocos.
 *
 * Não é parser completo OFX — só o suficiente pra cobrir extratos de conta
 * corrente brasileiros.
 */

export type OfxTransaction = {
  date: string; // ISO YYYY-MM-DD
  description: string;
  amount: number; // positivo = crédito (entrada), negativo = débito (saída)
  type: "CREDIT" | "DEBIT" | "OTHER";
  fitId?: string; // ID único da transação no banco (pra dedup)
};

export type OfxParseResult = {
  bankId?: string;
  accountId?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  transactions: OfxTransaction[];
};

/**
 * Detecta se é OFX 2.x (XML) ou 1.x (SGML).
 */
function isXmlFormat(content: string): boolean {
  const trimmed = content.trim().slice(0, 200);
  return trimmed.includes("<?xml") || trimmed.includes("<?OFX") || /<OFX>/.test(trimmed);
}

/**
 * Extrai conteúdo de uma tag SGML/XML. Tolera tags não fechadas (SGML).
 * Retorna a primeira ocorrência.
 */
function extractTag(content: string, tag: string): string | null {
  // XML: <TAG>valor</TAG>
  const xmlRe = new RegExp(`<${tag}>([^<]*?)</${tag}>`, "i");
  const xmlMatch = content.match(xmlRe);
  if (xmlMatch) return xmlMatch[1].trim();
  // SGML: <TAG>valor (até nova linha ou próxima tag)
  const sgmlRe = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const sgmlMatch = content.match(sgmlRe);
  if (sgmlMatch) return sgmlMatch[1].trim();
  return null;
}

/**
 * Parse de data OFX: YYYYMMDD[HHMMSS][.XXX][TZ]
 * Ex: "20260514120000[-3:BRT]" → "2026-05-14"
 */
function parseOfxDate(raw: string): string {
  const clean = raw.trim();
  if (clean.length < 8) return "";
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  return `${y}-${m}-${d}`;
}

/**
 * Parse principal: aceita string com conteúdo OFX (qualquer versão).
 */
export function parseOfx(content: string): OfxParseResult {
  const isXml = isXmlFormat(content);

  // No SGML, o cabeçalho fica antes do <OFX>. Pega só o body.
  let body = content;
  const ofxStart = body.toUpperCase().indexOf("<OFX>");
  if (ofxStart >= 0) {
    body = body.slice(ofxStart);
  }

  const bankId = extractTag(body, "BANKID") ?? undefined;
  const accountId = extractTag(body, "ACCTID") ?? undefined;
  const currency = extractTag(body, "CURDEF") ?? "BRL";
  const startDate = parseOfxDate(extractTag(body, "DTSTART") ?? "") || undefined;
  const endDate = parseOfxDate(extractTag(body, "DTEND") ?? "") || undefined;

  // Extrai cada bloco STMTTRN (statement transaction)
  const transactions: OfxTransaction[] = [];
  const stmtTrnRe = isXml
    ? /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
    : /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTTRNRS>)/gi;

  let match: RegExpExecArray | null;
  while ((match = stmtTrnRe.exec(body)) !== null) {
    const block = match[1];
    const trnType = (extractTag(block, "TRNTYPE") ?? "OTHER").toUpperCase();
    const dtPosted = parseOfxDate(extractTag(block, "DTPOSTED") ?? "");
    const trnAmt = parseFloat(extractTag(block, "TRNAMT") ?? "0");
    const name = extractTag(block, "NAME") ?? "";
    const memo = extractTag(block, "MEMO") ?? "";
    const fitId = extractTag(block, "FITID") ?? undefined;
    if (!dtPosted || isNaN(trnAmt)) continue;

    transactions.push({
      date: dtPosted,
      description: [name, memo].filter(Boolean).join(" · ") || "Transação",
      amount: trnAmt,
      type:
        trnType === "CREDIT" || trnAmt > 0
          ? "CREDIT"
          : trnType === "DEBIT" || trnAmt < 0
            ? "DEBIT"
            : "OTHER",
      fitId,
    });
  }

  return {
    bankId,
    accountId,
    currency,
    startDate,
    endDate,
    transactions: transactions.sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

/**
 * Converte transações OFX pro formato ImportRow do CSV importer existente.
 * Reusa pipeline de validação/inserção sem duplicar lógica.
 */
export function ofxToImportRows(
  ofxResult: OfxParseResult,
  accountName: string,
): Array<{
  date: string;
  description: string;
  amount: number;
  currency: string;
  kind: "income" | "expense";
  accountName: string;
}> {
  return ofxResult.transactions
    .filter((t) => t.type !== "OTHER" || t.amount !== 0)
    .map((t) => ({
      date: t.date,
      description: t.description,
      amount: Math.abs(t.amount),
      currency: ofxResult.currency ?? "BRL",
      kind: t.amount >= 0 ? "income" : "expense",
      accountName,
    }));
}
