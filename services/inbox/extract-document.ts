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
- Valores monetários: número JSON puro em reais, com ponto decimal.
  EXEMPLO: "R$ 1.234,56" → 1234.56 (sem R$, sem ponto de milhar, ponto como decimal).
  "R$ -16.416,79" → -16416.79.
- Se ver "USD", "US$", "EUR", "€" no documento, MENTA assim mesmo nos valores
  (não converta) — mas avise no resumo se for tipo "outros".

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
 */
export async function extractDocument(args: {
  file: { content: Buffer; mimeType: string; name: string };
}): Promise<ExtractionResult | ExtractionError> {
  const openai = getOpenAI();

  // ─── 1. Prepara o input pro OpenAI conforme o tipo de arquivo ───────────
  const input = await buildInput(args.file);
  if ("error" in input) return input;

  // ─── 2. Classifica o tipo ─────────────────────────────────────────────
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

  const classifyContent = classifyResp.choices[0]?.message?.content ?? "{}";
  let detectedType: DocumentType;
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

  // ─── 5. Métricas ────────────────────────────────────────────────────────
  const inputTokens =
    (classifyResp.usage?.prompt_tokens ?? 0) + (extractResp.usage?.prompt_tokens ?? 0);
  const outputTokens =
    (classifyResp.usage?.completion_tokens ?? 0) +
    (extractResp.usage?.completion_tokens ?? 0);

  return {
    detected_type: detectedType,
    data: validated.data as ExtractedData["data"],
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
