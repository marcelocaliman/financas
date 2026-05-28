import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI, OPENAI_MODEL, estimateCostCents } from "@/lib/openai/client";

/**
 * Resumo mensal narrativo via IA.
 *
 * Diferença vs Insights determinísticos:
 *  - Insights são heurísticas curtas, sem custo, em formato "achado".
 *  - Narrative é uma carta editorial curta (3-5 parágrafos) que conecta
 *    rendimentos, despesas, padrões anômalos e dá uma leitura
 *    "do mês como história" — útil pra checagem reflexiva mensal.
 *
 * Roda 1×/mês via cron no dia 2 e envia email pro owner do household.
 * Idempotente: se já tem registro pra (household, mês), pula.
 */

const NarrativeSchema = z.object({
  title: z
    .string()
    .describe("Título curto e específico do mês (até 60 chars)"),
  lead: z
    .string()
    .describe("Frase de abertura (1 sentence) com o tom do mês"),
  paragraphs: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe(
      "2-5 parágrafos curtos (cada 2-4 frases) cobrindo: balanço geral, principais movimentos vs mês anterior, padrão anômalo se houver, recomendação prática.",
    ),
  closing: z
    .string()
    .describe(
      "Uma frase final reflexiva ou de ação. Evite clichês motivacionais; seja específico do mês.",
    ),
  highlights: z
    .array(
      z.object({
        label: z.string().describe("Métrica curta (ex: 'Receita', 'Maior alta')"),
        value: z.string().describe("Valor formatado (ex: 'R$ 18.500', '+R$ 450 mercado')"),
        tone: z
          .enum(["positive", "negative", "neutral"])
          .describe("Cor: positive=verde, negative=vermelho, neutral=cinza"),
      }),
    )
    .min(2)
    .max(5)
    .describe("2-5 highlights numéricos pra cabeçalho do email"),
});

export type MonthlyNarrative = z.infer<typeof NarrativeSchema>;

const SYSTEM_PROMPT = `Você escreve um resumo mensal pro usuário de um app de
finanças pessoais brasileiro. Tom: conciso, direto, com leve elegância
editorial (estilo The Economist em mini). NUNCA motivacional, NUNCA clichê.

Diretrizes:
- Use VOCÊ direto (não "o usuário").
- Fale em valores concretos (R$), não percentuais vagos.
- Quando comparar com mês anterior, mostre a direção e o motivo provável.
- Quando houver outlier, nomeie a categoria/conta envolvida.
- Evite jargão financeiro pesado. Seja claro como amigo CPA explicando.
- 2-5 parágrafos no MÁXIMO. Texto que cabe em 1 minuto de leitura.

Retorne SOMENTE JSON conforme schema, sem markdown.`;

type MonthlyData = {
  monthLabel: string;
  income: number;
  expense: number;
  net: number;
  prevIncome: number;
  prevExpense: number;
  prevNet: number;
  topCategoriesCurrent: Array<{ name: string; total: number }>;
  topMovers: Array<{ name: string; delta: number; previous: number; current: number }>;
  subscriptionsCount: number;
  subscriptionsMonthly: number;
};

export async function generateMonthlyNarrative(
  data: MonthlyData,
): Promise<
  | { ok: true; result: MonthlyNarrative; usage: { costCents: number } }
  | { ok: false; error: string }
> {
  const userPrompt = `Mês de referência: ${data.monthLabel}

== TOTAIS ==
Receitas: R$ ${data.income.toFixed(2)} (mês anterior R$ ${data.prevIncome.toFixed(2)})
Despesas: R$ ${data.expense.toFixed(2)} (mês anterior R$ ${data.prevExpense.toFixed(2)})
Saldo do mês: R$ ${data.net.toFixed(2)} (mês anterior R$ ${data.prevNet.toFixed(2)})

== TOP CATEGORIAS DE DESPESA (mês atual) ==
${data.topCategoriesCurrent.map((c) => `${c.name}: R$ ${c.total.toFixed(2)}`).join("\n") || "Nenhuma"}

== MAIORES MUDANÇAS VS MÊS ANTERIOR ==
${data.topMovers.map((m) => `${m.name}: ${m.delta >= 0 ? "+" : ""}R$ ${m.delta.toFixed(2)} (de R$ ${m.previous.toFixed(2)} pra R$ ${m.current.toFixed(2)})`).join("\n") || "Nenhuma"}

== ASSINATURAS ATIVAS ==
${data.subscriptionsCount} assinaturas, total R$ ${data.subscriptionsMonthly.toFixed(2)}/mês

Gere o resumo narrativo do mês. Lembre: específico, sem clichê, no máximo 5 parágrafos curtos.`;

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
          name: "monthly_narrative",
          schema: z.toJSONSchema(NarrativeSchema, { target: "draft-7" }) as Record<
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

  const validated = NarrativeSchema.safeParse(parsed);
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

/**
 * Coleta os dados de um household pra um mês específico (YYYY-MM).
 * Usa admin client porque roda no cron (sem sessão de user).
 */
export async function collectMonthlyData(
  householdId: string,
  monthStr: string,
): Promise<MonthlyData> {
  const admin = createAdminClient();

  const [y, m] = monthStr.split("-").map(Number);
  const from = `${monthStr}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const prevFrom = `${prevMonth}-01`;
  const prevLastDay = new Date(
    Date.UTC(prevDate.getUTCFullYear(), prevDate.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const prevTo = `${prevMonth}-${String(prevLastDay).padStart(2, "0")}`;

  type Tx = {
    kind: string;
    amount_account: number | string;
    date: string;
    category: { name: string } | null;
  };
  type RecRule = { amount: number | string; frequency: string; interval_count: number };

  const [{ data: cur }, { data: prev }, { data: subs }] = await Promise.all([
    (
      admin.from as unknown as (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: unknown) => {
            gte: (c: string, v: unknown) => {
              lte: (c: string, v: unknown) => {
                in: (c: string, v: string[]) => Promise<{ data: Tx[] | null }>;
              };
            };
          };
        };
      }
    )("transactions")
      .select("kind, amount_account, date, category:categories(name)")
      .eq("household_id", householdId)
      .gte("date", from)
      .lte("date", to)
      .in("kind", ["income", "expense"]),
    (
      admin.from as unknown as (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: unknown) => {
            gte: (c: string, v: unknown) => {
              lte: (c: string, v: unknown) => {
                in: (c: string, v: string[]) => Promise<{ data: Tx[] | null }>;
              };
            };
          };
        };
      }
    )("transactions")
      .select("kind, amount_account, date, category:categories(name)")
      .eq("household_id", householdId)
      .gte("date", prevFrom)
      .lte("date", prevTo)
      .in("kind", ["income", "expense"]),
    (
      admin.from as unknown as (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => {
              contains: (c: string, v: string[]) => Promise<{ data: RecRule[] | null }>;
            };
          };
        };
      }
    )("recurring_rules")
      .select("amount, frequency, interval_count")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .contains("tags", ["subscription"]),
  ]);

  const sum = (rows: Tx[] | null, kind: "income" | "expense") =>
    (rows ?? [])
      .filter((r) => r.kind === kind)
      .reduce((s, r) => s + Number(r.amount_account), 0);

  const income = sum(cur, "income");
  const expense = sum(cur, "expense");
  const prevIncome = sum(prev, "income");
  const prevExpense = sum(prev, "expense");

  // Top categorias do mês atual
  const curByCat = new Map<string, number>();
  for (const t of cur ?? []) {
    if (t.kind !== "expense") continue;
    const name = t.category?.name ?? "Sem categoria";
    curByCat.set(name, (curByCat.get(name) ?? 0) + Number(t.amount_account));
  }
  const topCategoriesCurrent = Array.from(curByCat.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Movers vs anterior
  const prevByCat = new Map<string, number>();
  for (const t of prev ?? []) {
    if (t.kind !== "expense") continue;
    const name = t.category?.name ?? "Sem categoria";
    prevByCat.set(name, (prevByCat.get(name) ?? 0) + Number(t.amount_account));
  }
  const allCats = new Set([...curByCat.keys(), ...prevByCat.keys()]);
  const movers: Array<{ name: string; delta: number; previous: number; current: number }> = [];
  for (const name of allCats) {
    const c = curByCat.get(name) ?? 0;
    const p = prevByCat.get(name) ?? 0;
    const delta = c - p;
    if (Math.abs(delta) < 50) continue;
    movers.push({ name, delta, previous: p, current: c });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topMovers = movers.slice(0, 5);

  // Assinaturas mensais equivalente
  const monthlyEquiv = (amount: number, freq: string, interval: number) => {
    if (freq === "monthly") return amount / Math.max(interval, 1);
    if (freq === "weekly") return (amount * 52) / 12 / Math.max(interval, 1);
    if (freq === "yearly") return amount / 12 / Math.max(interval, 1);
    if (freq === "daily") return (amount * 30) / Math.max(interval, 1);
    return amount;
  };
  const subscriptionsMonthly = (subs ?? []).reduce(
    (s, r) => s + monthlyEquiv(Number(r.amount), r.frequency, r.interval_count),
    0,
  );

  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return {
    monthLabel: monthName,
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    net: Math.round((income - expense) * 100) / 100,
    prevIncome: Math.round(prevIncome * 100) / 100,
    prevExpense: Math.round(prevExpense * 100) / 100,
    prevNet: Math.round((prevIncome - prevExpense) * 100) / 100,
    topCategoriesCurrent,
    topMovers,
    subscriptionsCount: (subs ?? []).length,
    subscriptionsMonthly: Math.round(subscriptionsMonthly * 100) / 100,
  };
}
