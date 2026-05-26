import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getDisplayCurrency, getRateMap } from "@/services/currency";
import type { Currency, Tables } from "@/types/database";

/**
 * Histórico mensal de patrimônio dos investimentos do household.
 *
 * Estratégia:
 *   - Ações: usa `quote_history` (último preço do mês × quantidade atual).
 *     Pra meses sem dado histórico, faz carry-forward do último disponível.
 *     Cota brapi free só dá 3 meses, então pontos > 3 meses são extrapolados
 *     usando o último preço conhecido (achata mas é honesto sobre o limite).
 *   - Renda fixa: aproxima usando taxa Selic anual (~13.5% = ~1.06%/mês).
 *     Reconstrói retroativamente: valor_mes_n = current / fator^n.
 *   - FIIs / outros: mesma lógica de ações.
 *
 * Output: pontos mensais (último dia do mês) somando todos os ativos
 * convertidos em moeda de exibição. Inclui breakdown por tipo.
 */

export type InvestmentHistoryPoint = {
  /** YYYY-MM-DD — último dia do mês (ou hoje pro ponto corrente) */
  date: string;
  /** Label curto pro eixo X (ex: "mai") */
  label: string;
  /** Patrimônio total na moeda de display */
  total: number;
  /** Breakdown por tipo */
  stocks: number;
  fixedIncome: number;
  other: number;
  /** True pra pontos baseados em estimativa (Selic constante / carry-forward) */
  isEstimate: boolean;
};

/** Taxa Selic anual usada pra retroceder valor de renda fixa.
 *  ~13.5%/ano corrente — aproximação razoável pra 12 meses passados. */
const SELIC_ANNUAL = 0.135;
const MONTHLY_RF_FACTOR = Math.pow(1 + SELIC_ANNUAL, 1 / 12); // ~1.0106

function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

function monthLabel(m: number): string {
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][m - 1];
}

export async function getInvestmentHistory(months = 12): Promise<InvestmentHistoryPoint[]> {
  const supabase = await createClient();
  const [{ data: investments }, displayCurrency, rates] = await Promise.all([
    supabase
      .from("investments")
      .select("id, ticker, asset_type, currency, current_balance, quantity, purchase_date")
      .eq("is_active", true)
      .gt("current_balance", 0),
    getDisplayCurrency(),
    getRateMap(),
  ]);

  if (!investments || investments.length === 0) return [];

  type Inv = Pick<
    Tables<"investments">,
    "id" | "ticker" | "asset_type" | "currency" | "current_balance" | "quantity" | "purchase_date"
  >;
  const invs = investments as Inv[];

  // Coleta tickers de ações/FIIs pra buscar histórico
  const stockTickers = Array.from(
    new Set(
      invs
        .filter((i) => i.asset_type === "stock" || i.asset_type === "fii")
        .map((i) => i.ticker),
    ),
  );

  // Carrega histórico de preços (1 mês = última cotação do mês disponível)
  // Cast: quote_history adicionada via migration 20260526070000, tipos não regerados.
  const { data: historyRaw } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          in: (c: string, v: string[]) => Promise<{
            data: Array<{ ticker: string; date: string; close: number }> | null;
          }>;
        };
      };
    }
  )
    .from("quote_history")
    .select("ticker, date, close")
    .in("ticker", stockTickers.length > 0 ? stockTickers : ["__none"]);

  // Mapa ticker → [{date, close}, ...] ordenado asc
  const historyByTicker = new Map<string, Array<{ date: string; close: number }>>();
  for (const row of historyRaw ?? []) {
    const list = historyByTicker.get(row.ticker) ?? [];
    list.push({ date: row.date, close: Number(row.close) });
    historyByTicker.set(row.ticker, list);
  }
  for (const [, list] of historyByTicker) list.sort((a, b) => a.date.localeCompare(b.date));

  // Gera os N pontos mensais (último dia de cada mês), retro até N-1 meses atrás
  const todayBR = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-");
  const currentY = parseInt(todayBR[0], 10);
  const currentM = parseInt(todayBR[1], 10);

  const points: InvestmentHistoryPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(currentY, currentM - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dateStr = lastDayOfMonth(y, m);
    // Pra mês atual (i=0), usa hoje em vez do último dia
    const refDate = i === 0
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
      : dateStr;

    let stocks = 0;
    let fixedIncome = 0;
    let other = 0;
    let isEstimate = false;

    for (const inv of invs) {
      // Skip se a posição não existia ainda nessa data
      if (inv.purchase_date && refDate < inv.purchase_date) continue;

      const c = (inv.currency ?? "BRL") as Currency;
      let valueInNative = 0;

      if (inv.asset_type === "stock" || inv.asset_type === "fii") {
        // Procura cotação histórica mais próxima dessa data (carry-forward)
        const list = historyByTicker.get(inv.ticker) ?? [];
        let bestPrice: number | null = null;
        for (const point of list) {
          if (point.date <= refDate) bestPrice = point.close;
          else break;
        }
        const qty = Number(inv.quantity ?? 0);
        if (bestPrice != null && qty > 0) {
          valueInNative = bestPrice * qty;
        } else {
          // Sem histórico nessa data → usa saldo atual (estimativa)
          valueInNative = Number(inv.current_balance);
          isEstimate = true;
        }
        stocks += convertOrSame(valueInNative, c, displayCurrency, rates);
      } else if (
        inv.asset_type === "fixed_income_public" ||
        inv.asset_type === "fixed_income_private"
      ) {
        // Renda fixa: retrocede via Selic. valor_t = current / fator^(meses_atras)
        // Se i=0 (mês atual), usa current_balance direto.
        const monthsBack = i;
        const value = monthsBack === 0
          ? Number(inv.current_balance)
          : Number(inv.current_balance) / Math.pow(MONTHLY_RF_FACTOR, monthsBack);
        if (monthsBack > 0) isEstimate = true;
        fixedIncome += convertOrSame(value, c, displayCurrency, rates);
      } else {
        // outros (ex: cripto) — usa saldo atual (sem histórico)
        other += convertOrSame(Number(inv.current_balance), c, displayCurrency, rates);
        if (i > 0) isEstimate = true;
      }
    }

    const total = stocks + fixedIncome + other;
    points.push({
      date: refDate,
      label: monthLabel(m),
      total: Math.round(total * 100) / 100,
      stocks: Math.round(stocks * 100) / 100,
      fixedIncome: Math.round(fixedIncome * 100) / 100,
      other: Math.round(other * 100) / 100,
      isEstimate,
    });
  }

  return points;
}
