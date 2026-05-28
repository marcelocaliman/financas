import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentValueMap } from "@/services/quotes";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import { dateInSP } from "@/lib/financial/business-days";
import { valueForFiler, type FilerForSplit } from "@/lib/financial/ownership-split";
import { listFilers, getRegimeContext } from "@/services/ir/filers";
import type { Currency, Tables } from "@/types/database";

/**
 * SINGLE SOURCE OF TRUTH pro estado do patrimônio.
 *
 * Toda página que exibe número derivado de investimentos/contas/bens
 * (Dashboard, /investimentos, /ir, /patrimonio) DEVE consumir desse serviço.
 * Não deve mais existir cálculo de saldo/projeção/variação em N lugares.
 *
 * Garantias:
 *   - Mesma fonte = mesmos números em todas as páginas (impossível divergir)
 *   - Cache por request (React `cache()`) — chamadas múltiplas no mesmo
 *     render reusam o resultado
 *   - Valor atual de ativos vem de getCurrentValueMap (services/quotes.ts):
 *     ações/FIIs/ETFs via brapi (quote × qty), RF/cripto via current_balance
 *     manual cadastrado pelo usuário.
 *   - Aplicado: initial_amount / acquired_value
 *
 * Cada item tem 4 valores monetários nucleares:
 *   - applied: capital posto (custo de aquisição)
 *   - today: estado real agora (current_balance ou quote × qty)
 *   - projected: = today (sem compound automático — usuário atualiza manual)
 *   - previousYearEnd: 31/12/(year-1) — só se houver entry manual/snapshot
 */

export type AssetClass =
  | "fixed_income_public" // Tesouro Direto
  | "fixed_income_private" // CDB, RDB, LCI, LCA, fundos RF
  | "stock"
  | "fii"
  | "etf"
  | "crypto"
  | "physical_real_estate"
  | "physical_vehicle"
  | "physical_other"
  | "account_checking"
  | "account_savings"
  | "account_cash"
  | "account_investment_cash"
  | "account_credit_card";

export type PortfolioItem = {
  source: "investment" | "account" | "physical";
  sourceId: string;
  name: string;
  ticker?: string;
  assetClass: AssetClass;
  currency: Currency;

  // Valores monetários (todos em BRL após conversão FX)
  applied: number; // custo de aquisição
  today: number; // estado real hoje (live)
  projected: number; // 31/12/year (projeção RF / atual demais)
  previousYearEnd: number; // 31/12/(year-1) — 0 se sem entry

  // Diagnóstico/UI
  variation: number; // today - applied
  variationPct: number; // variation / applied × 100
  yieldUntilEnd: number; // projected - today (positivo só pra RF projetada)
  isProjected: boolean; // true pra RF com projeção composta
  isClosed: boolean; // true se ativo foi liquidado no ano
  closedAt: string | null;
  closedReason: string | null;
  ownerFilerId: string | null;
  ownershipPercent: number;
};

export type PortfolioClassTotal = {
  label: string;
  applied: number;
  today: number;
  projected: number;
  variation: number;
  variationPct: number;
  yieldUntilEnd: number;
};

export type PortfolioState = {
  year: number;
  displayCurrency: Currency;
  generatedAt: string;
  items: PortfolioItem[];
  /**
   * `totals` = visão BRUTA: soma direta de items.applied/today/projected.
   * Inclui caixa de corretora e cartão como ATIVO positivo.
   *
   * É a visão correta pra IR (Bens e Direitos lista TUDO que existe,
   * inclusive caixa em corretora; cartão entra em Dívidas separado).
   *
   * Pra patrimônio líquido visível em /dashboard, /patrimonio e
   * /investimentos, use `totalsNet` — exclui caixa de corretora (evita
   * dupla contagem com investimentos que ele lastreia) e exclui cartão
   * (modelo cash basis: dívida só pesa quando fatura é paga).
   */
  totals: {
    applied: number;
    today: number;
    projected: number;
    previousYearEnd: number;
    variation: number;
    variationPct: number;
    yieldUntilEnd: number;
  };
  /**
   * Visão LÍQUIDA pra UIs de patrimônio:
   *   - exclui `account_investment_cash` (caixa parado na corretora — já
   *     lastreia futuros investimentos, contar separado duplica)
   *   - exclui `account_credit_card` (dívida só conta quando paga, cash
   *     basis — alinhado com [services/accounts.ts] liquidExcludingInvestmentCash)
   */
  totalsNet: {
    applied: number;
    today: number;
    projected: number;
    previousYearEnd: number;
    variation: number;
    variationPct: number;
    yieldUntilEnd: number;
  };
  byClass: PortfolioClassTotal[];
  /** Indicador se a projeção 31/12 ainda é estimativa (ano em curso) ou final */
  projectionStatus: "in_progress" | "final";
  /** True quando 31/12/(year-1) tem entries completas (sem gaps) */
  previousYearComplete: boolean;
};

/**
 * Computa o estado completo do patrimônio pra um ano-base.
 *
 * Cacheado por request (year + householdId + filerId).
 */
export const getPortfolioState = cache(
  async (
    year: number,
    householdId?: string,
    filerId?: string,
  ): Promise<PortfolioState> => {
    const supabase = await createClient();
    const todayIso = dateInSP(new Date()).iso;
    const endOfYear = `${year}-12-31`;
    const endOfPrevYear = `${year - 1}-12-31`;
    const inProgress = todayIso < endOfYear;

    const [
      displayCurrency,
      rates,
      currentValues,
      { data: investments },
      { data: accounts },
      { data: physical },
      { data: priorYearManual },
    ] = await Promise.all([
      getDisplayCurrency(),
      getRateMap(),
      getCurrentValueMap(),
      (householdId
        ? supabase
            .from("investments")
            .select(
              "id, ticker, name, asset_type, indexer, indexer_multiplier, fixed_rate, initial_amount, current_balance, currency, quantity, purchase_date, closed_at, closed_reason, owner_filer_id, ownership_percent, is_particular, is_active, exclude_from_ir",
            )
            .eq("household_id", householdId)
        : supabase
            .from("investments")
            .select(
              "id, ticker, name, asset_type, indexer, indexer_multiplier, fixed_rate, initial_amount, current_balance, currency, quantity, purchase_date, closed_at, closed_reason, owner_filer_id, ownership_percent, is_particular, is_active, exclude_from_ir",
            )),
      (householdId
        ? supabase
            .from("accounts")
            .select("id, name, type, current_balance, currency, is_active, created_at, exclude_from_ir, owner_filer_id, ownership_percent, is_particular")
            .eq("household_id", householdId)
        : supabase
            .from("accounts")
            .select("id, name, type, current_balance, currency, is_active, created_at, exclude_from_ir, owner_filer_id, ownership_percent, is_particular")),
      (householdId
        ? supabase
            .from("physical_assets")
            .select("id, name, category, acquired_value, current_value, currency, acquired_at, is_active, exclude_from_ir, owner_filer_id, ownership_percent, is_particular")
            .eq("household_id", householdId)
        : supabase
            .from("physical_assets")
            .select("id, name, category, acquired_value, current_value, currency, acquired_at, is_active, exclude_from_ir, owner_filer_id, ownership_percent, is_particular")),
      householdId
        ? supabase
            .from("ir_prior_year_balances")
            .select("account_id, investment_id, physical_asset_id, balance")
            .eq("household_id", householdId)
        : supabase
            .from("ir_prior_year_balances")
            .select("account_id, investment_id, physical_asset_id, balance"),
    ]);

    // Mapa de prior_year_balances por (source:id)
    const prevValueMap = new Map<string, number>();
    for (const p of priorYearManual ?? []) {
      if (p.investment_id) prevValueMap.set(`investment:${p.investment_id}`, Number(p.balance));
      if (p.account_id) prevValueMap.set(`account:${p.account_id}`, Number(p.balance));
      if (p.physical_asset_id) prevValueMap.set(`physical:${p.physical_asset_id}`, Number(p.balance));
    }

    // Filer split (ownership): se filerId foi passado, carrega contexto de
    // regime + filers e aplica a proporção a cada ativo. Senão, retorna 100%.
    const filersForSplit: FilerForSplit[] = [];
    let regime: import("@/types/database").MarriageRegime = "solteiro";
    let marriageDate: string | null = null;
    if (filerId) {
      const [allFilers, regimeCtx] = await Promise.all([
        listFilers(householdId),
        getRegimeContext(householdId),
      ]);
      filersForSplit.push(
        ...allFilers.map((f) => ({ id: f.id, is_primary: f.is_primary })),
      );
      regime = regimeCtx.regime;
      marriageDate = regimeCtx.marriageDate;
    }
    const applyFilerShare = (
      fullValue: number,
      asset: {
        owner_filer_id: string | null;
        is_particular: boolean | null;
        ownership_percent: number | null;
      },
    ): number => {
      if (!filerId) return fullValue;
      return valueForFiler(
        fullValue,
        {
          owner_filer_id: asset.owner_filer_id,
          is_particular: asset.is_particular ?? false,
          ownership_percent: asset.ownership_percent,
        },
        filersForSplit,
        regime,
        marriageDate,
        filerId,
      );
    };

    const items: PortfolioItem[] = [];

    // ────────── INVESTIMENTOS ──────────
    for (const inv of investments ?? []) {
      const isClosedInYear =
        !!inv.closed_at &&
        inv.closed_at >= `${year}-01-01` &&
        inv.closed_at <= `${year}-12-31`;
      // Investimentos fechados em anos anteriores não aparecem
      if (!inv.is_active && !isClosedInYear) continue;

      const c = (inv.currency ?? "BRL") as Currency;
      const initial = Number(inv.initial_amount ?? 0);
      // Valor atual: pra ações/FIIs/ETFs vem da brapi (quote × qty);
      // pra RF/cripto/outros usa o current_balance (manual).
      const currentValue = currentValues.map.get(inv.id);
      const todayNative =
        currentValue != null ? currentValue : Number(inv.current_balance ?? 0);

      // Conversão pra BRL e aplicação do filer share (se filerId)
      const fullInitialBRL =
        c === "BRL" ? initial : convertOrSame(initial, c, "BRL", rates);
      const fullTodayBRL =
        c === "BRL" ? todayNative : convertOrSame(todayNative, c, "BRL", rates);
      const initialBRL = applyFilerShare(fullInitialBRL, inv);
      const todayBRL = applyFilerShare(fullTodayBRL, inv);

      // Projeção 31/12 = mesmo valor atual (sem compound automático).
      // O usuário atualiza current_balance manualmente quando quiser.
      const projectedBRL = isClosedInYear ? 0 : todayBRL;

      const assetClass = mapInvestmentAssetClass(inv.asset_type);
      const previousYearEnd = prevValueMap.get(`investment:${inv.id}`) ?? 0;
      const variation = todayBRL - initialBRL;

      items.push({
        source: "investment",
        sourceId: inv.id,
        name: inv.name,
        ticker: inv.ticker,
        assetClass,
        currency: c,
        applied: round2(initialBRL),
        today: round2(isClosedInYear ? 0 : todayBRL),
        projected: round2(projectedBRL),
        previousYearEnd: round2(previousYearEnd),
        variation: round2(variation),
        variationPct: initialBRL > 0 ? round2((variation / initialBRL) * 100) : 0,
        yieldUntilEnd: 0,
        isProjected: false,
        isClosed: isClosedInYear,
        closedAt: inv.closed_at,
        closedReason: inv.closed_reason,
        ownerFilerId: inv.owner_filer_id,
        ownershipPercent: Number(inv.ownership_percent ?? 100),
      });
    }

    // ────────── CONTAS ──────────
    for (const a of accounts ?? []) {
      if (!a.is_active) continue;
      const c = (a.currency ?? "BRL") as Currency;
      const balance = Number(a.current_balance ?? 0);
      const fullBalanceBRL =
        c === "BRL" ? balance : convertOrSame(balance, c, "BRL", rates);
      const balanceBRL = applyFilerShare(fullBalanceBRL, a);
      const previousYearEnd = prevValueMap.get(`account:${a.id}`) ?? 0;

      items.push({
        source: "account",
        sourceId: a.id,
        name: a.name,
        assetClass: mapAccountAssetClass(a.type),
        currency: c,
        applied: round2(balanceBRL), // contas não têm custo separado
        today: round2(balanceBRL),
        projected: round2(balanceBRL), // sem projeção (depende de fluxos futuros)
        previousYearEnd: round2(previousYearEnd),
        variation: 0,
        variationPct: 0,
        yieldUntilEnd: 0,
        isProjected: false,
        isClosed: false,
        closedAt: null,
        closedReason: null,
        ownerFilerId: a.owner_filer_id,
        ownershipPercent: Number(a.ownership_percent ?? 100),
      });
    }

    // ────────── BENS FÍSICOS ──────────
    for (const p of physical ?? []) {
      if (!p.is_active) continue;
      const c = (p.currency ?? "BRL") as Currency;
      const acquired = Number(p.acquired_value ?? 0);
      const current = Number(p.current_value ?? 0);
      const fullAcquiredBRL =
        c === "BRL" ? acquired : convertOrSame(acquired, c, "BRL", rates);
      const fullCurrentBRL =
        c === "BRL" ? current : convertOrSame(current, c, "BRL", rates);
      const acquiredBRL = applyFilerShare(fullAcquiredBRL, p);
      const currentBRL = applyFilerShare(fullCurrentBRL, p);
      const previousYearEnd = prevValueMap.get(`physical:${p.id}`) ?? 0;
      const variation = currentBRL - acquiredBRL;

      items.push({
        source: "physical",
        sourceId: p.id,
        name: p.name,
        assetClass: mapPhysicalAssetClass(p.category),
        currency: c,
        applied: round2(acquiredBRL),
        today: round2(currentBRL),
        projected: round2(currentBRL), // bens não projetam
        previousYearEnd: round2(previousYearEnd),
        variation: round2(variation),
        variationPct: acquiredBRL > 0 ? round2((variation / acquiredBRL) * 100) : 0,
        yieldUntilEnd: 0,
        isProjected: false,
        isClosed: false,
        closedAt: null,
        closedReason: null,
        ownerFilerId: p.owner_filer_id,
        ownershipPercent: Number(p.ownership_percent ?? 100),
      });
    }

    // ────────── TOTALS (bruto) ──────────
    const totals = {
      applied: round2(items.reduce((s, i) => s + i.applied, 0)),
      today: round2(items.reduce((s, i) => s + i.today, 0)),
      projected: round2(items.reduce((s, i) => s + i.projected, 0)),
      previousYearEnd: round2(items.reduce((s, i) => s + i.previousYearEnd, 0)),
      variation: 0,
      variationPct: 0,
      yieldUntilEnd: 0,
    };
    totals.variation = round2(totals.today - totals.applied);
    totals.variationPct = totals.applied > 0
      ? round2((totals.variation / totals.applied) * 100)
      : 0;
    totals.yieldUntilEnd = round2(totals.projected - totals.today);

    // ────────── TOTALS NET (patrimônio líquido) ──────────
    const isNetIncluded = (it: PortfolioItem) =>
      it.assetClass !== "account_investment_cash" &&
      it.assetClass !== "account_credit_card";
    const totalsNet = {
      applied: round2(items.filter(isNetIncluded).reduce((s, i) => s + i.applied, 0)),
      today: round2(items.filter(isNetIncluded).reduce((s, i) => s + i.today, 0)),
      projected: round2(items.filter(isNetIncluded).reduce((s, i) => s + i.projected, 0)),
      previousYearEnd: round2(
        items.filter(isNetIncluded).reduce((s, i) => s + i.previousYearEnd, 0),
      ),
      variation: 0,
      variationPct: 0,
      yieldUntilEnd: 0,
    };
    totalsNet.variation = round2(totalsNet.today - totalsNet.applied);
    totalsNet.variationPct = totalsNet.applied > 0
      ? round2((totalsNet.variation / totalsNet.applied) * 100)
      : 0;
    totalsNet.yieldUntilEnd = round2(totalsNet.projected - totalsNet.today);

    // ────────── BY CLASS ──────────
    const classMap = new Map<
      string,
      { applied: number; today: number; projected: number }
    >();
    for (const it of items) {
      const label = classLabel(it.assetClass);
      const cur = classMap.get(label) ?? { applied: 0, today: 0, projected: 0 };
      cur.applied += it.applied;
      cur.today += it.today;
      cur.projected += it.projected;
      classMap.set(label, cur);
    }
    const byClass: PortfolioClassTotal[] = Array.from(classMap.entries())
      .sort(([, a], [, b]) => b.today - a.today)
      .map(([label, v]) => {
        const variation = v.today - v.applied;
        return {
          label,
          applied: round2(v.applied),
          today: round2(v.today),
          projected: round2(v.projected),
          variation: round2(variation),
          variationPct: v.applied > 0 ? round2((variation / v.applied) * 100) : 0,
          yieldUntilEnd: round2(v.projected - v.today),
        };
      });

    // ────────── METADATA ──────────
    const projectionStatus: "in_progress" | "final" = inProgress ? "in_progress" : "final";

    // Previous year complete: todos os ativos ativos com purchase_date <= endOfPrevYear
    // têm entry em prior_year_balances
    let previousYearComplete = true;
    for (const inv of investments ?? []) {
      if (!inv.is_active) continue;
      if (inv.purchase_date && inv.purchase_date <= endOfPrevYear && !prevValueMap.has(`investment:${inv.id}`)) {
        previousYearComplete = false;
        break;
      }
    }

    return {
      year,
      displayCurrency,
      generatedAt: new Date().toISOString(),
      items,
      totals,
      totalsNet,
      byClass,
      projectionStatus,
      previousYearComplete,
    };
  },
);

/* ============================== HELPERS ============================== */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapInvestmentAssetClass(t: string): AssetClass {
  if (t === "fixed_income_public" || t === "fixed_income_private") return t;
  if (t === "stock") return "stock";
  if (t === "fii") return "fii";
  if (t === "etf") return "etf";
  if (t === "crypto") return "crypto";
  return "physical_other";
}

function mapAccountAssetClass(t: Tables<"accounts">["type"]): AssetClass {
  if (t === "checking") return "account_checking";
  if (t === "savings") return "account_savings";
  if (t === "cash") return "account_cash";
  if (t === "investment") return "account_investment_cash";
  if (t === "credit_card") return "account_credit_card";
  return "account_cash";
}

function mapPhysicalAssetClass(c: Tables<"physical_assets">["category"]): AssetClass {
  if (c === "real_estate") return "physical_real_estate";
  if (c === "vehicle") return "physical_vehicle";
  return "physical_other";
}

function classLabel(c: AssetClass): string {
  switch (c) {
    case "fixed_income_public":
    case "fixed_income_private":
      return "Renda fixa";
    case "stock":
    case "fii":
    case "etf":
      return "Renda variável (Ações, FIIs, ETFs)";
    case "crypto":
      return "Criptoativos";
    case "physical_real_estate":
      return "Imóveis";
    case "physical_vehicle":
      return "Veículos";
    case "physical_other":
      return "Outros bens e participações";
    case "account_checking":
    case "account_savings":
    case "account_cash":
    case "account_investment_cash":
      return "Contas e caixa";
    case "account_credit_card":
      return "Cartão de crédito (dívida)";
  }
}
