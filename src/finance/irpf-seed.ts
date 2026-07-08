import type { Asset, Liability } from "@/domain/types";
import type { TaxItem } from "@/domain/irpf";

// Semeadura do Organizador de IRPF a partir do patrimônio ("Puxar do meu patrimônio", automação A1).
// Motor IDEMPOTENTE + puro (testável). O mapa REAL de grupo/código (tabela oficial do exercício) e a
// discriminação rica entram no Stage 2, plugados via `TaxSeedMapper` sem mexer no motor.

/** Mapeia um Asset/Liability numa linha de IRPF. */
export interface TaxSeedMapper {
  asset: (a: Asset, baseYear: number) => TaxItem;
  debt: (l: Liability, baseYear: number) => TaxItem;
}

/** Discriminação inicial — só um ponto de partida; o template rico vem no Stage 2. */
function starterDiscriminacao(name: string, institution?: string): string {
  return [institution, name].filter(Boolean).join(" — ") || name;
}

/**
 * Mapeador BÁSICO (Stage 1): carrega o que já dá (valor, moeda, país, instituição). Grupo/código
 * ficam VAZIOS (o Stage 2 sugere pela classe). O `valorAnoBase` nasce com o valor de HOJE — a UI o
 * marca como "revisar: ajuste pro fim do ano", pra ninguém copiar o número errado.
 */
export const basicSeedMapper: TaxSeedMapper = {
  asset: (a, baseYear) => {
    const fields: Record<string, string> = {};
    if (a.ticker) fields.ticker = a.ticker;
    if (a.quantity != null) fields.quantidade = String(a.quantity);
    return {
      id: `irpf-${baseYear}-a-${a.id}`,
      baseYear,
      kind: "asset",
      group: "",
      code: "",
      discriminacao: starterDiscriminacao(a.name, a.institution),
      currency: a.currency,
      valorAnoBase: a.amount,
      needsReview: true,
      country: a.regionId,
      institution: a.institution,
      fields,
      source: "seed-asset",
      sourceId: a.id,
    };
  },
  debt: (l, baseYear) => ({
    id: `irpf-${baseYear}-l-${l.id}`,
    baseYear,
    kind: "debt",
    group: "",
    code: "",
    discriminacao: starterDiscriminacao(l.name),
    currency: l.currency,
    valorAnoBase: l.amount,
    needsReview: true,
    fields: {},
    source: "seed-liability",
    sourceId: l.id,
  }),
};

/**
 * Motor de semeadura IDEMPOTENTE: devolve só as linhas NOVAS a inserir — uma por Asset/Liability que
 * ainda não tem correspondente (por `sourceId`) naquele ano. NUNCA sobrescreve item existente (nem os
 * editados à mão). Rodar de novo depois de adicionar 1 ativo → devolve só o novo.
 */
export function buildSeedTaxItems(
  baseYear: number,
  assets: Asset[],
  liabilities: Liability[],
  existing: TaxItem[],
  map: TaxSeedMapper = basicSeedMapper,
): TaxItem[] {
  const seen = new Set(existing.map((i) => i.sourceId).filter(Boolean) as string[]);
  const out: TaxItem[] = [];
  for (const a of assets) if (!seen.has(a.id)) out.push(map.asset(a, baseYear));
  for (const l of liabilities) if (!seen.has(l.id)) out.push(map.debt(l, baseYear));
  return out;
}

/**
 * Roll-forward: clona os itens de um ano pro ano seguinte. O valor de 31/12 do ano anterior VIRA a
 * coluna "situação ano anterior" (as duas que a Receita pede) e o valor deste ano nasce herdado,
 * marcado como "revisar" — a única tarefa do ano 2+ é atualizar o valor novo. Preserva código,
 * discriminação (e o `discriminacaoLocked`), campos, moeda, país e o rastro de origem.
 */
export function buildRollForward(prev: TaxItem[], newBaseYear: number): TaxItem[] {
  return prev.map((p) => ({
    ...p,
    id: p.sourceId
      ? `irpf-${newBaseYear}-${p.kind === "asset" ? "a" : "l"}-${p.sourceId}`
      : `irpf-${newBaseYear}-m-${p.id}`,
    baseYear: newBaseYear,
    valorAnoAnterior: p.valorAnoBase,
    valorBrlAnoAnterior: p.valorBrlAnoBase,
    needsReview: true,
  }));
}

/**
 * Atualiza o VALOR (situação do ano-base) dos itens auto-puxados que o usuário AINDA não confirmou
 * (needsReview) pro valor ATUAL do patrimônio. É o que faz "puxar de novo em dezembro" refrescar os
 * números sem clobber do que foi editado à mão. Ignora vendidos (tratados à parte) e manuais.
 * Devolve só os itens que MUDARAM.
 */
export function refreshPulledValues(
  existing: TaxItem[],
  assets: Asset[],
  baseYear: number,
  map: TaxSeedMapper = basicSeedMapper,
): TaxItem[] {
  const byId = new Map(assets.map((a) => [a.id, a] as const));
  const out: TaxItem[] = [];
  for (const it of existing) {
    if (it.source !== "seed-asset" || it.disposed || !it.needsReview || !it.sourceId) continue;
    const a = byId.get(it.sourceId);
    if (!a || a.disposedOn) continue; // vendido → tratado por findUnmarkedDisposals
    const fresh = map.asset(a, baseYear);
    if (fresh.valorAnoBase !== it.valorAnoBase || !!fresh.needsReview !== !!it.needsReview) {
      out.push({ ...it, valorAnoBase: fresh.valorAnoBase, needsReview: fresh.needsReview });
    }
  }
  return out;
}
