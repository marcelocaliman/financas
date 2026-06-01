/**
 * Isenções de aposentadoria/pensão por PERFIL do declarante. Puro/testável.
 *
 * Regras (verificar com a base legal — ver docs/ir-regras.md):
 *  - Maiores de 65 anos: parcela mensal isenta de aposentadoria/pensão
 *    (R$ 1.903,98 desde 2015), aplicada em 12 competências + 13º = ×13/ano.
 *    O excedente é tributável normalmente. (Lei 7.713/88 art. 6º XV.)
 *  - Moléstia grave: proventos de aposentadoria/reforma/pensão 100% isentos.
 *    (Lei 7.713/88 art. 6º XIV.) Prevalece sobre a isenção de idade.
 *  - A elegibilidade por idade vale A PARTIR DO MÊS do aniversário de 65 (IN RFB
 *    1.500/14): no ano em que completa 65, a isenção conta do mês do aniversário
 *    até dezembro + 13º; nos anos seguintes, o ano cheio (×13).
 */

export interface FilerExemptionProfile {
  /** ISO YYYY-MM-DD; null se desconhecido (sem isenção de idade aplicável). */
  birthDate: string | null;
  hasSeriousIllness: boolean;
}

/** Idade completada até 31/12 do ano-base. Null se birthDate ausente/ inválido. */
export function ageAtYearEnd(birthDate: string | null, year: number): number | null {
  if (!birthDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const by = Number(m[1]);
  if (!Number.isFinite(by)) return null;
  // Idade em 31/12 do ano-base = year - anoNascimento (nasceu até 31/12).
  return year - by;
}

/**
 * Nº de competências isentas no ano para 65+ (×13 = 12 meses + 13º no ano cheio).
 * No ANO em que completa 65, conta do mês do aniversário até dezembro (+ 13º):
 * fator = 14 − mês_nascimento (jan = 13/cheio; dez = 2). 0 se ainda não fez 65.
 */
export function elderlyMonthsFactor(birthDate: string | null, year: number): number {
  const age = ageAtYearEnd(birthDate, year);
  if (age == null || age < 65) return 0;
  if (age > 65) return 13; // ano cheio
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate ?? "");
  const birthMonth = m ? Number(m[2]) : 1;
  return Math.max(0, Math.min(13, 14 - birthMonth));
}

/** Isenção anual de aposentadoria 65+ = parcela mensal × fator (default 13). */
export function elderlyAnnualExemption(monthlyExemption: number, factor = 13): number {
  return Math.round(monthlyExemption * factor * 100) / 100;
}

export interface ExemptionSplit {
  /** Parcela que vira isenta. */
  isento: number;
  /** Parcela que permanece tributável. */
  tributavel: number;
  /** Por que ficou isento (pra UI/relatório), ou null se nada isento. */
  reason: "molestia_grave" | "idade_65" | null;
}

/**
 * Divide um valor de aposentadoria/pensão entre isento e tributável conforme o
 * perfil do declarante. Moléstia grave isenta tudo; idade 65+ isenta até o
 * limite anual; sem elegibilidade, tudo tributável.
 */
export function splitAposentadoriaExemption(
  aposentadoriaGross: number,
  profile: FilerExemptionProfile,
  year: number,
  monthlyExemption: number,
): ExemptionSplit {
  const gross = Math.max(0, Math.round(aposentadoriaGross * 100) / 100);
  if (gross === 0) return { isento: 0, tributavel: 0, reason: null };

  if (profile.hasSeriousIllness) {
    return { isento: gross, tributavel: 0, reason: "molestia_grave" };
  }

  const factor = elderlyMonthsFactor(profile.birthDate, year);
  if (factor > 0) {
    const limit = elderlyAnnualExemption(monthlyExemption, factor);
    const isento = Math.min(gross, limit);
    return {
      isento: Math.round(isento * 100) / 100,
      tributavel: Math.round((gross - isento) * 100) / 100,
      reason: isento > 0 ? "idade_65" : null,
    };
  }

  return { isento: 0, tributavel: gross, reason: null };
}
