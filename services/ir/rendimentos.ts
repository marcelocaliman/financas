import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import type { Currency, Tables } from "@/types/database";

/**
 * Classificação dos rendimentos do ano-base nas 3 categorias do IRPF:
 *
 *   1) tributaveis: salário, pró-labore, aluguel — entra na tabela progressiva
 *   2) isentos: LCI/LCA, dividendos de ações, FII rendimentos, poupança
 *   3) exclusivo_fonte: 13º, JCP, aplicações RF (já tributado pela fonte)
 *
 * A fonte é DUPLA:
 *  - Automático: a partir de transações income + investment_yields + dividend
 *    movements (já presentes no app).
 *  - Manual: ir_other_incomes — pra coisas que vc não lança no app (CLT que
 *    cai em conta fora do app, freelance externo, etc.).
 */

export type RendimentoRow = {
  source: "auto" | "manual";
  sourceId: string | null;
  description: string;
  payerName: string;
  payerCnpjCpf: string | null;
  grossAmount: number; // em BRL
  irrf: number;
  inss: number;
  thirteenth: number;
  /** Código Receita da Ficha (depende da categoria) */
  receitaCode?: string;
};

export type RendimentosReport = {
  year: number;
  tributaveis: {
    rows: RendimentoRow[];
    total: number;
    totalIrrf: number;
    totalInss: number;
    total13: number;
  };
  isentos: {
    rows: RendimentoRow[];
    total: number;
    dividends: number;
    lciLca: number;
    poupanca: number;
    fiiRendimentos: number;
    other: number;
  };
  exclusivos: {
    rows: RendimentoRow[];
    total: number;
    rendaFixa: number;
    jcp: number;
    thirteenth: number;
    other: number;
  };
};

const SALARY_CATEGORIES = new Set(["salário", "salario", "pró-labore", "pro labore"]);
const RENT_CATEGORIES = new Set(["aluguel recebido", "aluguel"]);

export async function getRendimentosReport(
  year: number,
  householdId?: string,
  filerId?: string,
): Promise<RendimentosReport> {
  const supabase = await createClient();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const rates = await getRateMapAt(yearEnd);

  const txQuery = supabase
    .from("transactions")
    .select(
      "description, amount_account, currency, date, irrf_amount, inss_amount, category:categories(name), account:accounts!inner(currency, institution, owner_filer_id), fonte:fontes_pagadoras(id, type, name, cnpj, cpf)",
    )
    .gte("date", yearStart)
    .lte("date", yearEnd)
    .eq("kind", "income")
    .eq("exclude_from_ir", false);
  const yieldsQuery = supabase
    .from("investment_yields")
    .select("month, gross_yield, tax, investment:investments!inner(ticker, name, tax_regime, currency, asset_type, cnpj, owner_filer_id)")
    .gte("month", yearStart)
    .lte("month", yearEnd);
  const divQuery = supabase
    .from("investment_movements")
    .select("date, total_amount, investment:investments!inner(ticker, name, asset_type, currency, cnpj, owner_filer_id)")
    .eq("kind", "dividend")
    .gte("date", yearStart)
    .lte("date", yearEnd);
  const othersQuery = supabase
    .from("ir_other_incomes")
    .select("*")
    .eq("year", year);

  // Atribuição por filer: tx via account.owner_filer_id, yields/divs via
  // investments.owner_filer_id, ir_other_incomes direto.
  const scopedTx = filerId ? txQuery.eq("account.owner_filer_id", filerId) : txQuery;
  const scopedYields = filerId ? yieldsQuery.eq("investment.owner_filer_id", filerId) : yieldsQuery;
  const scopedDiv = filerId ? divQuery.eq("investment.owner_filer_id", filerId) : divQuery;
  const scopedOthers = filerId ? othersQuery.eq("owner_filer_id", filerId) : othersQuery;

  // Carnê-leão (DARF 0190): renda de PF tributável. A tabela carne_leao_mensal
  // não tem atribuição por declarante, então só entra na visão household
  // (filerId indefinido) — pra declaração por filer não dá pra ratear.
  const carneLeaoQuery =
    !filerId
      ? (() => {
          let q = supabase
            .from("carne_leao_mensal")
            .select("description, gross_amount, deductible_expenses, month")
            .eq("year", year);
          if (householdId) q = q.eq("household_id", householdId);
          return q;
        })()
      : null;

  const [
    { data: txs },
    { data: yields },
    { data: dividendMovements },
    { data: others },
    carneLeaoRes,
  ] = await Promise.all([
    householdId ? scopedTx.eq("household_id", householdId) : scopedTx,
    householdId ? scopedYields.eq("household_id", householdId) : scopedYields,
    householdId ? scopedDiv.eq("household_id", householdId) : scopedDiv,
    householdId ? scopedOthers.eq("household_id", householdId) : scopedOthers,
    carneLeaoQuery ?? Promise.resolve({ data: null }),
  ]);
  const carneLeaoRows = (carneLeaoRes as { data: Array<{ description: string; gross_amount: number; deductible_expenses: number | null }> | null }).data;

  const tributaveis: RendimentoRow[] = [];
  const isentos: RendimentoRow[] = [];
  const exclusivos: RendimentoRow[] = [];

  // ---- INCOME TRANSACTIONS → tributável (salário, pró-labore, aluguel) ----
  type TxRow = {
    description: string | null;
    amount_account: number;
    currency: Currency | null;
    date: string;
    irrf_amount: number | null;
    inss_amount: number | null;
    category: { name: string } | { name: string }[] | null;
    account: { currency: Currency; institution: string } | { currency: Currency; institution: string }[] | null;
    fonte:
      | { id: string; type: string; name: string; cnpj: string | null; cpf: string | null }
      | { id: string; type: string; name: string; cnpj: string | null; cpf: string | null }[]
      | null;
  };

  // Agrupa por fonte_pagadora QUANDO existe; senão agrupa por (categoria + descrição)
  const txsAgg = new Map<
    string,
    { gross: number; irrf: number; inss: number; payer: string; cnpjCpf: string | null; cat: string; isDistribuicaoLucros: boolean }
  >();

  for (const t of (txs ?? []) as unknown as TxRow[]) {
    const cat = Array.isArray(t.category) ? t.category[0] : t.category;
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    const fonte = Array.isArray(t.fonte) ? t.fonte[0] : t.fonte;
    const c = (acc?.currency ?? t.currency ?? "BRL") as Currency;
    const amt = convertOrSame(Number(t.amount_account ?? 0), c, "BRL", rates);
    const irrf = convertOrSame(Number(t.irrf_amount ?? 0), c, "BRL", rates);
    const inss = convertOrSame(Number(t.inss_amount ?? 0), c, "BRL", rates);
    const catName = (cat?.name ?? "").toLowerCase();

    // Heurística: distribuição de lucros de PJ própria do usuário → isento
    // Detectado quando: fonte é pj_propria E (descrição menciona "distribui*"
    // ou "lucro" sem ser salário/pró-labore)
    const desc = (t.description ?? "").toLowerCase();
    const isDistribuicaoLucros =
      fonte?.type === "pj_propria" &&
      (desc.includes("distribu") || desc.includes("lucro") || desc.includes("dividendo"));

    if (fonte) {
      const key = `fonte:${fonte.id}${isDistribuicaoLucros ? ":lucros" : ""}`;
      const e = txsAgg.get(key) ?? {
        gross: 0, irrf: 0, inss: 0,
        payer: fonte.name,
        cnpjCpf: fonte.cnpj ?? fonte.cpf,
        cat: catName,
        isDistribuicaoLucros,
      };
      e.gross += amt;
      e.irrf += irrf;
      e.inss += inss;
      txsAgg.set(key, e);
    } else {
      const payer = (t.description ?? "Recebimento").trim();
      const key = `cat:${catName}::${payer}`;
      const e = txsAgg.get(key) ?? {
        gross: 0, irrf: 0, inss: 0,
        payer, cnpjCpf: null, cat: catName, isDistribuicaoLucros: false,
      };
      e.gross += amt;
      e.irrf += irrf;
      e.inss += inss;
      txsAgg.set(key, e);
    }
  }

  for (const [, e] of txsAgg) {
    if (e.isDistribuicaoLucros) {
      // Distribuição de lucros PJ própria → isento código 09
      isentos.push({
        source: "auto",
        sourceId: null,
        description: `Distribuição de lucros — ${e.payer}`,
        payerName: e.payer,
        payerCnpjCpf: e.cnpjCpf,
        grossAmount: Math.round(e.gross * 100) / 100,
        irrf: 0, inss: 0, thirteenth: 0,
        receitaCode: "09",
      });
    } else if (
      SALARY_CATEGORIES.has(e.cat) ||
      RENT_CATEGORIES.has(e.cat) ||
      e.cnpjCpf // se tem fonte cadastrada, vai pra tributável
    ) {
      tributaveis.push({
        source: "auto",
        sourceId: null,
        description: e.cat || "Rendimento",
        payerName: e.payer,
        payerCnpjCpf: e.cnpjCpf,
        grossAmount: Math.round(e.gross * 100) / 100,
        irrf: Math.round(e.irrf * 100) / 100,
        inss: Math.round(e.inss * 100) / 100,
        thirteenth: 0,
      });
    } else if (e.cat.includes("renda passiva") || e.cat.includes("dividend")) {
      isentos.push({
        source: "auto",
        sourceId: null,
        description: "Lucros e dividendos (categoria " + e.cat + ")",
        payerName: e.payer,
        payerCnpjCpf: e.cnpjCpf,
        grossAmount: Math.round(e.gross * 100) / 100,
        irrf: 0, inss: 0, thirteenth: 0,
        receitaCode: "09",
      });
    }
  }

  // ---- INVESTMENT YIELDS (renda fixa) → exclusivo na fonte OU isento ----
  type YieldRow = {
    month: string;
    gross_yield: number;
    tax: number;
    investment:
      | { ticker: string; name: string; tax_regime: string; currency: Currency; asset_type: string; cnpj: string | null }
      | { ticker: string; name: string; tax_regime: string; currency: Currency; asset_type: string; cnpj: string | null }[]
      | null;
  };
  const yieldsByAsset = new Map<string, { gross: number; tax: number; meta: { ticker: string; name: string; regime: string; type: string; cnpj: string | null; currency: Currency } }>();
  for (const y of (yields ?? []) as YieldRow[]) {
    const inv = Array.isArray(y.investment) ? y.investment[0] : y.investment;
    if (!inv) continue;
    const c = inv.currency;
    const g = convertOrSame(Number(y.gross_yield ?? 0), c, "BRL", rates);
    const t = convertOrSame(Number(y.tax ?? 0), c, "BRL", rates);
    const k = inv.ticker;
    const e = yieldsByAsset.get(k) ?? {
      gross: 0,
      tax: 0,
      meta: { ticker: inv.ticker, name: inv.name, regime: inv.tax_regime, type: inv.asset_type, cnpj: inv.cnpj, currency: inv.currency },
    };
    e.gross += g;
    e.tax += t;
    yieldsByAsset.set(k, e);
  }
  for (const [, e] of yieldsByAsset) {
    const isFII = e.meta.type === "fii";
    const isExempt = e.meta.regime === "exempt";
    const row: RendimentoRow = {
      source: "auto",
      sourceId: null,
      description: `Rendimentos ${e.meta.ticker} — ${e.meta.name}`,
      payerName: e.meta.name,
      payerCnpjCpf: e.meta.cnpj,
      grossAmount: Math.round(e.gross * 100) / 100,
      irrf: Math.round(e.tax * 100) / 100,
      inss: 0,
      thirteenth: 0,
    };
    if (isFII) {
      // FII: rendimentos mensais são isentos (código 26 — rendimentos isentos)
      isentos.push({ ...row, receitaCode: "26" });
    } else if (isExempt) {
      // LCI/LCA/CRI/CRA isentos → código 12
      isentos.push({ ...row, receitaCode: "12" });
    } else {
      // CDB/Tesouro tributado na fonte → código 06
      exclusivos.push({ ...row, receitaCode: "06" });
    }
  }

  // ---- DIVIDEND MOVEMENTS (ações/ETFs) → isentos ----
  type MovRow = {
    date: string;
    total_amount: number;
    investment:
      | { ticker: string; name: string; asset_type: string; currency: Currency; cnpj: string | null }
      | { ticker: string; name: string; asset_type: string; currency: Currency; cnpj: string | null }[]
      | null;
  };
  const divsByTicker = new Map<string, { gross: number; meta: { ticker: string; name: string; cnpj: string | null; type: string } }>();
  for (const m of (dividendMovements ?? []) as MovRow[]) {
    const inv = Array.isArray(m.investment) ? m.investment[0] : m.investment;
    if (!inv) continue;
    const g = convertOrSame(Number(m.total_amount ?? 0), inv.currency, "BRL", rates);
    const e = divsByTicker.get(inv.ticker) ?? {
      gross: 0,
      meta: { ticker: inv.ticker, name: inv.name, cnpj: inv.cnpj, type: inv.asset_type },
    };
    e.gross += g;
    divsByTicker.set(inv.ticker, e);
  }
  for (const [, e] of divsByTicker) {
    // JCP iria pra exclusivo (cod 10) — sem flag pra distinguir, presume todos dividendos
    isentos.push({
      source: "auto",
      sourceId: null,
      description: `Dividendos ${e.meta.ticker} — ${e.meta.name}`,
      payerName: e.meta.name,
      payerCnpjCpf: e.meta.cnpj,
      grossAmount: Math.round(e.gross * 100) / 100,
      irrf: 0, inss: 0, thirteenth: 0,
      receitaCode: "09",
    });
  }

  // ---- MANUAL (ir_other_incomes) ----
  for (const o of (others ?? []) as Tables<"ir_other_incomes">[]) {
    const c = o.currency as Currency;
    const gross = convertOrSame(Number(o.gross_amount), c, "BRL", rates);
    const irrf = convertOrSame(Number(o.irrf_amount ?? 0), c, "BRL", rates);
    const inss = convertOrSame(Number(o.inss_amount ?? 0), c, "BRL", rates);
    const t13 = convertOrSame(Number(o.thirteenth_amount ?? 0), c, "BRL", rates);
    const row: RendimentoRow = {
      source: "manual",
      sourceId: o.id,
      description: o.description,
      payerName: o.source_name,
      payerCnpjCpf: o.source_cnpj_cpf,
      grossAmount: Math.round(gross * 100) / 100,
      irrf: Math.round(irrf * 100) / 100,
      inss: Math.round(inss * 100) / 100,
      thirteenth: Math.round(t13 * 100) / 100,
    };
    if (o.category === "tributavel_pj" || o.category === "tributavel_pf") {
      tributaveis.push(row);
    } else if (o.category === "isento") {
      isentos.push({ ...row, receitaCode: "99" });
    } else if (o.category === "exclusivo_fonte") {
      exclusivos.push({ ...row, receitaCode: "99" });
    } else if (o.category === "rendimento_acumulado") {
      tributaveis.push(row);
    }
  }

  // ---- CARNÊ-LEÃO (renda PF) ----
  // Entra na base tributável anual já LÍQUIDA das despesas dedutíveis
  // (condomínio/IPTU no aluguel), que é o que de fato é tributado. O imposto
  // mensal pago (DARF 0190) é creditado como antecipação em computeImposto.
  for (const cl of carneLeaoRows ?? []) {
    const netTaxable =
      Math.round((Number(cl.gross_amount) - Number(cl.deductible_expenses ?? 0)) * 100) / 100;
    if (netTaxable <= 0) continue;
    tributaveis.push({
      source: "auto",
      sourceId: null,
      description: `Carnê-leão · ${cl.description}`,
      payerName: "Pessoa física",
      payerCnpjCpf: null,
      grossAmount: netTaxable,
      irrf: 0,
      inss: 0,
      thirteenth: 0,
    });
  }

  const sumGross = (arr: RendimentoRow[]) =>
    Math.round(arr.reduce((s, r) => s + r.grossAmount, 0) * 100) / 100;
  const sumIrrf = (arr: RendimentoRow[]) =>
    Math.round(arr.reduce((s, r) => s + r.irrf, 0) * 100) / 100;
  const sumInss = (arr: RendimentoRow[]) =>
    Math.round(arr.reduce((s, r) => s + r.inss, 0) * 100) / 100;
  const sum13 = (arr: RendimentoRow[]) =>
    Math.round(arr.reduce((s, r) => s + r.thirteenth, 0) * 100) / 100;

  // Breakdown dos isentos
  const dividends = sumGross(isentos.filter((r) => r.receitaCode === "09"));
  const lciLca = sumGross(isentos.filter((r) => r.receitaCode === "12"));
  const fiiRendimentos = sumGross(isentos.filter((r) => r.receitaCode === "26"));
  const other = sumGross(isentos) - dividends - lciLca - fiiRendimentos;
  // Breakdown dos exclusivos
  const rendaFixa = sumGross(exclusivos.filter((r) => r.receitaCode === "06"));
  const jcp = sumGross(exclusivos.filter((r) => r.receitaCode === "10"));
  const thirteenth = sum13(tributaveis);
  const otherExcl = sumGross(exclusivos) - rendaFixa - jcp;

  return {
    year,
    tributaveis: {
      rows: tributaveis,
      total: sumGross(tributaveis),
      totalIrrf: sumIrrf(tributaveis),
      totalInss: sumInss(tributaveis),
      total13: thirteenth,
    },
    isentos: {
      rows: isentos,
      total: sumGross(isentos),
      dividends,
      lciLca,
      poupanca: 0,
      fiiRendimentos,
      other: Math.max(0, other),
    },
    exclusivos: {
      rows: exclusivos,
      total: sumGross(exclusivos),
      rendaFixa,
      jcp,
      thirteenth,
      other: Math.max(0, otherExcl),
    },
  };
}
