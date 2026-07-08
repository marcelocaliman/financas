import type { TaxItem } from "@/domain/irpf";
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
export function changeFlag(it: TaxItem): "NOVO" | "ALTERADO" | "" {
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
    return [
      i + 1, changeFlag(it), it.group, groupName(it.group), it.code, codeName(it.group, it.code),
      it.country ?? "", it.fields.cnpj ?? "", it.discriminacao,
      foreign ? it.currency : "", foreign ? num(it.valorAnoBase) : "",
      num(brlValue(it, "prev")), num(brlValue(it, "base")),
      foreign ? "Exterior — R$ informado manualmente (custo na data da compra; confira com o contador)" : "",
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
