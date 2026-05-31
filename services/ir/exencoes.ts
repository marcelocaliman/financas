/**
 * Isenções de aposentadoria/pensão por PERFIL do declarante. Puro/testável.
 *
 * Regras (verificar com a base legal — ver docs/ir-regras.md):
 *  - Maiores de 65 anos: parcela mensal isenta de aposentadoria/pensão
 *    (R$ 1.903,98 desde 2015), aplicada em 12 competências + 13º = ×13/ano.
 *    O excedente é tributável normalmente. (Lei 7.713/88 art. 6º XV.)
 *  - Moléstia grave: proventos de aposentadoria/reforma/pensão 100% isentos.
 *    (Lei 7.713/88 art. 6º XIV.) Prevalece sobre a isenção de idade.
 *  - A elegibilidade por idade é aferida a partir do mês do aniversário de 65,
 *    mas pra simplicidade anual usamos "completou 65 até 31/12 do ano-base".
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

/** Isenção anual de aposentadoria 65+ = parcela mensal × 13 (12 + 13º). */
export function elderlyAnnualExemption(monthlyExemption: number): number {
  return Math.round(monthlyExemption * 13 * 100) / 100;
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

  const age = ageAtYearEnd(profile.birthDate, year);
  if (age != null && age >= 65) {
    const limit = elderlyAnnualExemption(monthlyExemption);
    const isento = Math.min(gross, limit);
    return {
      isento: Math.round(isento * 100) / 100,
      tributavel: Math.round((gross - isento) * 100) / 100,
      reason: isento > 0 ? "idade_65" : null,
    };
  }

  return { isento: 0, tributavel: gross, reason: null };
}
