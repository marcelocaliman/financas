"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * Preview de CSV — busca o arquivo via URL assinada, faz parse simples e
 * renderiza como tabela. Suporta vírgula, ponto-e-vírgula e tab como
 * separador (detecta pelo conteúdo da primeira linha).
 */
export function CsvPreview({
  url,
  filename,
  maxRows = 50,
}: {
  url: string;
  filename: string;
  maxRows?: number;
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        if (aborted) return;
        const parsed = parseCsv(text);
        setTotalRows(parsed.length);
        setRows(parsed.slice(0, maxRows));
      } catch (e) {
        if (!aborted) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      aborted = true;
    };
  }, [url, maxRows]);

  if (error) {
    return (
      <div className="bg-surface-muted rounded-[8px] p-4 text-[12.5px] text-rust-600">
        Erro ao carregar preview: {error}
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="bg-surface-muted rounded-[8px] p-6 flex items-center justify-center text-[12.5px] text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" strokeWidth={1.8} />
        Carregando CSV…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface-muted rounded-[8px] p-4 text-[12.5px] text-muted-foreground italic">
        Arquivo vazio.
      </div>
    );
  }

  const [header, ...body] = rows;

  return (
    <div className="rounded-[8px] border border-border overflow-hidden bg-surface">
      <div className="overflow-auto max-h-[560px]">
        <table className="w-full text-[11.5px] font-mono">
          <thead className="bg-surface-muted/60 sticky top-0">
            <tr>
              {header.map((cell, i) => (
                <th
                  key={i}
                  className="text-left py-1.5 px-2 font-medium text-[10.5px] uppercase tracking-[0.1em] text-faint-foreground border-b border-border whitespace-nowrap"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-border last:border-b-0 hover:bg-surface-muted/30"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="py-1 px-2 tabular-nums text-foreground whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[11px] text-faint-foreground">
        <span>
          {totalRows > maxRows
            ? `Mostrando ${maxRows} de ${totalRows} linhas`
            : `${totalRows} linha${totalRows === 1 ? "" : "s"}`}
        </span>
        <a
          href={url}
          download={filename}
          className="inline-flex items-center gap-1 text-navy-700 dark:text-navy-300 hover:underline"
        >
          <Download className="w-3 h-3" strokeWidth={1.8} />
          Baixar
        </a>
      </div>
    </div>
  );
}

/**
 * Parse simples de CSV: detecta separador (comma/semicolon/tab) na primeira
 * linha não-vazia. Suporta valores com aspas e vírgulas internas.
 */
function parseCsv(text: string): string[][] {
  const cleaned = text.replace(/^﻿/, ""); // strip BOM
  const lines = cleaned.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const sep = detectSeparator(lines[0]);
  return lines.map((line) => parseLine(line, sep));
}

function detectSeparator(line: string): string {
  const counts = {
    ";": (line.match(/;/g) ?? []).length,
    ",": (line.match(/,/g) ?? []).length,
    "\t": (line.match(/\t/g) ?? []).length,
  };
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top[1] > 0 ? top[0] : ",";
}

function parseLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        current += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === sep) {
        out.push(current);
        current = "";
      } else {
        current += c;
      }
    }
  }
  out.push(current);
  return out;
}
