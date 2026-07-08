import type { TaxItem } from "@/domain/irpf";
import type { Currency } from "@/money/currency";
import { parseCSV } from "@/finance/statement-csv";
import { composeDiscriminacao } from "./mapper";
import { groupName, codeName, isForeignCurrency } from "./codes";

// Planilhas do Organizador de IRPF pro contador — 2 CSVs (Bens e Direitos + Dívidas). Separador ";" e
// vírgula decimal (Excel pt-BR), com BOM UTF-8. Puro/testável; o download é um helper à parte.

const BOM = "﻿";

function cell(v: string | number | undefined): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Número → "1234,56" (vírgula decimal); vazio se ausente. */
function num(n: number | undefined): string {
  return n == null || !Number.isFinite(n) ? "" : n.toFixed(2).replace(".", ",");
}
/** Marca o que mudou desde o ano anterior (direciona o esforço do contador). */
export function changeFlag(it: TaxItem): "NOVO" | "ALTERADO" | "VENDIDO" | "" {
  if (it.disposed) return "VENDIDO";
  if (it.valorAnoAnterior == null) return "NOVO";
  if (it.valorAnoBase !== it.valorAnoAnterior) return "ALTERADO";
  return "";
}
/** Valor em BRL que vai à declaração: doméstico = valorAnoBase; exterior = valorBrl* (manual). */
export function brlValue(it: TaxItem, which: "base" | "prev"): number | undefined {
  const foreign = isForeignCurrency(it.currency);
  if (which === "base") return foreign ? it.valorBrlAnoBase : it.valorAnoBase;
  return foreign ? it.valorBrlAnoAnterior : it.valorAnoAnterior;
}

const byCode = (a: TaxItem, b: TaxItem) => (a.group + a.code).localeCompare(b.group + b.code);

export function buildBensCSV(items: TaxItem[]): string {
  const head = ["ordem", "novo_alterado", "grupo", "grupo_nome", "codigo", "codigo_nome", "pais", "cnpj", "discriminacao", "moeda_origem", "valor_moeda_origem", "situacao_ano_anterior_brl", "situacao_ano_brl", "observacao"];
  const bens = items.filter((i) => i.kind === "asset").sort(byCode);
  const rows = bens.map((it, i) => {
    const foreign = isForeignCurrency(it.currency);
    // Vendido: a coluna de 31/12 do ano-base é 0 POR REGRA (não se possui mais); a história da venda
    // (data/valor/comprador) já está na discriminação. Alerta de ganho de capital na observação.
    const baseBrl = it.disposed ? 0 : brlValue(it, "base");
    const obs = it.disposed
      ? "VENDIDO — situação em 31/12 = 0; apurar ganho de capital (GCAP) com o contador"
      : foreign
        ? "Exterior — R$ informado manualmente (custo na data da compra; confira com o contador)"
        : "";
    return [
      i + 1, changeFlag(it), it.group, groupName(it.group), it.code, codeName(it.group, it.code),
      it.country ?? "", it.fields.cnpj ?? "", it.discriminacao,
      foreign ? it.currency : "", foreign && !it.disposed ? num(it.valorAnoBase) : "",
      num(brlValue(it, "prev")), num(baseBrl),
      obs,
    ].map(cell).join(";");
  });
  return BOM + head.join(";") + "\n" + rows.join("\n");
}

export function buildDividasCSV(items: TaxItem[]): string {
  const head = ["ordem", "codigo", "codigo_nome", "pais", "discriminacao", "situacao_ano_anterior_brl", "situacao_ano_brl"];
  const debts = items.filter((i) => i.kind === "debt").sort((a, b) => a.code.localeCompare(b.code));
  const rows = debts.map((it, i) => [
    i + 1, it.code, codeName("", it.code, "debt"), it.country ?? "", it.discriminacao,
    num(brlValue(it, "prev")), num(brlValue(it, "base")),
  ].map(cell).join(";"));
  return BOM + head.join(";") + "\n" + rows.join("\n");
}

// ── IMPORTAR PLANILHA ────────────────────────────────────────────────────────
// Bulk-add de itens a partir de uma planilha (modelo abaixo ou export da corretora): colunas
// nome, grupo, codigo, cnpj, valor, moeda, pais. Reusa o parseCSV da fatura (detecta ; ou , + BOM).

/** Modelo pra o usuário preencher (BOM + ";" → Excel pt-BR abre certo). */
export const IRPF_IMPORT_TEMPLATE =
  BOM +
  [
    "nome;grupo;codigo;cnpj;valor;moeda;pais",
    "Ações Petrobras;03;01;33.000.167/0001-01;20000,00;BRL;",
    "CDB Banco X;04;02;00.000.000/0001-00;15000,00;BRL;",
    "Conta corrente Nubank;06;01;18.236.120/0001-58;5000,00;BRL;",
    "Apple (stock);03;01;;5000,00;USD;eua",
  ].join("\n") + "\n";

const CURRENCIES = ["BRL", "EUR", "USD", "GBP"];
function toCurrency(s: string): Currency {
  const u = s.trim().toUpperCase();
  return (CURRENCIES.includes(u) ? u : "BRL") as Currency;
}
function parseNum(s: string): number {
  const c = (s || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
}

/** Converte a planilha em itens (bens). Valor informado = posição de 31/12 (não marca "revisar").
 *  Exterior (moeda ≠ BRL) guarda a moeda de origem; o R$ fica manual (PTAX depois). */
export function parseIrpfImport(text: string, baseYear: number): TaxItem[] {
  const recs = parseCSV(text);
  const out: TaxItem[] = [];
  recs.forEach((r, i) => {
    const nome = (r.nome ?? r.descricao ?? r["descrição"] ?? r.discriminacao ?? "").trim();
    const grupo = (r.grupo ?? "").trim();
    const codigo = (r.codigo ?? r["código"] ?? "").trim();
    const cnpj = (r.cnpj ?? r["cnpj/cpf"] ?? "").trim();
    const valor = parseNum(r.valor ?? r.situacao ?? r["situação"] ?? "");
    const moeda = toCurrency(r.moeda ?? "BRL");
    const pais = (r.pais ?? r["país"] ?? "").trim();
    if (!nome && valor === 0) return; // linha vazia
    const fields: Record<string, string> = { nome };
    if (cnpj) fields.cnpj = cnpj;
    out.push({
      id: crypto.randomUUID(),
      baseYear,
      kind: "asset",
      group: grupo,
      code: codigo,
      discriminacao: composeDiscriminacao("asset", grupo, fields),
      currency: moeda,
      valorAnoBase: valor,
      country: pais || undefined,
      fields,
      source: "manual",
      createdAt: Date.now() + i,
    });
  });
  return out;
}

/** Baixa um CSV (client-side; nada sai pro servidor). */
export function downloadCSV(name: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
