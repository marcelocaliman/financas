import type { GoalType } from "@/types/database";

/** Ícone (emoji) por tipo de meta — leitura visual rápida no card. */
export const GOAL_TYPE_ICONS: Record<GoalType, string> = {
  emergencia: "🛟",
  casa: "🏠",
  veiculo: "🚗",
  viagem: "✈️",
  aposentadoria: "🏖️",
  educacao: "🎓",
  projeto: "💡",
  outro: "🎯",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergencia: "Reserva de emergência",
  casa: "Casa / Imóvel",
  veiculo: "Veículo",
  viagem: "Viagem",
  aposentadoria: "Aposentadoria",
  educacao: "Educação",
  projeto: "Projeto",
  outro: "Outro",
};

export const GOAL_TYPE_DESCRIPTIONS: Record<GoalType, string> = {
  emergencia: "6× a despesa fixa mensal — colchão pra emergências",
  casa: "Entrada, financiamento, reforma",
  veiculo: "Compra à vista, entrada, troca",
  viagem: "Roteiro, passagens, hospedagem",
  aposentadoria: "25× a despesa anual (regra dos 4%)",
  educacao: "Faculdade, MBA, cursos",
  projeto: "Empresa, hobby ambicioso, instrumento",
  outro: "Qualquer outro objetivo",
};
