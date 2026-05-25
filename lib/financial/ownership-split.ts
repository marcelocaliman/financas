/**
 * Cálculo de atribuição de um bem entre os filers do household,
 * respeitando o regime de bens brasileiro (Código Civil arts. 1.658-1.671).
 *
 * - Solteiro / Separação total / obrigatória: 100% no owner_filer_id
 * - Bem particular (herança, doação, pré-casamento): 100% no owner
 * - Comunhão parcial: bens pré-casamento = particulares; pós = comuns 50/50
 * - Comunhão universal: tudo é comum 50/50 (exceto particulares por exceção legal)
 * - Override: ownership_percent define manualmente (ex.: conta conjunta 50/50)
 *
 * O resultado é uma lista de {filerId, percent}. Em declaração separada, cada
 * filer recebe sua fatia. Em conjunta, soma tudo (irrelevante o split).
 */

import type { MarriageRegime, CommonAssetsStrategy } from "@/types/database";

export type AssetForSplit = {
  owner_filer_id: string | null;
  is_particular: boolean;
  ownership_percent: number | null;
  // Pra comunhão parcial precisamos saber se foi adquirido antes/depois do casamento.
  // Para investments usa-se purchase_date; para physical_assets usa-se acquired_at;
  // para accounts usa-se created_at (proxy razoável — conta aberta = aquisição).
  acquired_at?: string | null;
};

export type FilerForSplit = {
  id: string;
  is_primary: boolean;
};

export type SplitResult = Array<{
  filerId: string;
  /** Percentual de propriedade do filer no bem (0–100). */
  percent: number;
}>;

/**
 * Calcula o split de propriedade de um bem entre os filers.
 *
 * Garantias:
 * - Soma dos percentuais é sempre 100 (ou 0 se não atribuível).
 * - Se houver só 1 filer ativo, sempre 100% nele.
 * - Quando há override (ownership_percent), divide proporcionalmente entre
 *   owner (que recebe a fatia explícita) e o outro (resto).
 */
export function splitAssetByRegime(
  asset: AssetForSplit,
  filers: FilerForSplit[],
  regime: MarriageRegime,
  marriageDate: string | null,
  commonAssetsStrategy: CommonAssetsStrategy = "split_50_50",
): SplitResult {
  if (filers.length === 0) return [];
  if (filers.length === 1) {
    return [{ filerId: filers[0].id, percent: 100 }];
  }

  const primary = filers.find((f) => f.is_primary) ?? filers[0];
  const secondary = filers.find((f) => f.id !== primary.id) ?? filers[1];
  const owner = asset.owner_filer_id ?? primary.id;
  const ownerFiler = filers.find((f) => f.id === owner) ?? primary;
  const otherFiler = filers.find((f) => f.id !== ownerFiler.id) ?? secondary;

  // Override manual: ownership_percent define a fatia do owner; resto vai pro outro.
  if (asset.ownership_percent != null) {
    const pct = Math.max(0, Math.min(100, Number(asset.ownership_percent)));
    if (pct === 100) return [{ filerId: ownerFiler.id, percent: 100 }];
    if (pct === 0) return [{ filerId: otherFiler.id, percent: 100 }];
    return [
      { filerId: ownerFiler.id, percent: pct },
      { filerId: otherFiler.id, percent: 100 - pct },
    ];
  }

  // Regimes sem comunhão: 100% no owner
  if (regime === "solteiro" || regime === "separacao_total" || regime === "separacao_obrigatoria") {
    return [{ filerId: ownerFiler.id, percent: 100 }];
  }

  // Bem particular (herança, doação, sub-rogação, pré-casamento marcado): 100% no owner
  if (asset.is_particular) {
    return [{ filerId: ownerFiler.id, percent: 100 }];
  }

  // Comunhão parcial: bem pré-casamento é particular automaticamente
  if (regime === "comunhao_parcial" && marriageDate && asset.acquired_at) {
    if (asset.acquired_at < marriageDate) {
      return [{ filerId: ownerFiler.id, percent: 100 }];
    }
  }

  // A partir daqui o bem é COMUM (comunhão parcial pós-casamento, ou comunhão universal).
  // Aplica a estratégia escolhida para bens comuns:
  if (commonAssetsStrategy === "all_in_primary") {
    return [{ filerId: primary.id, percent: 100 }];
  }
  if (commonAssetsStrategy === "all_in_secondary") {
    return [{ filerId: secondary.id, percent: 100 }];
  }
  // split_50_50 (default)
  return [
    { filerId: primary.id, percent: 50 },
    { filerId: secondary.id, percent: 50 },
  ];
}

/**
 * Filtra um valor pra UM filer específico, aplicando o split.
 * Retorna o valor proporcional que deve aparecer na declaração desse filer.
 *
 * Ex.: bem de R$ 100.000 com split 50/50 → filer A vê R$ 50.000.
 *      bem particular do filer B → filer A vê R$ 0.
 */
export function valueForFiler(
  totalValue: number,
  asset: AssetForSplit,
  filers: FilerForSplit[],
  regime: MarriageRegime,
  marriageDate: string | null,
  filerId: string,
  commonAssetsStrategy: CommonAssetsStrategy = "split_50_50",
): number {
  const split = splitAssetByRegime(asset, filers, regime, marriageDate, commonAssetsStrategy);
  const hit = split.find((s) => s.filerId === filerId);
  if (!hit) return 0;
  return Math.round((totalValue * hit.percent) / 100 * 100) / 100;
}
