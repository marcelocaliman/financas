/**
 * CSV utils — parser + builder leves, sem dependências.
 *
 * Suporta:
 *  - separadores `,` e `;` (auto-detect pela primeira linha)
 *  - aspas duplas com escape "" → "
 *  - linhas multilinhas dentro de aspas
 *  - BOM no início (descartado)
 *
 * Não suporta CSV exótico (literal newline sem aspas, etc.) — pra isso teria
 * que puxar uma lib (Papa Parse). Pro caso de extrato de banco basta.
 */

export type CsvRow = string[];

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[]; separator: string } {
  // remove BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // auto-detecta separador
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const sep = (firstLine.split(";").length > firstLine.split(",").length ? ";" : ",") as string;

  const all = parseAll(text, sep);
  if (all.length === 0) return { headers: [], rows: [], separator: sep };
  return { headers: all[0], rows: all.slice(1), separator: sep };
}

function parseAll(text: string, sep: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === sep) {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      // ignora linhas totalmente vazias
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  // último cell
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/**
 * Gera CSV a partir de headers + linhas. Adiciona BOM pra Excel abrir UTF-8 ok.
 */
export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return "﻿" + lines.join("\n") + "\n";
}

/**
 * Parse de número aceitando formatos BR (1.234,56), EN (1234.56) e EU (1234,56).
 * Detecta pelo último separador encontrado.
 */
export function parseNumber(s: string): number | null {
  if (!s) return null;
  const trimmed = s.replace(/[^\d,.\-+]/g, "").trim();
  if (!trimmed) return null;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastDot) {
    // vírgula é decimal: remove pontos (milhar), troca vírgula por ponto
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // ponto é decimal: remove vírgulas (milhar)
    normalized = trimmed.replace(/,/g, "");
  } else {
    normalized = trimmed;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse de data aceitando ISO (2026-05-22), BR (22/05/2026), EU (22-05-2026).
 * Retorna no formato ISO YYYY-MM-DD.
 */
export function parseDate(s: string): string | null {
  if (!s) return null;
  const trimmed = s.trim();

  // ISO 2026-05-22
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  // BR/EU 22/05/2026 ou 22-05-2026
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(trimmed);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  return null;
}
