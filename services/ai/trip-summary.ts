import "server-only";
import { z } from "zod";
import { getOpenAI, OPENAI_MODEL, estimateCostCents } from "@/lib/openai/client";
import { getTripSummary } from "@/services/trips";
import { createClient } from "@/lib/supabase/server";

/**
 * Resumo narrativo de uma viagem concluída via IA. Lê o orçamento real,
 * gastos por categoria e principais transações pra gerar uma "carta editorial"
 * sobre a viagem — onde gastou mais, onde economizou, padrões.
 */

const TripNarrativeSchema = z.object({
  title: z
    .string()
    .describe("Título curto e específico (até 60 chars). Ex: 'Lisboa em outubro: comida foi a estrela'"),
  lead: z
    .string()
    .describe("Frase de abertura (1 sentence) capturando o tom geral da viagem"),
  paragraphs: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "2-4 parágrafos curtos cobrindo: balanço financeiro (vs orçado), principal categoria de gasto, surpresas/anomalias, lembrança/observação útil pra próxima viagem.",
    ),
  highlights: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        tone: z.enum(["positive", "negative", "neutral"]),
      }),
    )
    .min(2)
    .max(4)
    .describe("2-4 highlights numéricos (ex: 'Maior categoria', 'Sobra final', 'Mais caro')"),
});

export type TripNarrative = z.infer<typeof TripNarrativeSchema>;

const SYSTEM_PROMPT = `Você escreve um resumo de viagem pessoal estilo
editorial — tom conciso, observacional, sem clichê turístico. NUNCA fale
'que viagem incrível!' ou frases motivacionais vazias.

Diretrizes:
- VOCÊ direto (não 'o viajante').
- Use valores concretos na moeda da viagem.
- Quando comparar realizado vs orçado, mostre direção e magnitude.
- Identifique a categoria dominante e contextualize.
- 2-4 parágrafos no máximo. Texto que cabe em 1 minuto de leitura.
- Se houver outlier (ex: hotel que estourou 200%), nomeie.

Retorne SOMENTE JSON conforme schema. Sem markdown.`;

export async function generateTripNarrative(
  tripId: string,
): Promise<
  | { ok: true; result: TripNarrative; usage: { costCents: number } }
  | { ok: false; error: string }
> {
  const summary = await getTripSummary(tripId);
  if (!summary) return { ok: false, error: "Viagem não encontrada." };

  // Carrega top transações pra contextualizar
  const supabase = await createClient();
  type TxLite = {
    description: string;
    amount: number | string;
    currency: string;
    category: { name: string } | null;
  };
  const { data: topTxs } = await (
    supabase.from as unknown as (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          order: (c: string, opts?: Record<string, unknown>) => {
            limit: (n: number) => Promise<{ data: TxLite[] | null }>;
          };
        };
      };
    }
  )("transactions")
    .select("description, amount, currency, category:categories(name)")
    .eq("trip_id", tripId)
    .order("amount", { ascending: false })
    .limit(10);

  const topLines = (topTxs ?? [])
    .map((t) => {
      const cat = t.category?.name ?? "—";
      return `${cat}|${t.description.slice(0, 40)}|${t.currency} ${Number(t.amount).toFixed(2)}`;
    })
    .join("\n");

  const trip = summary.trip;
  const userPrompt = `Viagem: ${trip.name}
Destino: ${trip.destination}
Datas: ${trip.start_date ?? "?"} → ${trip.end_date ?? "?"}
Moeda: ${trip.default_currency}

== ORÇAMENTO POR CATEGORIA ==
${summary.budgetByCategory
  .map(
    (b) =>
      `${b.category}: planejado ${b.planned.toFixed(2)} | realizado ${b.actual.toFixed(2)} | dif ${(b.actual - b.planned).toFixed(2)}`,
  )
  .join("\n") || "Sem orçamento"}

== TOTAIS ==
Planejado total: ${summary.totalPlanned.toFixed(2)} ${trip.default_currency}
Realizado total: ${summary.totalActual.toFixed(2)} ${trip.default_currency}
Diferença: ${(summary.totalActual - summary.totalPlanned).toFixed(2)} ${trip.default_currency}
${summary.txCount} transações

== TOP 10 TRANSAÇÕES (maior valor primeiro) ==
${topLines || "Nenhuma"}

Gere o resumo editorial conforme schema.`;

  const openai = getOpenAI();
  let resp;
  try {
    resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "trip_narrative",
          schema: z.toJSONSchema(TripNarrativeSchema, { target: "draft-7" }) as Record<
            string,
            unknown
          >,
          strict: false,
        },
      },
      max_tokens: 2_000,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Falha na OpenAI: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const content = resp.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: "Resposta da IA malformada." };
  }

  const validated = TripNarrativeSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: `Schema inválido: ${validated.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const inputTokens = resp.usage?.prompt_tokens ?? 0;
  const outputTokens = resp.usage?.completion_tokens ?? 0;

  return {
    ok: true,
    result: validated.data,
    usage: { costCents: estimateCostCents(inputTokens, outputTokens) },
  };
}
