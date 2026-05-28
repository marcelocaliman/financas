import { z } from "zod";

/**
 * Schemas Zod por tipo de documento.
 *
 * A IA extrai os dados estruturados conforme o schema correspondente ao
 * `detected_type`. O caller valida com Zod antes de salvar — se a IA
 * inventar campos ou tipos errados, falha aqui em vez de corromper dados.
 *
 * Cada schema é projetado pra mapear DIRETO nas tabelas de destino:
 * fatura_cartao → transactions, holerite → transactions + ir_other_incomes,
 * etc. (a aplicação fica em services/inbox/appliers/).
 */

// ─── Tipos suportados ───────────────────────────────────────────────────────
export const DOCUMENT_TYPES = [
  "fatura_cartao",
  "holerite",
  "nota_corretagem",
  "recibo_medico",
  "boleto",
  "extrato_bancario",
  "outros",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  fatura_cartao: "Fatura de cartão",
  holerite: "Holerite",
  nota_corretagem: "Nota de corretagem",
  recibo_medico: "Recibo médico / odonto",
  boleto: "Boleto",
  extrato_bancario: "Extrato bancário",
  outros: "Outros / desconhecido",
};

// ─── FATURA DE CARTÃO ───────────────────────────────────────────────────────
export const FaturaCartaoSchema = z.object({
  card_brand: z.string().nullable().describe("Bandeira ou banco (ex: 'XP', 'Itaú')"),
  card_last_digits: z.string().nullable().describe("Últimos 4 dígitos do cartão, se visível"),
  period_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Início do período (YYYY-MM-DD)"),
  period_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Fim do período / data de fechamento (YYYY-MM-DD)"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Data de vencimento (YYYY-MM-DD)"),
  total: z.number().describe("Valor total a pagar"),
  items: z
    .array(
      z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Data da compra (YYYY-MM-DD)"),
        description: z.string().describe("Nome do estabelecimento como está na fatura"),
        amount: z.number().describe("Valor positivo (compra) ou negativo (estorno/pagamento)"),
        portador: z
          .string()
          .nullable()
          .describe("Nome do portador do cartão (titular ou adicional)"),
        installment_current: z
          .number()
          .nullable()
          .describe("Parcela atual (ex: 3 em '3/6')"),
        installment_total: z
          .number()
          .nullable()
          .describe("Total de parcelas (ex: 6 em '3/6')"),
        is_payment: z
          .boolean()
          .describe(
            "True se for pagamento da fatura anterior (não é gasto novo, IGNORAR no aplicar)",
          ),
      }),
    )
    .describe("Cada linha de compra da fatura"),
});
export type FaturaCartao = z.infer<typeof FaturaCartaoSchema>;

// ─── HOLERITE ───────────────────────────────────────────────────────────────
export const HoleriteSchema = z.object({
  payer_name: z.string().describe("Nome da empresa empregadora"),
  payer_cnpj: z.string().nullable().describe("CNPJ da empresa (com formatação)"),
  employee_name: z.string().describe("Nome do funcionário"),
  competence_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .describe("Mês de competência (YYYY-MM)"),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Data do pagamento (YYYY-MM-DD)"),
  gross_salary: z.number().describe("Salário bruto antes de descontos"),
  inss_retained: z.number().describe("INSS retido pela empresa"),
  irrf_retained: z.number().describe("IRRF retido pela empresa"),
  other_deductions: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number(),
      }),
    )
    .describe("Outras deduções (plano saúde, vale-transporte, adiantamento, etc.)"),
  net_salary: z.number().describe("Salário líquido (o que cai na conta)"),
  is_thirteenth: z
    .boolean()
    .describe("True se for 13º salário (parcela única ou 2 parcelas)"),
});
export type Holerite = z.infer<typeof HoleriteSchema>;

// ─── NOTA DE CORRETAGEM ─────────────────────────────────────────────────────
export const NotaCorretagemSchema = z.object({
  broker_name: z.string().describe("Nome da corretora (ex: 'XP Investimentos')"),
  broker_cnpj: z.string().nullable().describe("CNPJ da corretora"),
  trade_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Data do pregão (YYYY-MM-DD)"),
  settlement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Data de liquidação D+2 (YYYY-MM-DD)"),
  operations: z
    .array(
      z.object({
        ticker: z.string().describe("Código do ativo (ex: PETR4, BBAS3, HGLG11)"),
        side: z.enum(["buy", "sell"]).describe("Compra ou venda"),
        quantity: z.number().describe("Quantidade de cotas"),
        unit_price: z.number().describe("Preço unitário em R$"),
        gross_total: z.number().describe("Valor bruto (quantidade × preço unitário)"),
        fees: z.number().describe("Taxas e emolumentos rateados"),
        net_total: z.number().describe("Valor líquido da operação"),
        ir_withheld: z
          .number()
          .nullable()
          .describe("IR retido pela corretora (se aplicável, ex: 1% day-trade)"),
      }),
    )
    .describe("Operações individuais da nota"),
  total_fees: z.number().describe("Soma de todas as taxas e emolumentos"),
  irrf_total: z.number().nullable().describe("IRRF total retido na nota"),
});
export type NotaCorretagem = z.infer<typeof NotaCorretagemSchema>;

// ─── RECIBO MÉDICO / ODONTO ─────────────────────────────────────────────────
export const ReciboMedicoSchema = z.object({
  provider_name: z.string().describe("Nome do profissional ou clínica"),
  provider_cnpj_cpf: z
    .string()
    .nullable()
    .describe("CNPJ ou CPF do prestador (com formatação)"),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Data do pagamento (YYYY-MM-DD)"),
  amount: z.number().describe("Valor pago"),
  kind: z
    .enum([
      "medico",
      "dentista",
      "psicologo",
      "hospital",
      "plano_saude",
      "fisioterapia",
      "exames",
      "outros_saude",
    ])
    .describe("Categoria do gasto pra IR"),
  patient_name: z
    .string()
    .nullable()
    .describe("Nome do paciente (titular ou dependente)"),
  description: z
    .string()
    .describe("Descrição do procedimento ou serviço"),
});
export type ReciboMedico = z.infer<typeof ReciboMedicoSchema>;

// ─── BOLETO ─────────────────────────────────────────────────────────────────
export const BoletoSchema = z.object({
  payee_name: z.string().describe("Beneficiário (quem recebe)"),
  payee_cnpj_cpf: z.string().nullable().describe("CNPJ ou CPF do beneficiário"),
  amount: z.number().describe("Valor a pagar"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Data de vencimento (YYYY-MM-DD)"),
  barcode: z.string().nullable().describe("Código de barras (47 dígitos)"),
  description: z.string().describe("Descrição / referência do boleto"),
});
export type Boleto = z.infer<typeof BoletoSchema>;

// ─── EXTRATO BANCÁRIO ───────────────────────────────────────────────────────
export const ExtratoBancarioSchema = z.object({
  bank_name: z.string().describe("Nome do banco"),
  account_holder: z.string().nullable().describe("Titular da conta"),
  account_number: z.string().nullable().describe("Número da conta"),
  period_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Início do período (YYYY-MM-DD)"),
  period_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Fim do período (YYYY-MM-DD)"),
  opening_balance: z.number().describe("Saldo inicial do período"),
  closing_balance: z.number().describe("Saldo final do período"),
  movements: z
    .array(
      z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Data do movimento (YYYY-MM-DD)"),
        description: z.string().describe("Descrição como está no extrato"),
        amount: z.number().describe("Valor (positivo = entrada, negativo = saída)"),
        kind: z
          .enum(["income", "expense", "transfer", "fee", "interest"])
          .describe("Categoria do movimento"),
      }),
    )
    .describe("Movimentos do período"),
});
export type ExtratoBancario = z.infer<typeof ExtratoBancarioSchema>;

// ─── OUTROS (genérico, AI tenta extrair best-effort) ────────────────────────
export const OutrosSchema = z.object({
  summary: z.string().describe("Resumo curto do que o documento parece ser"),
  key_facts: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("Fatos chave extraídos (datas, valores, nomes)"),
});
export type Outros = z.infer<typeof OutrosSchema>;

// ─── Map: type → schema ─────────────────────────────────────────────────────
export const DOCUMENT_SCHEMAS = {
  fatura_cartao: FaturaCartaoSchema,
  holerite: HoleriteSchema,
  nota_corretagem: NotaCorretagemSchema,
  recibo_medico: ReciboMedicoSchema,
  boleto: BoletoSchema,
  extrato_bancario: ExtratoBancarioSchema,
  outros: OutrosSchema,
} as const;

export type ExtractedData =
  | { type: "fatura_cartao"; data: FaturaCartao }
  | { type: "holerite"; data: Holerite }
  | { type: "nota_corretagem"; data: NotaCorretagem }
  | { type: "recibo_medico"; data: ReciboMedico }
  | { type: "boleto"; data: Boleto }
  | { type: "extrato_bancario"; data: ExtratoBancario }
  | { type: "outros"; data: Outros };
