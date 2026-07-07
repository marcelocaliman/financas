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
 * CSV-modelo da fatura (com BOM p/ o Excel abrir UTF-8). Colunas: categoria · detalhe · valor · moeda.
 * As linhas-exemplo usam categorias REAIS do usuário (quando houver) pra o casamento por nome funcionar.
 * `moeda` é opcional na importação — em branco herda a moeda da fatura. `header` permite rótulos
 * localizados (o parser reconhece PT e EN de qualquer jeito).
 */
export function statementTemplateCSV(
  exampleCategories: string[],
  currency: string,
  header: string[] = ["categoria", "detalhe", "valor", "moeda"],
): string {
  const examples = [
    ["Mercado", "Compras do mês", "450,00"],
    ["Transporte", "Uber / combustível", "180,00"],
    ["Saúde", "Farmácia", "90,00"],
  ];
  const cats = exampleCategories.filter((c) => c && c.trim().length > 0);
  const rows = examples.map((ex, i) => [cats[i] ?? ex[0], ex[1], ex[2], currency]);
  const lines = [header, ...rows].map((r) => r.map(esc).join(","));
  return "﻿" + lines.join("\n") + "\n";
}
