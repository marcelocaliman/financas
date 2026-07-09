import type { NetWorthSnapshot } from "@/domain/types";
import type { Currency } from "@/money/currency";

/** Operação de persistência planejada pelo reconciliador (aplicada pelo hook). */
export type SnapshotOp =
  | { type: "put"; snapshot: NetWorthSnapshot }
  | { type: "remove"; id: string };

/**
 * Reconcilia o snapshot AUTOMÁTICO do mês corrente (puro/testável). Invariante: no máximo
 * UM auto por mês, com id DETERMINÍSTICO `auto-AAAA-MM` — assim, se o efeito disparar duas
 * vezes antes do 1º snapshot propagar (rates/patrimônio/orçamento carregam em momentos
 * diferentes), os dois `put` colidem no mesmo id e o 2º sobrescreve o 1º, em vez de nascerem
 * DUAS linhas do mesmo mês (o bug do id aleatório).
 *
 * Regras:
 * - Se o usuário assumiu o mês (`auto:false`), respeita a linha manual e remove QUALQUER auto.
 * - Senão, mantém só `auto-AAAA-MM`; remove autos com id ≠ dele (limpa duplicatas do bug antigo).
 * - Atualiza o auto quando patrimônio/moeda/aporte mudaram (tolerância de meio centavo).
 */
export function planCurrentMonthAuto(
  snapshots: NetWorthSnapshot[],
  month: string,
  base: Currency,
  nw: number,
  want: number | undefined,
): SnapshotOp[] {
  const detId = `auto-${month}`;
  const rows = snapshots.filter((s) => s.month === month);
  const manual = rows.find((s) => s.auto !== true);
  const autos = rows.filter((s) => s.auto === true);
  const ops: SnapshotOp[] = [];

  if (manual) {
    // Usuário assumiu o mês manualmente → respeita e limpa QUALQUER auto duplicado.
    for (const a of autos) ops.push({ type: "remove", id: a.id });
    return ops;
  }

  // Um único auto por mês, id determinístico: remove os de id aleatório (duplicatas do bug antigo).
  for (const a of autos) if (a.id !== detId) ops.push({ type: "remove", id: a.id });

  const auto = autos.find((s) => s.id === detId);
  if (!auto) {
    ops.push({ type: "put", snapshot: { id: detId, month, currency: base, amount: nw, contribution: want, auto: true } });
    return ops;
  }

  const cur = auto.contribution ?? null;
  const tgt = want ?? null;
  const contribChanged = cur === null ? tgt !== null : tgt === null || Math.abs(cur - tgt) > 0.5;
  if (auto.currency !== base || Math.abs(auto.amount - nw) > 0.5 || contribChanged) {
    // Mantém o AUTO do mês corrente alinhado ao patrimônio, à moeda principal e ao saldo do orçamento.
    ops.push({ type: "put", snapshot: { ...auto, currency: base, amount: nw, contribution: want } });
  }
  return ops;
}
