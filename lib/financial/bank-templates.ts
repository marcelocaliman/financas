/**
 * Fingerprints de CSVs comuns dos bancos brasileiros.
 *
 * Quando o usuário sobe um CSV, comparamos o header com cada template;
 * se bater, sugerimos o mapping de colunas automaticamente — economiza
 * cliques. Se não bater, cai no fluxo manual de mapeamento.
 *
 * Adicionar novo banco: crie um BankTemplate e adicione a BANK_TEMPLATES.
 */

export type ColumnMapping = {
  date: string;
  description: string;
  amount: string;
  /** Coluna pra portador (Marcelo/Aline) em CSVs de cartão. */
  cardholder?: string;
  /** Coluna pra parcela (ex: "5 de 10") em CSVs de cartão. */
  installment?: string;
  /** Quando o CSV separa debit/credit em colunas distintas. */
  debit?: string;
  credit?: string;
};

export type BankTemplate = {
  /** Identificador legível pra UI. */
  bank: string;
  /** Sufixo opcional ("Fatura cartão" vs "Extrato CC"). */
  product?: string;
  /** Separador esperado (, ou ;). */
  delimiter: "," | ";";
  /** Headers obrigatórios — todos devem estar presentes pra dar match. */
  headerRequired: string[];
  /** Mapeamento padrão de colunas. */
  mapping: ColumnMapping;
  /** Default kind pra cada linha (cartão = expense default; extrato = inferir do sinal). */
  defaultKind?: "expense" | "income" | "infer_from_sign";
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export const BANK_TEMPLATES: BankTemplate[] = [
  // C6 — fatura cartão (modelo que vc usa)
  {
    bank: "C6 Bank",
    product: "Fatura cartão",
    delimiter: ";",
    headerRequired: ["data", "estabelecimento", "portador", "valor"],
    mapping: {
      date: "data",
      description: "estabelecimento",
      amount: "valor",
      cardholder: "portador",
      installment: "parcela",
    },
    defaultKind: "expense",
  },
  // Nubank — extrato CSV
  {
    bank: "Nubank",
    product: "Extrato conta",
    delimiter: ",",
    headerRequired: ["data", "descricao", "valor"],
    mapping: {
      date: "data",
      description: "descricao",
      amount: "valor",
    },
    defaultKind: "infer_from_sign",
  },
  // Nubank — fatura cartão
  {
    bank: "Nubank",
    product: "Fatura cartão",
    delimiter: ",",
    headerRequired: ["date", "title", "amount"],
    mapping: {
      date: "date",
      description: "title",
      amount: "amount",
    },
    defaultKind: "expense",
  },
  // Itaú — extrato
  {
    bank: "Itaú",
    product: "Extrato conta",
    delimiter: ";",
    headerRequired: ["data", "lancamento", "valor"],
    mapping: {
      date: "data",
      description: "lancamento",
      amount: "valor",
    },
    defaultKind: "infer_from_sign",
  },
  // Bradesco — extrato (formato típico)
  {
    bank: "Bradesco",
    product: "Extrato conta",
    delimiter: ";",
    headerRequired: ["data", "historico"],
    mapping: {
      date: "data",
      description: "historico",
      amount: "valor",
      debit: "debito",
      credit: "credito",
    },
    defaultKind: "infer_from_sign",
  },
  // Banco do Brasil
  {
    bank: "Banco do Brasil",
    product: "Extrato conta",
    delimiter: ";",
    headerRequired: ["data", "historico", "valor"],
    mapping: {
      date: "data",
      description: "historico",
      amount: "valor",
    },
    defaultKind: "infer_from_sign",
  },
  // XP Investimentos — extrato de movimentação
  {
    bank: "XP Investimentos",
    product: "Movimentação",
    delimiter: ";",
    headerRequired: ["data", "movimentacao", "valor"],
    mapping: {
      date: "data",
      description: "movimentacao",
      amount: "valor",
    },
    defaultKind: "infer_from_sign",
  },
  // Inter — extrato
  {
    bank: "Inter",
    product: "Extrato conta",
    delimiter: ";",
    headerRequired: ["data lancamento", "historico", "valor"],
    mapping: {
      date: "data lancamento",
      description: "historico",
      amount: "valor",
    },
    defaultKind: "infer_from_sign",
  },
];

/**
 * Tenta detectar qual banco gerou o CSV baseado nos headers.
 * Retorna o template casado OU null se nenhum bate.
 */
export function detectBankTemplate(headers: string[]): BankTemplate | null {
  const normalized = headers.map(normalize);
  for (const tpl of BANK_TEMPLATES) {
    const allPresent = tpl.headerRequired.every((req) =>
      normalized.includes(normalize(req)),
    );
    if (allPresent) return tpl;
  }
  return null;
}
