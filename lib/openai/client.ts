import "server-only";
import OpenAI from "openai";

/**
 * Cliente OpenAI singleton — lê OPENAI_API_KEY do env.
 *
 * Pra ligar a feature de Document Inbox basta adicionar OPENAI_API_KEY no
 * .env.local (ou nos env vars do Vercel). Sem chave, isOpenAIConfigured()
 * retorna false e a UI deve esconder/desabilitar a funcionalidade.
 */

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY não configurado. Adicione no .env.local pra ativar o Inbox.",
    );
  }
  if (!cached) {
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cached;
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Modelo padrão (override via env se quiser). */
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/**
 * Preços do gpt-4o-mini (dez/2025): $0.150 / 1M input tokens,
 * $0.600 / 1M output tokens. Convertido pra centavos de R$ (USD→BRL ~5,5).
 * Atualizar se mudar o modelo padrão.
 */
const PRICE_PER_INPUT_TOKEN_CENTS = (0.15 / 1_000_000) * 100 * 5.5;
const PRICE_PER_OUTPUT_TOKEN_CENTS = (0.6 / 1_000_000) * 100 * 5.5;

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const cents =
    inputTokens * PRICE_PER_INPUT_TOKEN_CENTS +
    outputTokens * PRICE_PER_OUTPUT_TOKEN_CENTS;
  return Math.max(1, Math.round(cents));
}
