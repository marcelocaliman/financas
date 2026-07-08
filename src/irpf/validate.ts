import type { TaxItem } from "@/domain/irpf";
import type { Asset, Liability } from "@/domain/types";
import { isForeignCurrency } from "./codes";

// Validação + reconciliação do Organizador de IRPF — puro e testável. Melhora a honestidade:
// não entrega documento pela metade e mostra o que ainda precisa de atenção.

export type IrpfIssue = "no-code" | "no-value" | "foreign-no-brl" | "incomplete";

/** Pendências de UM item (vazio = pronto). */
export function itemIssues(it: TaxItem): IrpfIssue[] {
  const out: IrpfIssue[] = [];
  const semCodigo = it.kind === "asset" ? !it.group || !it.code : !it.code;
  if (semCodigo) out.push("no-code");
  // Bem VENDIDO: a coluna do ano-base é 0 POR REGRA (não se possui em 31/12) e não precisa de BRL do
  // ano-base — não é pendência. A história da venda vive na discriminação.
  if (!it.disposed && !(it.valorAnoBase > 0)) out.push("no-value");
  if (!it.disposed && isForeignCurrency(it.currency) && it.valorBrlAnoBase == null) out.push("foreign-no-brl");
  if (it.discriminacao.includes("[preencher")) out.push("incomplete");
  return out;
}

/** Quantos itens têm ao menos uma pendência. */
export function countPending(items: TaxItem[]): number {
  return items.reduce((n, it) => n + (itemIssues(it).length ? 1 : 0), 0);
}

export interface PatrimonioDiff {
  /** Ativos/passivos que existem no patrimônio mas ainda não viraram linha do IRPF. */
  newAssets: Asset[];
  newLiabilities: Liability[];
  /** Linhas puxadas cujo bem sumiu do patrimônio (baixado/vendido no ano) — leve ao contador. */
  orphans: TaxItem[];
}

/** Compara as linhas do ano com o patrimônio ATUAL: o que falta puxar e o que ficou órfão. */
export function diffPatrimonio(items: TaxItem[], assets: Asset[], liabilities: Liability[]): PatrimonioDiff {
  const sourced = new Set(items.map((i) => i.sourceId).filter(Boolean) as string[]);
  const patrimonioIds = new Set<string>([...assets.map((a) => a.id), ...liabilities.map((l) => l.id)]);
  return {
    newAssets: assets.filter((a) => !sourced.has(a.id)),
    newLiabilities: liabilities.filter((l) => !sourced.has(l.id)),
    // Vendido (disposed) NÃO é órfão — a venda é intencional e já tratada. Órfão = sumiu sem explicação.
    orphans: items.filter((i) => !i.disposed && i.source !== "manual" && i.sourceId != null && !patrimonioIds.has(i.sourceId)),
  };
}
