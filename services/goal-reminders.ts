import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Calendário de aportes nas metas — quem deve receber aporte nos próximos N dias.
 *
 * Calcula a próxima data esperada de aporte pra cada meta baseado em:
 *   1. contribution_day (configurado pelo usuário) — dia do mês
 *   2. Se a meta tem allocation_mode != 'manual', já é candidata mensal
 *   3. Compara com goal_contributions desse mês — se já tem aporte, não lembra
 *
 * Usado por:
 *   - Sidebar badge em /metas (count de "vencidos" + "próximos 7d")
 *   - Card de lembretes no /dashboard
 *   - (futuro) email/push via Resend
 */

export type GoalReminder = {
  goalId: string;
  goalName: string;
  dueDate: string; // ISO YYYY-MM-DD
  daysUntil: number; // negativo = atrasado
  status: "overdue" | "due_today" | "upcoming";
  expectedAmount: number | null; // null = waterfall (depende da sobra real)
  goalCurrency: "BRL" | "EUR" | "USD";
};

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Para uma meta com contribution_day = D, calcula a próxima data esperada
 * RESPEITANDO a data em que o tracking começou (trackingStart):
 *
 *  - Se trackingStart é DEPOIS do dia D do mês corrente → primeiro lembrete
 *    é dia D do próximo mês (a meta não existia / tracking pausado naquela data)
 *  - Senão (regra original):
 *      - Se D ainda não passou esse mês: dia D deste mês
 *      - Se D já passou e não há contribuição esse mês: ATRASADA
 *      - Se D já passou e já há contribuição: dia D do próximo mês
 *
 * trackingStart pode vir de:
 *   1. goals.tracking_starts_at (explícito, setado pelo user)
 *   2. goals.created_at (default — meta não pode estar atrasada antes de existir)
 */
function expectedNextDate(
  contributionDay: number,
  hasContributionThisMonth: boolean,
  today: string,
  trackingStart: string,
): { date: string; isOverdue: boolean } {
  const [yStr, mStr, dStr] = today.split("-");
  const todayDay = parseInt(dStr, 10);
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);

  // Date do dia D no mês atual (clamped pra fim de mês curto)
  const thisMonthDDay = `${yStr}-${mStr}-${String(Math.min(contributionDay, daysInMonth(y, m))).padStart(2, "0")}`;

  // Tracking começou DEPOIS do dia D deste mês? → pula pra próximo mês
  if (trackingStart > thisMonthDDay) {
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const day = Math.min(contributionDay, daysInMonth(nextY, nextM));
    return {
      date: `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      isOverdue: false,
    };
  }

  if (todayDay <= contributionDay) {
    // Ainda vai chegar esse mês
    return { date: thisMonthDDay, isOverdue: false };
  }

  if (!hasContributionThisMonth) {
    // Já passou o dia e não foi aportada → atrasada
    return { date: thisMonthDDay, isOverdue: true };
  }

  // Já contribuiu esse mês — próxima é no mês que vem
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const day = Math.min(contributionDay, daysInMonth(nextY, nextM));
  return {
    date: `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    isOverdue: false,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Lista lembretes ordenados por data — mais urgentes primeiro.
 * Inclui:
 *   - Atrasados (overdue) — passou o contribution_day sem aporte registrado
 *   - Hoje (due_today)
 *   - Próximos 30 dias (upcoming)
 */
export async function getGoalReminders(windowDays = 30): Promise<GoalReminder[]> {
  const supabase = await createClient();
  const today = todayISO();

  const [yStr, mStr] = today.split("-");
  const monthStart = `${yStr}-${mStr}-01`;

  const [{ data: goals }, { data: contribsThisMonth }] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, name, currency, contribution_day, allocation_mode, allocation_value, target_amount, current_amount, created_at, tracking_starts_at",
      )
      .eq("is_archived", false)
      .not("contribution_day", "is", null),
    supabase
      .from("goal_contributions")
      .select("goal_id")
      .gte("date", monthStart),
  ]);

  type GoalSlim = Pick<
    Tables<"goals">,
    | "id"
    | "name"
    | "currency"
    | "contribution_day"
    | "allocation_mode"
    | "allocation_value"
    | "target_amount"
    | "current_amount"
    | "created_at"
    | "tracking_starts_at"
  >;

  const goalsHavingThisMonth = new Set(
    (contribsThisMonth ?? []).map((c) => c.goal_id),
  );

  const reminders: GoalReminder[] = [];

  for (const g of (goals ?? []) as GoalSlim[]) {
    if (g.contribution_day == null) continue;
    // Skip metas que já atingiram o target
    if (Number(g.current_amount) >= Number(g.target_amount) && Number(g.target_amount) > 0) {
      continue;
    }
    // Tracking start: explícito (tracking_starts_at) ou criação (created_at).
    // Garante que a meta não pode estar "atrasada" antes de existir.
    const trackingStart =
      g.tracking_starts_at ?? (g.created_at ? g.created_at.slice(0, 10) : today);
    const { date, isOverdue } = expectedNextDate(
      g.contribution_day,
      goalsHavingThisMonth.has(g.id),
      today,
      trackingStart,
    );
    const days = diffDays(today, date);
    if (!isOverdue && days > windowDays) continue;

    const status: GoalReminder["status"] = isOverdue
      ? "overdue"
      : days === 0
        ? "due_today"
        : "upcoming";

    const expected =
      g.allocation_mode === "fixed_amount" && g.allocation_value
        ? Number(g.allocation_value)
        : null;

    reminders.push({
      goalId: g.id,
      goalName: g.name,
      dueDate: date,
      daysUntil: days,
      status,
      expectedAmount: expected,
      goalCurrency: g.currency,
    });
  }

  // Ordena: overdue primeiro, depois por data crescente
  return reminders.sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1;
    if (b.status === "overdue" && a.status !== "overdue") return 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
