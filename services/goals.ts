import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { getLiveBalanceMap } from "@/services/live-yield";
import type {
  Currency,
  GoalAllocationMode,
  GoalType,
  Tables,
} from "@/types/database";

export type Goal = Tables<"goals"> & {
  account?: Pick<Tables<"accounts">, "id" | "name" | "current_balance"> | null;
};

export type GoalSource = Tables<"goal_sources">;
export type GoalContribution = Tables<"goal_contributions">;

/**
 * Meta enriquecida com cálculo "live" das fontes vinculadas.
 *
 *  - `sources`: linhas brutas de goal_sources
 *  - `sourcesResolved`: cada fonte com nome amigável + saldo atual da fonte
 *    (live) + valor atualmente "earmarked" pra essa meta
 *  - `derivedCurrent`: soma dos earmarks live + current_amount manual snapshot.
 *    É o saldo "real" que o usuário vê no card.
 *  - `status`: derivado do progresso vs target_date (adiantada/no_ritmo/atrasada/concluida)
 */
export type EnrichedGoal = Goal & {
  sources: GoalSource[];
  sourcesResolved: Array<{
    source: GoalSource;
    label: string;
    sourceBalance: number; // saldo atual da fonte (live), em moeda da meta
    earmarked: number; // o que efetivamente conta pra meta (R$, em moeda da meta)
  }>;
  derivedCurrent: number;
  status: "concluida" | "adiantada" | "no_ritmo" | "atrasada" | "neutro";
};

export async function listGoals(opts?: { includeArchived?: boolean }): Promise<Goal[]> {
  const supabase = await createClient();
  let q = supabase
    .from("goals")
    .select("*, account:accounts(id,name,current_balance)")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });
  if (!opts?.includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Goal[];
}

/**
 * Versão enriquecida — para cada meta carrega goal_sources + resolve com
 * saldos live das contas/investimentos vinculados. Centraliza o cálculo do
 * `derivedCurrent` que substitui o uso direto de `goals.current_amount` na UI.
 *
 * `goals.current_amount` continua existindo como SNAPSHOT — sobe quando o
 * usuário registra uma contribuição manual e cobre o caso "essa meta não
 * tem fonte, é só um número". Pra metas com fontes, o derivedCurrent vence.
 */
export async function listGoalsEnriched(opts?: {
  includeArchived?: boolean;
}): Promise<EnrichedGoal[]> {
  const supabase = await createClient();
  const goals = await listGoals(opts);
  if (goals.length === 0) return [];

  const goalIds = goals.map((g) => g.id);
  const [{ data: rawSources }, displayCurrency, rates, { map: liveAssetBalance }] =
    await Promise.all([
      supabase
        .from("goal_sources")
        .select("*")
        .in("goal_id", goalIds),
      getDisplayCurrency(),
      getRateMap(),
      getLiveBalanceMap(),
    ]);

  const sourcesByGoal = new Map<string, GoalSource[]>();
  for (const s of (rawSources ?? []) as GoalSource[]) {
    const arr = sourcesByGoal.get(s.goal_id) ?? [];
    arr.push(s);
    sourcesByGoal.set(s.goal_id, arr);
  }

  // Pre-fetch accounts e investments envolvidos pra resolver label + saldo
  const accountSourceIds = new Set<string>();
  const investmentSourceIds = new Set<string>();
  for (const s of (rawSources ?? []) as GoalSource[]) {
    if (s.source_type === "account" && s.source_id) accountSourceIds.add(s.source_id);
    if (s.source_type === "investment" && s.source_id) investmentSourceIds.add(s.source_id);
  }

  const [accountsRes, investmentsRes] = await Promise.all([
    accountSourceIds.size > 0
      ? supabase
          .from("accounts")
          .select("id, name, institution, currency, current_balance")
          .in("id", Array.from(accountSourceIds))
      : Promise.resolve({ data: [] }),
    investmentSourceIds.size > 0
      ? supabase
          .from("investments")
          .select("id, ticker, name, currency")
          .in("id", Array.from(investmentSourceIds))
      : Promise.resolve({ data: [] }),
  ]);

  type AccLite = {
    id: string;
    name: string;
    institution: string;
    currency: Currency;
    current_balance: number;
  };
  type InvLite = { id: string; ticker: string; name: string; currency: Currency };
  const accountById = new Map<string, AccLite>(
    ((accountsRes.data ?? []) as AccLite[]).map((a) => [a.id, a]),
  );
  const investmentById = new Map<string, InvLite>(
    ((investmentsRes.data ?? []) as InvLite[]).map((i) => [i.id, i]),
  );

  return goals.map((g): EnrichedGoal => {
    const sources = sourcesByGoal.get(g.id) ?? [];
    const goalCurrency = g.currency;

    const resolved = sources.map((s) => {
      let label = "—";
      let sourceBalance = 0;
      let earmarked = 0;

      if (s.source_type === "manual") {
        label = s.notes ?? "Aporte manual";
        sourceBalance = Number(s.allocated_amount ?? 0);
        earmarked = convertOrSame(
          Number(s.allocated_amount ?? 0),
          // Snapshot manual fica em moeda da meta — sem conversão extra
          goalCurrency,
          goalCurrency,
          rates,
        );
      } else if (s.source_type === "account" && s.source_id) {
        const acc = accountById.get(s.source_id);
        if (acc) {
          label = `${acc.name} · ${acc.institution}`;
          const nativeBalance = Number(acc.current_balance ?? 0);
          sourceBalance = convertOrSame(nativeBalance, acc.currency, goalCurrency, rates);
          // allocated_pct prevalece se setado, senão allocated_amount
          if (s.allocated_pct != null) {
            earmarked = sourceBalance * Number(s.allocated_pct);
          } else {
            earmarked = Math.min(
              sourceBalance,
              convertOrSame(Number(s.allocated_amount ?? 0), acc.currency, goalCurrency, rates),
            );
          }
        }
      } else if (s.source_type === "investment" && s.source_id) {
        const inv = investmentById.get(s.source_id);
        if (inv) {
          label = `${inv.ticker} · ${inv.name}`;
          // liveAssetBalance é em displayCurrency. Converte pra moeda da meta.
          const inDisplay = liveAssetBalance.get(s.source_id) ?? 0;
          sourceBalance = convertOrSame(inDisplay, displayCurrency, goalCurrency, rates);
          if (s.allocated_pct != null) {
            earmarked = sourceBalance * Number(s.allocated_pct);
          } else {
            // Sources com R$ fixo: usa moeda do ativo, converte pra goal
            earmarked = Math.min(
              sourceBalance,
              convertOrSame(Number(s.allocated_amount ?? 0), inv.currency, goalCurrency, rates),
            );
          }
        }
      }

      return {
        source: s,
        label,
        sourceBalance: Math.round(sourceBalance * 100) / 100,
        earmarked: Math.round(earmarked * 100) / 100,
      };
    });

    // current = soma dos earmarks live + current_amount (snapshot manual,
    // usado por metas sem nenhuma source vinculada).
    const sumEarmarked = resolved.reduce((s, r) => s + r.earmarked, 0);
    const hasSources = sources.length > 0;
    const derivedCurrent = hasSources ? sumEarmarked : Number(g.current_amount);

    const status = computeGoalStatus(derivedCurrent, Number(g.target_amount), g.target_date);

    return {
      ...g,
      sources,
      sourcesResolved: resolved,
      derivedCurrent: Math.round(derivedCurrent * 100) / 100,
      status,
    };
  });
}

/**
 * Status semáforo da meta vs target_date:
 *  - 'concluida': current ≥ target
 *  - sem target_date: 'neutro'
 *  - 'adiantada': pace > time_progress + 5pp
 *  - 'no_ritmo':  |pace - time_progress| ≤ 5pp
 *  - 'atrasada':  pace < time_progress - 5pp
 */
export function computeGoalStatus(
  current: number,
  target: number,
  targetDateISO: string | null,
): EnrichedGoal["status"] {
  if (target <= 0) return "neutro";
  const pace = current / target;
  if (pace >= 1) return "concluida";
  if (!targetDateISO) return "neutro";

  const today = new Date();
  const target_d = new Date(targetDateISO + "T00:00:00Z");
  // Sem `created_at` da meta como referência aqui — usamos início do mês atual
  // como aproximação razoável (zero histórico necessário). Pra ser exato,
  // precisaríamos passar created_at, mas pra status é overkill.
  const monthsRemaining = Math.max(
    0,
    (target_d.getUTCFullYear() - today.getUTCFullYear()) * 12 +
      (target_d.getUTCMonth() - today.getUTCMonth()),
  );
  if (monthsRemaining <= 0) {
    return pace >= 0.95 ? "no_ritmo" : "atrasada";
  }
  // Time progress: assumimos meta de 24m (típico) como denominador "leve".
  // Pra ser refinado: salvar `started_at` quando criar a meta.
  const totalAssumed = monthsRemaining + 12; // assume que já está rodando há 1 ano
  const elapsed = totalAssumed - monthsRemaining;
  const time_progress = elapsed / totalAssumed;

  if (pace > time_progress + 0.05) return "adiantada";
  if (pace < time_progress - 0.05) return "atrasada";
  return "no_ritmo";
}

/**
 * Cálculo do "plano de aportes" mensal seguindo o waterfall por prioridade.
 *
 * Lógica:
 *  1. Ordena metas por priority asc (1 = topo).
 *  2. Para cada meta, calcula o que vai receber:
 *      - 'fixed_amount': allocation_value R$ direto
 *      - 'percentage':   allocation_value (0..1) × sobra restante naquele ponto
 *      - 'waterfall':    consome o que sobrar
 *      - 'manual':       não recebe nada automaticamente
 *  3. Decrementa do "remaining" e segue pra próxima.
 *
 * Retorna a lista com `allocated` por meta + `leftover` no final.
 */
export type AllocationLine = {
  goalId: string;
  goalName: string;
  goalCurrency: Currency;
  mode: GoalAllocationMode;
  allocated: number; // R$ em displayCurrency
};

export function computeAllocationPlan(
  goals: EnrichedGoal[],
  monthlySavingsInDisplay: number,
  displayCurrency: Currency,
  rates: Record<string, number>,
): { lines: AllocationLine[]; leftover: number } {
  let remaining = Math.max(0, monthlySavingsInDisplay);
  const lines: AllocationLine[] = [];

  const sorted = [...goals]
    .filter((g) => !g.is_archived && g.derivedCurrent < Number(g.target_amount))
    .sort((a, b) => a.priority - b.priority);

  for (const g of sorted) {
    let alloc = 0;
    const mode = g.allocation_mode;
    if (remaining <= 0) {
      // Já zerou a sobra, mas adiciona linha com 0 pra UI mostrar
      lines.push({
        goalId: g.id,
        goalName: g.name,
        goalCurrency: g.currency,
        mode,
        allocated: 0,
      });
      continue;
    }

    if (mode === "fixed_amount" && g.allocation_value != null) {
      // allocation_value armazenado em moeda da meta. Converte pra display
      const inDisplay = convertOrSame(
        Number(g.allocation_value),
        g.currency,
        displayCurrency,
        rates,
      );
      alloc = Math.min(remaining, inDisplay);
    } else if (mode === "percentage" && g.allocation_value != null) {
      alloc = remaining * Number(g.allocation_value);
    } else if (mode === "waterfall") {
      // Não consome aqui — é o "resto". Tratado depois.
      lines.push({
        goalId: g.id,
        goalName: g.name,
        goalCurrency: g.currency,
        mode,
        allocated: 0,
      });
      continue;
    }
    // 'manual' → alloc = 0 (não recebe automático)

    // Limita pelo que falta pra concluir a meta (em display currency)
    const remainingToTarget = convertOrSame(
      Number(g.target_amount) - g.derivedCurrent,
      g.currency,
      displayCurrency,
      rates,
    );
    alloc = Math.min(alloc, remainingToTarget);

    remaining = Math.max(0, remaining - alloc);
    lines.push({
      goalId: g.id,
      goalName: g.name,
      goalCurrency: g.currency,
      mode,
      allocated: Math.round(alloc * 100) / 100,
    });
  }

  // Waterfall: divide o remaining igualmente entre metas em waterfall ativas
  const waterfallIdx = lines
    .map((l, i) => ({ l, i }))
    .filter((x) => x.l.mode === "waterfall");
  if (waterfallIdx.length > 0 && remaining > 0) {
    const each = remaining / waterfallIdx.length;
    for (const { i } of waterfallIdx) {
      lines[i] = { ...lines[i], allocated: Math.round(each * 100) / 100 };
    }
    remaining = 0;
  }

  return { lines, leftover: Math.round(remaining * 100) / 100 };
}

/**
 * Default sugerido pra `target_amount` baseado no tipo:
 *  - emergencia: 6 × despesa mensal
 *  - aposentadoria: 25 × despesa anual (regra dos 4%)
 *  - outros: null (sem sugestão)
 */
export function suggestedTargetForType(
  type: GoalType,
  monthlyExpense: number,
): number | null {
  if (type === "emergencia") return Math.round(monthlyExpense * 6 * 100) / 100;
  if (type === "aposentadoria") return Math.round(monthlyExpense * 12 * 25 * 100) / 100;
  return null;
}

export { estimateCompletion } from "@/lib/financial/projection";
