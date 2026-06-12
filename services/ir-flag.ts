import "server-only";
import { cache } from "react";
import { getCurrentUserContext } from "@/services/auth";

/**
 * IRPF (declaração) ligado pro household atual? Lê households.ir_enabled
 * (default true). Fonte única do desligamento reversível do IRPF — usada pra
 * gatear nav, páginas e accordions de IR nos formulários. NÃO afeta o IR de
 * resgate (lib/financial/tax.ts), que é cálculo leve e segue ativo.
 *
 * Memoizada por request (cache) — várias chamadas no mesmo render = 1.
 */
export const isIrEnabled = cache(async (): Promise<boolean> => {
  const ctx = await getCurrentUserContext();
  if (!ctx) return false;
  // ir_enabled pode não estar nos tipos gerados ainda → cast. Default: ligado.
  return (ctx.household as { ir_enabled?: boolean | null }).ir_enabled !== false;
});
