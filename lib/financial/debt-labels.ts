import type { DebtKind } from "@/types/database";

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  financiamento_imovel: "Financiamento de imóvel",
  financiamento_veiculo: "Financiamento de veículo",
  emprestimo_pessoal: "Empréstimo pessoal / consignado",
  emprestimo_cheque_especial: "Cheque especial",
  emprestimo_cartao_credito: "Rotativo de cartão (fatura não paga)",
  parcelamento_cartao: "Compra parcelada no cartão",
  emprestimo_pj: "Empréstimo de/para PJ",
  emprestimo_pessoa_fisica: "Empréstimo de/para PF",
  outros: "Outras dívidas",
};
