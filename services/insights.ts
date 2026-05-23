import "server-only";
import { getMonthlyHistory, getCategoryMovers, getMonthlySummary } from "@/services/transactions";
import { getLivePortfolio } from "@/services/live-yield";
import { getCoverage } from "@/services/investments";
import { getGoalReminders } from "@/services/goal-reminders";
import { getBudgetVsActual } from "@/services/budgets";
import { getSubscriptionsSummary } from "@/services/subscriptions";
import { listGoalsEnriched } from "@/services/goals";

/**
 * Insights = heurísticas leves que interpretam os dados do usuário e
 * surfam "achados narrativos" — não é IA generativa, é regra de negócio
 * com formato editorial. Vantagens vs IA generativa:
 *   - Sem custo de token
 *   - Determinístico (mesma situação → mesma mensagem)
 *   - Sem hallucinations sobre números
 *   - Funciona offline / sem provider key
 *
 * Cada insight tem severity ('critical' | 'warning' | 'positive' | 'info')
 * e action opcional (link). Ordenamos por severity desc e limitamos a top N.
 */

export type Insight = {
  id: string;
  severity: "critical" | "warning" | "positive" | "info";
  title: string;
  description: string;
  /** Link opcional pra ação relacionada */
  href?: string;
  hrefLabel?: string;
};

export async function getInsights(): Promise<Insight[]> {
  const [
    history,
    summary,
    movers,
    live,
    coverage,
    reminders,
    budgets,
    subs,
    goals,
  ] = await Promise.all([
    getMonthlyHistory(6),
    getMonthlySummary(),
    getCategoryMovers().catch(() => []),
    getLivePortfolio(),
    getCoverage(),
    getGoalReminders(7),
    getBudgetVsActual(),
    getSubscriptionsSummary(),
    listGoalsEnriched(),
  ]);

  const insights: Insight[] = [];

  // ---------- Taxa de poupança vs histórico ----------
  if (history.length >= 4) {
    const recentRates = history.slice(-4).map((h) => (h.income > 0 ? h.net / h.income : 0));
    const currentRate = recentRates[recentRates.length - 1];
    const priorAvg = recentRates.slice(0, -1).reduce((s, v) => s + v, 0) / (recentRates.length - 1);
    const delta = currentRate - priorAvg;
    if (currentRate < 0 && priorAvg >= 0) {
      insights.push({
        id: "savings-negative",
        severity: "critical",
        title: "Sobra ficou negativa esse mês",
        description: `Você gastou mais do que entrou — primeira vez em ${recentRates.length - 1} meses. Era ${pct(priorAvg)} de poupança em média e caiu pra ${pct(currentRate)}.`,
        href: "/analise",
        hrefLabel: "Ver análise",
      });
    } else if (delta < -0.1 && currentRate > 0) {
      insights.push({
        id: "savings-dropped",
        severity: "warning",
        title: "Taxa de poupança caiu",
        description: `Você está poupando ${pct(currentRate)} esse mês, vs ${pct(priorAvg)} média dos meses anteriores. Diferença de ${pct(Math.abs(delta))}.`,
        href: "/analise",
        hrefLabel: "Ver categorias",
      });
    } else if (delta > 0.1 && currentRate >= 0.2) {
      insights.push({
        id: "savings-improved",
        severity: "positive",
        title: "Você está poupando mais",
        description: `Taxa de poupança subiu pra ${pct(currentRate)} (era ${pct(priorAvg)}). Continue assim e atinge IF mais cedo.`,
      });
    }
  }

  // ---------- Categoria que mais subiu ----------
  if (movers.length > 0) {
    const top = movers[0];
    if (top.delta > 200 && top.pct != null && top.pct > 0.3) {
      insights.push({
        id: `cat-up-${top.category_id}`,
        severity: "warning",
        title: `"${top.category_name}" subiu ${pct(top.pct)}`,
        description: `Você gastou R$ ${fmt(Math.abs(top.delta))} a mais nessa categoria comparado ao mês anterior. Vale checar o que aconteceu.`,
        href: "/transacoes",
        hrefLabel: "Ver lançamentos",
      });
    }
    const biggestSavingCategory = movers.filter((m) => m.delta < -200).slice(0, 1)[0];
    if (biggestSavingCategory && biggestSavingCategory.pct != null) {
      insights.push({
        id: `cat-down-${biggestSavingCategory.category_id}`,
        severity: "positive",
        title: `"${biggestSavingCategory.category_name}" caiu ${pct(Math.abs(biggestSavingCategory.pct))}`,
        description: `Você economizou R$ ${fmt(Math.abs(biggestSavingCategory.delta))} nessa categoria vs mês anterior. ${biggestSavingCategory.delta < -500 ? "Mudança consistente?" : "Boa!"}`,
      });
    }
  }

  // ---------- Lembretes de aporte vencidos ----------
  const overdue = reminders.filter((r) => r.status === "overdue");
  if (overdue.length > 0) {
    insights.push({
      id: "goal-overdue",
      severity: "critical",
      title: `${overdue.length} ${overdue.length === 1 ? "aporte vencido" : "aportes vencidos"}`,
      description: `${overdue.map((r) => r.goalName).slice(0, 3).join(", ")}${overdue.length > 3 ? ` e mais ${overdue.length - 3}` : ""}. Confirme se já fez o aporte ou ajuste a regra.`,
      href: "/metas",
      hrefLabel: "Ver metas",
    });
  }

  // ---------- Orçamento estourado ----------
  const overBudget = budgets.filter((b) => b.status === "over");
  if (overBudget.length > 0) {
    const worst = overBudget[0];
    const overPct = Math.round((worst.ratio - 1) * 100);
    insights.push({
      id: "budget-over",
      severity: "critical",
      title:
        overBudget.length === 1
          ? `Orçamento de "${worst.categoryName}" estourado`
          : `${overBudget.length} orçamentos estourados`,
      description:
        overBudget.length === 1
          ? `Você passou ${overPct}% acima do limite. Reveja se vale aumentar o budget ou cortar gastos.`
          : `${overBudget.map((b) => b.categoryName).slice(0, 3).join(", ")}${overBudget.length > 3 ? ` e mais ${overBudget.length - 3}` : ""}. Estourados em ${overPct}%+.`,
      href: "/categorias",
      hrefLabel: "Ajustar orçamentos",
    });
  }

  // ---------- Cobertura FIRE ----------
  if (coverage.monthlyAverageExpense > 0) {
    const liveCov = live.totalDailyYield * 21 / coverage.monthlyAverageExpense;
    if (liveCov >= 1) {
      insights.push({
        id: "fire-achieved",
        severity: "positive",
        title: "Sua renda passiva cobre 100%+ das despesas",
        description: `A renda atual já paga seu custo de vida. Está oficialmente em independência financeira.`,
        href: "/resgates",
        hrefLabel: "Ver renda",
      });
    } else if (liveCov >= 0.5 && liveCov < 0.7) {
      insights.push({
        id: "fire-halfway",
        severity: "positive",
        title: `Renda passiva cobre ${Math.round(liveCov * 100)}% das despesas`,
        description: "Mais que meio caminho andado pra IF. Mantém o ritmo.",
      });
    }
  }

  // ---------- Assinaturas pesadas ----------
  if (subs.yearlyTotal > 0 && subs.count >= 5) {
    insights.push({
      id: "subs-heavy",
      severity: subs.yearlyTotal > 3000 ? "warning" : "info",
      title: `${subs.count} assinaturas ativas — R$ ${fmt(subs.yearlyTotal)}/ano`,
      description: `Soma de R$ ${fmt(subs.monthlyTotal)}/mês. ${subs.yearlyTotal > 3000 ? "Vale revisar quais ainda valem o preço." : "Mantenha de olho."}`,
      href: "/assinaturas",
      hrefLabel: "Ver assinaturas",
    });
  }

  // ---------- Meta atingida ----------
  const justAchieved = goals.filter(
    (g) => g.status === "concluida" && !g.is_archived,
  );
  if (justAchieved.length > 0) {
    insights.push({
      id: "goal-achieved",
      severity: "positive",
      title: `🎉 ${justAchieved.length === 1 ? `"${justAchieved[0].name}" atingida` : `${justAchieved.length} metas concluídas`}`,
      description:
        justAchieved.length === 1
          ? `Parabéns! A meta passou de 100%. Arquive e celebre.`
          : `${justAchieved.map((g) => g.name).slice(0, 3).join(", ")}${justAchieved.length > 3 ? "…" : ""}`,
      href: "/metas?tab=completed",
      hrefLabel: "Ver concluídas",
    });
  }

  // ---------- Renda passiva crescendo ----------
  if (live.totalDailyYield > 0 && history.length >= 3) {
    void summary;
    // simples: se renda diária × 30 > 1% do total de despesa dos 3 meses
    // É um proxy fraco mas serve como "sinal de tração"
  }

  // ---------- Patrimônio batendo recorde ----------
  // (Skipping — precisaria comparar com histórico de snapshots, complexo)

  // Ordena por severity: critical > warning > positive > info
  const order = { critical: 0, warning: 1, positive: 2, info: 3 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return insights.slice(0, 6); // máximo 6 — não inundar
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
