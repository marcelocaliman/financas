import "server-only";
import { z } from "zod";
import { getOpenAI, OPENAI_MODEL, estimateCostCents } from "@/lib/openai/client";
import {
  DOCUMENT_SCHEMAS,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type ExtractedData,
} from "./document-types";

/**
 * Chama OpenAI pra:
 *   1. Classificar o tipo de documento (fatura, holerite, etc.)
 *   2. Extrair os dados estruturados conforme o schema correspondente
 *
 * Pra PDFs e imagens, usa a API de Responses com input_image / file.
 * Pra CSV/texto, manda como texto direto no prompt.
 *
 * Retorna ExtractedData validado + métricas de uso (pra tracking de custo).
 */

export type ExtractionResult = {
  detected_type: DocumentType;
  data: ExtractedData["data"];
  usage: {
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    model: string;
    requestId: string | null;
  };
};

export type ExtractionError = {
  error: string;
  detail?: string;
};

const CLASSIFY_SYSTEM_PROMPT = `Você é um classificador de documentos financeiros brasileiros.

Analise o documento e retorne SOMENTE um JSON no formato:
{"type": "<tipo>"}

Tipos possíveis:
- "fatura_cartao": fatura de cartão de crédito (Visa/Mastercard/etc., lista de compras, total a pagar, vencimento)
- "holerite": contracheque/folha de pagamento com salário, INSS, IRRF, deduções
- "nota_corretagem": nota de negociação de ações/FIIs/ETFs (corretora, tickers, qty, preço)
- "recibo_medico": recibo de médico, dentista, psicólogo, hospital, plano de saúde
- "boleto": boleto bancário avulso (código de barras, beneficiário, vencimento, valor único)
- "extrato_bancario": extrato de conta corrente/poupança (período, movimentos, saldos)
- "outros": qualquer outra coisa

Retorne APENAS o JSON, sem markdown ou explicação.`;

const EXTRACT_SYSTEM_PROMPT = `Você é um extrator de dados de documentos financeiros brasileiros.

REGRAS CRÍTICAS DE FORMATAÇÃO:
- Datas SEMPRE no formato YYYY-MM-DD (ex: 2026-05-28). Converta de dd/mm/aaaa.
  Se o documento mostrar só dd/mm sem ano, assume o ano do contexto.
- Valores monetários: número JSON puro com ponto decimal.
  EXEMPLO: "R$ 1.234,56" → 1234.56 (sem símbolo, sem ponto de milhar, ponto como decimal).
  "R$ -16.416,79" → -16416.79.

DETECÇÃO DE MOEDA (campo "currency" em vários schemas):
- BRL: "R$", banco BR (Itaú, Bradesco, XP), CNPJ brasileiro
- USD: "US$", "$", "USD", Interactive Brokers, Wise USD, Bank of America, Chase
- EUR: "€", "EUR", banco europeu, Wise EUR

CASO ESPECIAL: FATURA DE CARTÃO INTERNACIONAL (Visa Internacional, etc.)
A fatura em si é em BRL (o que vai descontar da conta), mas pode ter items
com origem em moeda estrangeira. Para esses items específicos:
  · amount = valor em BRL (o que aparece debitado)
  · original_amount = valor na moeda original
  · original_currency = "USD" ou "EUR"
Exemplo de linha: "AMAZON US$ 50,00 — R$ 275,00"
  → amount=275.00, original_amount=50.00, original_currency="USD"

NÃO faça conversão entre moedas — sempre extraia os valores que aparecem
escritos. A conversão é responsabilidade do app, não sua.

REGRAS POR TIPO:
- Fatura de cartão:
  · Cada compra é uma linha em items[].
  · Pagamento da fatura anterior (valor negativo, descrição tipo "Pagamento de fatura"
    ou "Crédito") → marque is_payment=true.
  · Estorno/devolução (valor negativo mas é compra cancelada) → amount fica
    negativo, is_payment=FALSE.
  · Parcelas: "3/6", "3 de 6", "PARC 3/6" → installment_current=3, installment_total=6.
  · Portador: leia o nome do portador do cartão se aparecer (pode estar em coluna
    separada ou na linha do estabelecimento).

- Holerite:
  · gross_salary = total de proventos (salário base + bônus + comissão + horas extras).
  · net_salary = total líquido depositado.
  · is_thirteenth = true SÓ se é folha de 13º (procure "13º", "decimo terceiro",
    "PARCELA 13"). Folha normal mensal = false.

- Nota corretagem:
  · operations[] = uma entrada por operação executada (não por trade).
  · side: "buy" pra compra (C), "sell" pra venda (V).
  · quantity em cotas, unit_price em R$ por cota.
  · ir_withheld só se mostrar IRRF retido explicitamente.

REGRAS GERAIS:
- Se um campo opcional não estiver visível, retorne null. NÃO invente.
- Se está em dúvida entre dois valores, prefira null e siga em frente.
- Retorne APENAS o JSON correspondente ao schema, sem markdown ou comentários.`;

/**
 * Pipeline completo: classify → extract → validate.
 *
 * `forceType`, se fornecido, pula a classificação por IA e usa o tipo
 * informado. Útil pra (a) re-extração com correção manual após a IA
 * errar, (b) upload com tipo escolhido pelo usuário.
 */
export async function extractDocument(args: {
  file: { content: Buffer; mimeType: string; name: string };
  forceType?: DocumentType;
}): Promise<ExtractionResult | ExtractionError> {
  const openai = getOpenAI();

  // ─── 1. Prepara o input pro OpenAI conforme o tipo de arquivo ───────────
  const input = await buildInput(args.file);
  if ("error" in input) return input;

  // ─── 2. Classifica o tipo ──────────────────────────────────────────────
  // Ordem de prioridade:
  //   a) forceType (override manual) — pula a IA
  //   b) hint do nome do arquivo — pula a IA também (alta confiança)
  //   c) IA classifica
  let detectedType: DocumentType;
  let classifyTokens = { prompt: 0, completion: 0 };

  const filenameHint = inferTypeFromFilename(args.file.name);

  if (args.forceType) {
    detectedType = args.forceType;
  } else if (filenameHint) {
    detectedType = filenameHint;
  } else {
    let classifyResp;
    try {
      classifyResp = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
          {
            role: "user",
            content: input.contentParts,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 50,
      });
    } catch (e) {
      return {
        error: "Falha ao classificar o documento na OpenAI.",
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    classifyTokens = {
      prompt: classifyResp.usage?.prompt_tokens ?? 0,
      completion: classifyResp.usage?.completion_tokens ?? 0,
    };

    const classifyContent = classifyResp.choices[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(classifyContent) as { type?: string };
      if (!parsed.type || !(parsed.type in DOCUMENT_SCHEMAS)) {
        detectedType = "outros";
      } else {
        detectedType = parsed.type as DocumentType;
      }
    } catch {
      detectedType = "outros";
    }
  }

  // ─── 3. Extrai dados conforme o schema do tipo ──────────────────────────
  const schema = DOCUMENT_SCHEMAS[detectedType];

  // Auto-retry: até 2 tentativas. Se a 1ª der JSON malformado ou falhar Zod,
  // refazemos com um "feedback" pedindo correção. Geralmente acerta na 2ª.
  let extractResp;
  let extractContent = "";
  let extractedRaw: unknown;
  let validated: ReturnType<typeof schema.safeParse> | null = null;
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const isRetry = attempt === 2;
    const extractPrompt = isRetry
      ? `Tipo: ${DOCUMENT_TYPE_LABELS[detectedType]}.

A tentativa anterior FALHOU: ${lastError}

Reextraia conforme o schema. Datas YYYY-MM-DD. Números puros (sem R$, sem milhar).
Retorne SOMENTE o JSON, nada mais.`
      : `Tipo identificado: ${DOCUMENT_TYPE_LABELS[detectedType]}.

Extraia os dados estruturados deste documento conforme o schema.`;

    try {
      extractResp = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: EXTRACT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [{ type: "text", text: extractPrompt }, ...input.contentParts],
          },
        ],
        response_format: zodResponseFormat(schema, detectedType),
        max_tokens: 8_000,
      });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt === 2) {
        return { error: "Falha ao extrair dados na OpenAI.", detail: lastError };
      }
      continue;
    }

    extractContent = extractResp.choices[0]?.message?.content ?? "{}";
    try {
      extractedRaw = JSON.parse(extractContent);
    } catch {
      lastError = "JSON malformado";
      if (attempt === 2) return { error: "OpenAI retornou JSON malformado após retry." };
      continue;
    }

    validated = schema.safeParse(extractedRaw);
    if (validated.success) break;
    lastError = validated.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    if (attempt === 2) {
      return { error: "Extração não passou na validação após retry.", detail: lastError };
    }
  }

  if (!validated || !validated.success || !extractResp) {
    return { error: "Falha desconhecida na extração." };
  }

  // ─── 4. Post-processing: cobre buracos comuns sem precisar de retry ─────
  const postProcessed = postProcess(detectedType, validated.data, args.file.name);

  // ─── 5. Métricas ────────────────────────────────────────────────────────
  const inputTokens =
    classifyTokens.prompt + (extractResp.usage?.prompt_tokens ?? 0);
  const outputTokens =
    classifyTokens.completion + (extractResp.usage?.completion_tokens ?? 0);

  return {
    detected_type: detectedType,
    data: postProcessed as ExtractedData["data"],
    usage: {
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(inputTokens, outputTokens),
      model: OPENAI_MODEL,
      requestId: extractResp.id ?? null,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Tenta inferir o tipo do documento pelo nome do arquivo. Quando bate,
 * pula a classificação por IA (mais barato + mais determinístico).
 *
 * Ordem de prioridade: padrões mais específicos primeiro. Não retornar
 * nada quando ambíguo (deixa a IA classificar).
 */
function inferTypeFromFilename(name: string): DocumentType | null {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos

  // Cartão de crédito
  if (/\bfatura\b/.test(n) || /\bcredit.card\b/.test(n)) return "fatura_cartao";

  // Holerite / contracheque
  if (/\bholerite\b/.test(n) || /\bcontracheque\b/.test(n) || /\bfolha.?(pagamento|pgto)\b/.test(n))
    return "holerite";

  // Boleto
  if (/\bboleto\b/.test(n) || /\bpagamento.?conta\b/.test(n)) return "boleto";

  // Recibo médico / saúde
  if (
    /\brecibo\b.*\b(medic|saude|dentist|psicolog|hospital|clinic)/.test(n) ||
    /\b(medic|saude|dentist|psicolog|hospital|clinic).*\brecibo\b/.test(n) ||
    /\bplano.?saude\b/.test(n) ||
    /\bnota.?fiscal.?(servic|medic|saude)/.test(n)
  )
    return "recibo_medico";

  // Nota de corretagem
  if (/\bnota.?(corretagem|negociac)\b/.test(n) || /\bnota.?neg\b/.test(n))
    return "nota_corretagem";

  // Extrato bancário
  if (/\bextrato\b/.test(n)) return "extrato_bancario";

  return null;
}

/**
 * Pós-processa o resultado da IA pra cobrir buracos comuns:
 *   - Fatura de cartão: se total=0 ou null, soma os itens não-pagamento
 *   - Fatura de cartão: se due_date é null, tenta extrair do nome do arquivo
 *     (padrões "Fatura2026-07-05", "fatura_05_07_2026", etc.)
 *
 * Determinístico, sem custo extra de IA.
 */
function postProcess(
  type: DocumentType,
  data: unknown,
  filename: string,
): unknown {
  if (type === "fatura_cartao" && data && typeof data === "object") {
    const d = data as Record<string, unknown>;

    // Total: se zero/null, soma items não-pagamento
    if ((d.total == null || Number(d.total) === 0) && Array.isArray(d.items)) {
      const sum = d.items
        .filter((i) => i && typeof i === "object" && !(i as { is_payment?: boolean }).is_payment)
        .reduce(
          (s, i) => s + Number((i as { amount?: number }).amount ?? 0),
          0,
        );
      if (Math.abs(sum) > 0.01) d.total = Math.round(sum * 100) / 100;
    }

    // Vencimento: extrai do filename se a IA não pegou
    if (!d.due_date) {
      const inferred = inferDateFromFilename(filename);
      if (inferred) d.due_date = inferred;
    }
  }
  return data;
}

/**
 * Procura YYYY-MM-DD, DD-MM-YYYY, DDMMYYYY etc. no nome do arquivo.
 * Retorna string ISO ou null.
 */
function inferDateFromFilename(name: string): string | null {
  // YYYY-MM-DD ou YYYY_MM_DD
  const iso = name.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    if (isValidDate(y, m, d)) return `${y}-${m}-${d}`;
  }
  // DD-MM-YYYY ou DD_MM_YYYY
  const br = name.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
  if (br) {
    const [, d, m, y] = br;
    if (isValidDate(y, m, d)) return `${y}-${m}-${d}`;
  }
  return null;
}

function isValidDate(y: string, m: string, d: string): boolean {
  const yi = Number(y);
  const mi = Number(m);
  const di = Number(d);
  return yi >= 2000 && yi <= 2100 && mi >= 1 && mi <= 12 && di >= 1 && di <= 31;
}


type InputContent = {
  contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

async function buildInput(file: {
  content: Buffer;
  mimeType: string;
  name: string;
}): Promise<InputContent | ExtractionError> {
  const { content, mimeType, name } = file;

  // CSV / texto: vai como texto puro
  if (mimeType.startsWith("text/") || mimeType.includes("csv")) {
    const text = content.toString("utf-8");
    if (text.length > 100_000) {
      return { error: "Arquivo texto muito grande (>100k chars). Reduza o conteúdo." };
    }
    return {
      contentParts: [
        {
          type: "text",
          text: `Arquivo: ${name}\nMIME: ${mimeType}\n\nConteúdo:\n\`\`\`\n${text}\n\`\`\``,
        },
      ],
    };
  }

  // Imagem: data URL inline
  if (mimeType.startsWith("image/")) {
    const base64 = content.toString("base64");
    return {
      contentParts: [
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
      ],
    };
  }

  // PDF: também vai como data URL (gpt-4o-mini aceita PDF como image_url)
  if (mimeType === "application/pdf") {
    const base64 = content.toString("base64");
    return {
      contentParts: [
        {
          type: "image_url",
          image_url: { url: `data:application/pdf;base64,${base64}` },
        },
      ],
    };
  }

  return { error: `MIME type não suportado: ${mimeType}` };
}

/**
 * Adapter pra usar Zod schema com response_format do OpenAI.
 * Reimplementação simplificada do helper da SDK (que tem signature
 * que muda entre versões — controlamos aqui).
 */
function zodResponseFormat<T extends z.ZodTypeAny>(
  schema: T,
  name: string,
): {
  type: "json_schema";
  json_schema: { name: string; schema: Record<string, unknown>; strict: false };
} {
  // z.toJSONSchema disponível no Zod 4
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  return {
    type: "json_schema",
    json_schema: {
      name,
      schema: jsonSchema,
      strict: false,
    },
  };
}
