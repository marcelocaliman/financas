import "server-only";
import { createClient } from "@/lib/supabase/server";
import { estimateAssetTax, type TaxEstimate } from "@/lib/financial/tax";
import type { Tables } from "@/types/database";

/**
 * Visão "viver de renda" — agrega, por ativo de renda fixa:
 *  - Saldo atual derivado (composto desde a compra)
 *  - Sacável agora (= baseBalance - initial_amount) — o lucro acumulado vivo
 *  - Rendimento diário e mensal estimado
 *  - IR retido estimado se sacar TUDO agora (regime regressivo)
 *  - Regra de saque vinculada, se houver
 *  - Trajetória de saques no ano corrente (executados + previstos)
 *
 * Usado pelo /resgates como fonte única — evita o usuário ter que abrir
 * 3 páginas pra montar a decisão de "quanto posso tirar agora".
 */

export type AssetYieldRow = {
  investmentId: string;
  ticker: string;
  name: string;
  taxRegime: "regressive" | "exempt";
  purchaseDate: string;
  initialAmount: number;
  baseBalance: number;
  /** baseBalance - initialAmount, mínimo zero */
  accumulatedYield: number;
  /** rendimento estimado por dia útil (já em moeda de exibição via LivePortfolio) */
  dailyYield: number;
  monthlyYield: number;
  /** IR estimado sobre TODO o rendimento acumulado se sacar agora */
  tax: TaxEstimate | null;
  /** ID da regra de saque ativa pro ativo, se houver */
  ruleId: string | null;
  ruleSummary: string | null;
};

export type YearlyRedemptionMonth = {
  month: number; // 1-12
  label: string; // jan, fev, ...
  executed: number;
  pending: number;
  total: number;
};

export type YieldOverview = {
  rows: AssetYieldRow[];
  totals: {
    accumulatedYield: number;
    dailyYield: number;
    monthlyYield: number;
    principal: number;
  };
  yearly: {
    year: number;
    months: YearlyRedemptionMonth[];
    executedYTD: number;
    pendingRestOfYear: number;
    projectedFullYear: number;
  };
};

type LiveAsset = {
  id: string;
  ticker: string;
  baseBalance: number;
  dailyYield: number;
};

/**
 * Builda overview a partir de:
 *  - investments (já filtrados por household via RLS)
 *  - liveByAssetId (live yield metrics calculado pra cada ativo)
 *  - yieldRules (regras configuradas)
 *
 * O caller (page.tsx) fornece as dependências pra evitar duplicar queries.
 */
export async function getYieldOverview(
  liveByAssetId: Map<string, LiveAsset>,
  rulesByInvestmentId: Map<
    string,
    { id: string; mode: string; suggested_amount: number | null; percentage: number | null; day_of_month: number }
  >,
): Promise<YieldOverview> {
  const supabase = await createClient();

  const { data: invs } = await supabase
    .from("investments")
    .select("id, ticker, name, asset_type, tax_regime, purchase_date, initial_amount, current_balance")
    .eq("is_active", true)
    .in("asset_type", ["fixed_income_public", "fixed_income_private"]);

  const investments = (invs ?? []) as Pick<
    Tables<"investments">,
    | "id"
    | "ticker"
    | "name"
    | "asset_type"
    | "tax_regime"
    | "purchase_date"
    | "initial_amount"
    | "current_balance"
  >[];

  const rows: AssetYieldRow[] = investments.map((inv) => {
    const live = liveByAssetId.get(inv.id);
    const baseBalance = live?.baseBalance ?? Number(inv.current_balance);
    const initialAmount = Number(inv.initial_amount);
    const accumulatedYield = Math.max(0, baseBalance - initialAmount);
    const dailyYield = live?.dailyYield ?? 0;
    const monthlyYield = dailyYield * 21;
    const tax = estimateAssetTax(
      inv.tax_regime as "regressive" | "exempt",
      inv.purchase_date,
      accumulatedYield,
    );
    const rule = rulesByInvestmentId.get(inv.id);
    const ruleSummary = rule
      ? rule.mode === "reinvest"
        ? "Reinveste"
        : rule.mode === "percentage"
          ? `${Math.round(rule.percentage ?? 0)}% renda · dia ${rule.day_of_month}`
          : `R$ ${Number(rule.suggested_amount ?? 0).toLocaleString("pt-BR")} · dia ${rule.day_of_month}`
      : null;

    return {
      investmentId: inv.id,
      ticker: inv.ticker,
      name: inv.name,
      taxRegime: inv.tax_regime as "regressive" | "exempt",
      purchaseDate: inv.purchase_date,
      initialAmount,
      baseBalance,
      accumulatedYield: Math.round(accumulatedYield * 100) / 100,
      dailyYield: Math.round(dailyYield * 100) / 100,
      monthlyYield: Math.round(monthlyYield * 100) / 100,
      tax,
      ruleId: rule?.id ?? null,
      ruleSummary,
    };
  });

  rows.sort((a, b) => b.accumulatedYield - a.accumulatedYield);

  const totals = rows.reduce(
    (acc, r) => ({
      accumulatedYield: acc.accumulatedYield + r.accumulatedYield,
      dailyYield: acc.dailyYield + r.dailyYield,
      monthlyYield: acc.monthlyYield + r.monthlyYield,
      principal: acc.principal + r.initialAmount,
    }),
    { accumulatedYield: 0, dailyYield: 0, monthlyYield: 0, principal: 0 },
  );

  // ----- Trajetória do ano corrente -----
  const now = new Date();
  const year = now.getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data: intents } = await supabase
    .from("redemption_intents")
    .select("due_date, status, suggested_amount, executed_amount")
    .gte("due_date", yearStart)
    .lte("due_date", yearEnd);

  const LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const months: YearlyRedemptionMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: LABELS[i],
    executed: 0,
    pending: 0,
    total: 0,
  }));

  for (const intent of intents ?? []) {
    const m = parseInt(intent.due_date.slice(5, 7), 10);
    const bucket = months[m - 1];
    if (intent.status === "executed") {
      bucket.executed += Number(intent.executed_amount ?? 0);
    } else if (intent.status === "pending") {
      bucket.pending += Number(intent.suggested_amount ?? 0);
    }
    // status "skipped" não soma nada
  }
  for (const b of months) {
    b.executed = Math.round(b.executed * 100) / 100;
    b.pending = Math.round(b.pending * 100) / 100;
    b.total = Math.round((b.executed + b.pending) * 100) / 100;
  }

  const executedYTD = months.reduce((s, m) => s + m.executed, 0);
  const pendingRestOfYear = months.reduce((s, m) => s + m.pending, 0);
  const projectedFullYear = executedYTD + pendingRestOfYear;

  return {
    rows,
    totals: {
      accumulatedYield: Math.round(totals.accumulatedYield * 100) / 100,
      dailyYield: Math.round(totals.dailyYield * 100) / 100,
      monthlyYield: Math.round(totals.monthlyYield * 100) / 100,
      principal: Math.round(totals.principal * 100) / 100,
    },
    yearly: {
      year,
      months,
      executedYTD: Math.round(executedYTD * 100) / 100,
      pendingRestOfYear: Math.round(pendingRestOfYear * 100) / 100,
      projectedFullYear: Math.round(projectedFullYear * 100) / 100,
    },
  };
}
