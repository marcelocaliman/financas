/**
 * CSV pra importar/baixar itens de uma fatura em LOTE (tudo client-side; o E2EE não muda — o
 * arquivo é lido/gerado no navegador e nada cru vai ao servidor). Módulo PURO/testável: só
 * texto ↔ registros; o mapeamento pra Expense (categoria, moeda) fica na UI, com a taxonomia.
 */

/** Separador da 1ª linha: Excel pt-BR costuma usar ";". Escolhe o mais frequente (empate → ","). */
function detectSep(text: string): "," | ";" {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  return first.split(";").length > first.split(",").length ? ";" : ",";
}

/** Quebra o CSV em matriz respeitando aspas ("" escapado, vírgula/;/quebra dentro do campo). */
function splitRows(text: string, sep: "," | ";"): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (c !== "\r") field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** Parser CSV → registros keyed pelo cabeçalho (minúsculo, sem acento perdido). BOM tolerado. */
export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "");
  const sep = detectSep(clean);
  const rows = splitRows(clean, sep);
  if (rows.length < 1) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === "") continue; // linha em branco
    const rec: Record<string, string> = {};
    header.forEach((h, j) => {
      rec[h] = (cells[j] ?? "").trim();
    });
    out.push(rec);
  }
  return out;
}

const esc = (s: string) => (/[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * Monta o CSV-modelo da fatura (com BOM p/ o Excel abrir UTF-8) a partir de `header` (rótulos das
 * colunas, localizados) + `rows` (linhas-exemplo já prontas). O parser reconhece as colunas por
 * sinônimo (PT/EN), então o rótulo pode variar sem quebrar a importação.
 */
export function statementTemplateCSV(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((r) => r.map(esc).join(","));
  return "﻿" + lines.join("\n") + "\n";
}
