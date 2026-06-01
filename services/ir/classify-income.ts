/**
 * Classificação PURA de um rendimento agregado nos buckets do IRPF.
 *
 * Extraído do loop de `rendimentos.ts` (que tinha um if/else SEM catch-all —
 * renda fora dos casos conhecidos era descartada em silêncio, subtributando).
 * Agora toda entrada cai EXPLICITAMENTE em um bucket. O bucket `naoClassificado`
 * é o catch-all fail-loud: fica FORA da base tributável (decisão D7) mas gera
 * um aviso que nunca some.
 *
 * Sem deps de IO — testável isolado (golden tests por cenário).
 */

import {
  isSalaryCategory,
  isAposentadoriaCategory,
  isRentCategory,
  isDividendCategory,
  isThirteenthCategory,
  isJcpCategory,
  isGenericPassiveCategory,
} from "@/services/ir/income-aliases";
import type { IrWarning } from "@/services/ir/warnings";

export type IncomeBucket = "tributavel" | "isento" | "exclusivo" | "naoClassificado";

/** Entrada agregada de rendimento (uma fonte ou uma categoria+descrição). */
export interface IncomeAgg {
  /** Nome da categoria (cru; a normalização acontece nos matchers). */
  cat: string;
  /** Tem CNPJ/CPF de fonte pagadora cadastrada? */
  hasPayer: boolean;
  /** Detectado como distribuição de lucros de PJ própria? */
  isDistribuicaoLucros: boolean;
  /** Ano-base — gate de vigência (ex.: dividendos passam a ter IRRF em 2026). */
  year?: number;
}

export interface IncomeClassification {
  bucket: IncomeBucket;
  receitaCode?: string;
  confidence: "alta" | "baixa";
  /** Razão legível da decisão (vai pra log/UI de revisão). */
  reason: string;
  /** Aviso a emitir (sem amount/origin — o chamador preenche). */
  warning?: Omit<IrWarning, "amount" | "origin">;
}

/**
 * Decide o bucket. Ordem importa: casos específicos e de alta confiança primeiro;
 * o catch-all fail-loud por último.
 */
export function classifyIncomeTx(agg: IncomeAgg): IncomeClassification {
  const cat = agg.cat ?? "";

  // 1) Distribuição de lucros de PJ própria → isento (cód. 09). Pra MEI, a
  //    isenção é limitada ao lucro presumido — avisamos pra o usuário conferir.
  if (agg.isDistribuicaoLucros) {
    return {
      bucket: "isento",
      receitaCode: "09",
      confidence: "alta",
      reason: "Distribuição de lucros de PJ própria",
      warning: {
        code: "distribuicao_verificar_limite",
        severity: "info",
        message:
          "Distribuição de lucros tratada como isenta. Se a empresa é MEI/Simples sem contabilidade, a isenção é limitada ao lucro presumido — o excedente é tributável. Confira.",
      },
    };
  }

  // 2) Aluguel/locação → TRIBUTÁVEL via carnê-leão. Era tratado como isento por
  //    uma regra de seed equivocada. Emite aviso pra evitar duplicar com o
  //    carnê-leão (que tem dedução de condomínio/IPTU).
  if (isRentCategory(cat)) {
    return {
      bucket: "tributavel",
      confidence: "alta",
      reason: "Aluguel/locação recebido (tributável via carnê-leão)",
      warning: {
        code: "aluguel_verificar_carne_leao",
        severity: "atencao",
        message:
          "Aluguel é tributável (carnê-leão). Confira se já não está lançado no carnê-leão pra não contar em dobro — lá você ainda deduz condomínio/IPTU.",
      },
    };
  }

  // 3a) 13º salário → tributação EXCLUSIVA na fonte (cód. 01), fora da base
  //     progressiva. (Antes caía como tributável via SALARY_ALIASES.)
  if (isThirteenthCategory(cat)) {
    return {
      bucket: "exclusivo",
      receitaCode: "01",
      confidence: "alta",
      reason: "13º salário (tributação exclusiva na fonte)",
    };
  }

  // 3b) JCP (Juros sobre Capital Próprio) → exclusivo 15% (cód. 10), NÃO isento.
  if (isJcpCategory(cat)) {
    return {
      bucket: "exclusivo",
      receitaCode: "10",
      confidence: "alta",
      reason: "Juros sobre Capital Próprio (exclusivo 15% na fonte)",
    };
  }

  // 3) Salário, pró-labore, honorários, aposentadoria/pensão → tributável.
  if (isSalaryCategory(cat) || isAposentadoriaCategory(cat)) {
    return {
      bucket: "tributavel",
      confidence: "alta",
      reason: "Rendimento do trabalho/aposentadoria (base progressiva)",
    };
  }

  // 4) Tem fonte pagadora cadastrada (CNPJ/CPF) → tributável por padrão.
  if (agg.hasPayer) {
    return {
      bucket: "tributavel",
      confidence: "alta",
      reason: "Fonte pagadora cadastrada (presumido tributável)",
    };
  }

  // 5) Dividendos explícitos → isento (cód. 09). A partir de 2026, a Lei
  //    15.270/25 institui IRRF de 10% sobre dividendos PJ→PF acima de
  //    R$ 50.000/mês por fonte — o motor não tem granularidade mensal/fonte
  //    pra decidir o split, então avisa pra o usuário/contador conferir.
  if (isDividendCategory(cat)) {
    const dividends2026 = (agg.year ?? 0) >= 2026;
    return {
      bucket: "isento",
      receitaCode: "09",
      confidence: dividends2026 ? "baixa" : "alta",
      reason: "Lucros e dividendos (isento)",
      warning: dividends2026
        ? {
            code: "dividendos_2026_irrf",
            severity: "atencao",
            message:
              "A partir de 2026 (Lei 15.270/25), dividendos acima de R$ 50.000/mês de uma mesma fonte têm IRRF de 10% e entram no imposto mínimo de altas rendas. Confira se há retenção a declarar — o app trata como isento por padrão.",
          }
        : undefined,
    };
  }

  // 6) "Renda passiva"/"rendimentos" GENÉRICO → naoClassificado. Antes caía em
  //    isento por includes("renda passiva"), mascarando aluguel como isento.
  if (isGenericPassiveCategory(cat)) {
    return {
      bucket: "naoClassificado",
      confidence: "baixa",
      reason: "Categoria genérica 'renda passiva' — precisa de classificação",
      warning: {
        code: "renda_passiva_generica",
        severity: "atencao",
        message:
          "Categoria 'Renda passiva' é genérica demais pro IR. Classifique: é aluguel (tributável), dividendos (isento) ou outro?",
      },
    };
  }

  // 7) CATCH-ALL fail-loud: desconhecido → fora da base + aviso. Nunca descarta.
  return {
    bucket: "naoClassificado",
    confidence: "baixa",
    reason: `Categoria desconhecida${cat ? ` ('${cat}')` : ""}`,
    warning: {
      code: "renda_nao_classificada",
      severity: "critico",
      message:
        "Esta renda não tem categoria reconhecida pelo IR e ficou FORA do cálculo. Classifique-a pra não subtributar.",
    },
  };
}
