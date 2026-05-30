import "server-only";
import { computeImposto, type ImpostoResult } from "@/services/ir/imposto";
import { listFilers, getRegimeContext } from "@/services/ir/filers";

/**
 * Compara as 2 estratégias de declaração possíveis pra um casal:
 *   - Conjunta: 1 declaração, esposa entra como dependente
 *   - Separadas: 2 declarações, cada um declara o seu (split de bens comuns)
 *
 * Retorna o imposto líquido devido em cada cenário e recomenda o mais barato.
 *
 * Heurística "esposa como dependente": pra conjunta, somamos rendimentos dos 2
 * filers e contamos o secundário como +1 dependente (gera a dedução de
 * R$ 2.275,08). Bens são todos somados (visão única do household).
 *
 * Pra separada, chamamos computeImposto(year, household, filer) pra cada um e
 * somamos o imposto devido líquido.
 */

export type ComparatorResult = {
  year: number;
  joint: ImpostoResult | null; // null se household não tem 2 filers (não há "casal pra juntar")
  separate: {
    primary: { filerId: string; filerName: string; result: ImpostoResult } | null;
    secondary: { filerId: string; filerName: string; result: ImpostoResult } | null;
    totalNetDue: number;
  } | null;
  recommendation: "joint" | "separate" | "single";
  savings: number; // economia escolhendo a opção recomendada
};

export async function compareDeclarationStrategies(
  year: number,
  householdId?: string,
): Promise<ComparatorResult> {
  const filers = await listFilers(householdId);
  await getRegimeContext(householdId); // valida que existe; futuro pode usar p/ heurística

  // Sem casal: só compara modelos simples vs completo do filer único.
  if (filers.length < 2) {
    const single = await computeImposto(year, householdId);
    return {
      year,
      joint: single,
      separate: null,
      recommendation: "single",
      savings: 0,
    };
  }

  const [primary, secondary] = filers;

  // 1) Conjunta = visão household (sem filerId) + cônjuge como dependente
  //    (+1 dedução por dependente), conforme a declaração conjunta real.
  const jointResult = await computeImposto(year, householdId, undefined, 1);

  // 2) Separadas: 1 chamada por filer
  const [primaryResult, secondaryResult] = await Promise.all([
    computeImposto(year, householdId, primary.id),
    computeImposto(year, householdId, secondary.id),
  ]);

  const jointNet = Math.min(jointResult.completo.netDue, jointResult.simples.netDue);
  const separateNet =
    Math.min(primaryResult.completo.netDue, primaryResult.simples.netDue) +
    Math.min(secondaryResult.completo.netDue, secondaryResult.simples.netDue);

  const recommendation: "joint" | "separate" = jointNet <= separateNet ? "joint" : "separate";
  const savings = Math.abs(jointNet - separateNet);

  return {
    year,
    joint: jointResult,
    separate: {
      primary: { filerId: primary.id, filerName: primary.full_name, result: primaryResult },
      secondary: { filerId: secondary.id, filerName: secondary.full_name, result: secondaryResult },
      totalNetDue: Math.round(separateNet * 100) / 100,
    },
    recommendation,
    savings: Math.round(savings * 100) / 100,
  };
}
