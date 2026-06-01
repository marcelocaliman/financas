/**
 * Avisos tipados do motor de IR. A regra de ouro do ROADMAP (decisão D7,
 * fail-loud): renda ambígua/desconhecida NUNCA some em silêncio — vira um aviso
 * que o usuário vê e precisa resolver antes de fechar a declaração.
 *
 * Puro e serializável (atravessa server → client sem problema).
 */

export type IrWarningSeverity = "info" | "atencao" | "critico";

export type IrWarningCode =
  | "renda_nao_classificada"
  | "renda_passiva_generica"
  | "aluguel_verificar_carne_leao"
  | "irrf_sobre_isento"
  | "distribuicao_verificar_limite"
  | "dividendos_2026_irrf"
  | "tabela_estimada";

export interface IrWarning {
  code: IrWarningCode;
  severity: IrWarningSeverity;
  /** Mensagem pronta pra exibir ao usuário. */
  message: string;
  /** Valor bruto (BRL) afetado, quando aplicável. */
  amount?: number;
  /** Rótulo da origem (categoria/descrição/fonte) que gerou o aviso. */
  origin?: string;
}

/** Severidade máxima de uma lista (pra decidir cor/badge agregado). */
export function maxSeverity(warnings: IrWarning[]): IrWarningSeverity | null {
  const order: Record<IrWarningSeverity, number> = { info: 0, atencao: 1, critico: 2 };
  let max: IrWarningSeverity | null = null;
  for (const w of warnings) {
    if (max === null || order[w.severity] > order[max]) max = w.severity;
  }
  return max;
}
