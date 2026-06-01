import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import { classifyIncomeTx } from "@/services/ir/classify-income";
import {
  isAposentadoriaCategory,
  isDistribuicaoLucrosCategory,
} from "@/services/ir/income-aliases";
import {
  splitAposentadoriaExemption,
  type FilerExemptionProfile,
} from "@/services/ir/exencoes";
import { getAnnualTaxTable } from "@/services/ir/ir-tax-tables";
import type { IrWarning } from "@/services/ir/warnings";
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
  /** Confiança da classificação automática (preenchido p/ não-classificados). */
  confidence?: "alta" | "baixa";
  /** Razão da classificação (mostrada na revisão). */
  reason?: string;
  /** Chave estável da origem — usada no modo revisão pra persistir a decisão. */
  originKey?: string;
};

/** Bucket que o usuário pode escolher no modo revisão. */
export type IncomeOverrideBucket = "tributavel" | "isento" | "exclusivo";

type Classification = ReturnType<typeof classifyIncomeTx>;

/**
 * Aplica a decisão do usuário (modo revisão) SOBRE uma classificação automática.
 * Só sobrepõe quando o motor não conseguiu classificar (`naoClassificado`) — uma
 * renda que o motor classifica com confiança não é silenciosamente sobrescrita.
 */
function applyOverride(
  cls: Classification,
  override?: { bucket: IncomeOverrideBucket; receitaCode: string | null },
): Classification {
  if (!override || cls.bucket !== "naoClassificado") return cls;
  return {
    bucket: override.bucket,
    receitaCode: override.receitaCode ?? (override.bucket === "isento" ? "99" : undefined),
    confidence: "alta",
    reason: "Classificado manualmente na revisão",
  };
}

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
  /**
   * Rendimentos que o motor NÃO conseguiu classificar com segurança. Ficam
   * FORA de toda base de cálculo (decisão D7, fail-loud) e sempre disparam um
   * aviso — nunca são descartados em silêncio.
   */
  naoClassificados: {
    rows: RendimentoRow[];
    total: number;
  };
  /** Avisos tipados (renda não classificada, aluguel a verificar, etc.). */
  warnings: IrWarning[];
};

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

  // Carnê-leão (DARF 0190): renda de PF tributável. carne_leao_mensal TEM
  // filer_id (migration 20260524130000) — então na declaração separada entra
  // só a renda do filer; na conjunta (sem filerId), tudo do household.
  const carneLeaoQuery = (() => {
    let q = supabase
      .from("carne_leao_mensal")
      .select("description, gross_amount, deductible_expenses, month")
      .eq("year", year);
    if (householdId) q = q.eq("household_id", householdId);
    if (filerId) q = q.eq("filer_id", filerId);
    return q;
  })();

  // Perfis dos declarantes (idade + moléstia grave) pra isenção de
  // aposentadoria/pensão; e a parcela isenta vigente no ano.
  const filersQuery = householdId
    ? supabase
        .from("ir_filers")
        .select("id, birth_date, has_serious_illness")
        .eq("household_id", householdId)
    : supabase.from("ir_filers").select("id, birth_date, has_serious_illness");

  const [
    { data: txs },
    { data: yields },
    { data: dividendMovements },
    { data: others },
    carneLeaoRes,
    { data: filers },
    annualTable,
  ] = await Promise.all([
    householdId ? scopedTx.eq("household_id", householdId) : scopedTx,
    householdId ? scopedYields.eq("household_id", householdId) : scopedYields,
    householdId ? scopedDiv.eq("household_id", householdId) : scopedDiv,
    householdId ? scopedOthers.eq("household_id", householdId) : scopedOthers,
    carneLeaoQuery ?? Promise.resolve({ data: null }),
    filersQuery,
    getAnnualTaxTable(year),
  ]);
  const carneLeaoRows = (carneLeaoRes as { data: Array<{ description: string; gross_amount: number; deductible_expenses: number | null }> | null }).data;

  // Overrides do modo revisão: decisões do usuário sobre rendas que o motor
  // não classificou. Chave = origin_key. Aplicadas só sobre `naoClassificado`.
  const { data: overridesRows } = await (
    householdId
      ? supabase
          .from("ir_income_classifications")
          .select("origin_key, bucket, receita_code")
          .eq("year", year)
          .eq("household_id", householdId)
      : supabase
          .from("ir_income_classifications")
          .select("origin_key, bucket, receita_code")
          .eq("year", year)
  );
  const overrides = new Map<string, { bucket: IncomeOverrideBucket; receitaCode: string | null }>();
  for (const o of overridesRows ?? []) {
    overrides.set(o.origin_key, {
      bucket: o.bucket as IncomeOverrideBucket,
      receitaCode: o.receita_code,
    });
  }

  // Mapa filerId → perfil de isenção.
  const filerProfiles = new Map<string, FilerExemptionProfile>();
  for (const f of (filers ?? []) as Array<{ id: string; birth_date: string | null; has_serious_illness: boolean }>) {
    filerProfiles.set(f.id, {
      birthDate: f.birth_date,
      hasSeriousIllness: Boolean(f.has_serious_illness),
    });
  }
  const elderlyMonthly = annualTable.elderlyMonthlyExemption;

  // Aposentadoria/pensão acumulada por declarante — a isenção 65+/moléstia é
  // por pessoa e tem teto anual, então acumulamos e aplicamos no fim.
  const aposentadoriaByFiler = new Map<
    string,
    { gross: number; irrf: number; inss: number; filerId: string | null }
  >();
  const addAposentadoria = (
    filerId: string | null,
    gross: number,
    irrf: number,
    inss: number,
  ) => {
    const key = filerId ?? "__none__";
    const e = aposentadoriaByFiler.get(key) ?? { gross: 0, irrf: 0, inss: 0, filerId };
    e.gross += gross;
    e.irrf += irrf;
    e.inss += inss;
    aposentadoriaByFiler.set(key, e);
  };

  const tributaveis: RendimentoRow[] = [];
  const isentos: RendimentoRow[] = [];
  const exclusivos: RendimentoRow[] = [];
  const naoClassificados: RendimentoRow[] = [];
  const warnings: IrWarning[] = [];

  // ---- INCOME TRANSACTIONS → tributável (salário, pró-labore, aluguel) ----
  type TxRow = {
    description: string | null;
    amount_account: number;
    currency: Currency | null;
    date: string;
    irrf_amount: number | null;
    inss_amount: number | null;
    category: { name: string } | { name: string }[] | null;
    account:
      | { currency: Currency; institution: string; owner_filer_id: string | null }
      | { currency: Currency; institution: string; owner_filer_id: string | null }[]
      | null;
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

    // Aposentadoria/pensão é interceptada ANTES da agregação: a isenção 65+/
    // moléstia é por declarante e tem teto anual, processada à parte.
    if (isAposentadoriaCategory(catName)) {
      addAposentadoria(acc?.owner_filer_id ?? null, amt, irrf, inss);
      continue;
    }

    // Distribuição de lucros de PJ própria → isento. Sinal EXPLÍCITO via
    // categoria "Distribuição de lucros"; mantemos a heurística antiga (fonte
    // pj_propria + descrição) só como fallback pra dados legados.
    const desc = (t.description ?? "").toLowerCase();
    const isDistribuicaoLucros =
      isDistribuicaoLucrosCategory(catName) ||
      (fonte?.type === "pj_propria" &&
        (desc.includes("distribu") || desc.includes("lucro") || desc.includes("dividendo")));

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

  for (const [aggKey, e] of txsAgg) {
    const gross = Math.round(e.gross * 100) / 100;
    const originKey = `tx:${aggKey}`;
    const cls = applyOverride(
      classifyIncomeTx({
        cat: e.cat,
        hasPayer: Boolean(e.cnpjCpf),
        isDistribuicaoLucros: e.isDistribuicaoLucros,
      }),
      overrides.get(originKey),
    );

    // Descrição legível por bucket.
    const description =
      cls.bucket === "isento" && cls.receitaCode === "09" && e.isDistribuicaoLucros
        ? `Distribuição de lucros — ${e.payer}`
        : cls.bucket === "isento"
          ? `Lucros e dividendos${e.cat ? ` (categoria ${e.cat})` : ""}`
          : e.cat || e.payer || "Rendimento";

    const row: RendimentoRow = {
      source: "auto",
      sourceId: null,
      description,
      payerName: e.payer,
      payerCnpjCpf: e.cnpjCpf,
      grossAmount: gross,
      // Só o bucket tributável carrega IRRF/INSS retidos na base progressiva.
      irrf: cls.bucket === "tributavel" ? Math.round(e.irrf * 100) / 100 : 0,
      inss: cls.bucket === "tributavel" ? Math.round(e.inss * 100) / 100 : 0,
      thirteenth: 0,
      receitaCode: cls.receitaCode,
      confidence: cls.confidence,
      reason: cls.reason,
      originKey,
    };

    switch (cls.bucket) {
      case "tributavel":
        tributaveis.push(row);
        break;
      case "isento":
        isentos.push(row);
        break;
      case "exclusivo":
        exclusivos.push(row);
        break;
      case "naoClassificado":
        naoClassificados.push(row);
        break;
    }

    if (cls.warning) {
      warnings.push({ ...cls.warning, amount: gross, origin: e.cat || e.payer });
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
  for (const o of (others ?? []) as Array<
    Tables<"ir_other_incomes"> & { owner_filer_id: string | null }
  >) {
    const c = o.currency as Currency;
    const gross = convertOrSame(Number(o.gross_amount), c, "BRL", rates);
    const irrf = convertOrSame(Number(o.irrf_amount ?? 0), c, "BRL", rates);
    const inss = convertOrSame(Number(o.inss_amount ?? 0), c, "BRL", rates);
    const t13 = convertOrSame(Number(o.thirteenth_amount ?? 0), c, "BRL", rates);

    // Aposentadoria/pensão manual → vai pro pool de isenção por declarante.
    if ((o.category as string) === "aposentadoria_pensao") {
      addAposentadoria(o.owner_filer_id ?? null, gross, irrf, inss);
      continue;
    }

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
    } else {
      // Categoria manual ausente/desconhecida → fail-loud, A NÃO SER que o
      // usuário já tenha resolvido no modo revisão.
      const originKey = `manual:${o.id}`;
      const ov = overrides.get(originKey);
      if (ov) {
        const resolved: RendimentoRow = {
          ...row,
          receitaCode: ov.receitaCode ?? (ov.bucket === "isento" ? "99" : undefined),
          confidence: "alta",
          reason: "Classificado manualmente na revisão",
          originKey,
        };
        if (ov.bucket === "tributavel") tributaveis.push(resolved);
        else if (ov.bucket === "isento") isentos.push(resolved);
        else exclusivos.push(resolved);
      } else {
        naoClassificados.push({
          ...row,
          confidence: "baixa",
          reason: `Renda manual sem categoria reconhecida${o.category ? ` ('${o.category}')` : ""}`,
          originKey,
        });
        warnings.push({
          code: "renda_nao_classificada",
          severity: "critico",
          message:
            "Uma renda lançada manualmente está sem categoria de IR válida e ficou FORA do cálculo. Defina a categoria pra não subtributar.",
          amount: row.grossAmount,
          origin: o.description,
        });
      }
    }
  }

  // ---- APOSENTADORIA/PENSÃO → aplica isenção 65+/moléstia por declarante ----
  for (const [, e] of aposentadoriaByFiler) {
    const gross = Math.round(e.gross * 100) / 100;
    if (gross <= 0) continue;
    const profile: FilerExemptionProfile = (e.filerId && filerProfiles.get(e.filerId)) || {
      birthDate: null,
      hasSeriousIllness: false,
    };
    const split = splitAposentadoriaExemption(gross, profile, year, elderlyMonthly);
    const irrf = Math.round(e.irrf * 100) / 100;
    const inss = Math.round(e.inss * 100) / 100;

    if (split.isento > 0) {
      // código 10 = parcela isenta 65+; 11 = aposentadoria por moléstia grave.
      const receitaCode = split.reason === "molestia_grave" ? "11" : "10";
      isentos.push({
        source: "auto",
        sourceId: null,
        description:
          split.reason === "molestia_grave"
            ? "Aposentadoria/pensão isenta (moléstia grave)"
            : "Parcela isenta de aposentadoria (maiores de 65 anos)",
        payerName: "Previdência/Fonte",
        payerCnpjCpf: null,
        grossAmount: split.isento,
        irrf: 0,
        inss: 0,
        thirteenth: 0,
        receitaCode,
        confidence: "alta",
        reason: split.reason === "molestia_grave" ? "Moléstia grave (100% isento)" : "Idade 65+",
      });
    }

    if (split.tributavel > 0) {
      tributaveis.push({
        source: "auto",
        sourceId: null,
        description: "Aposentadoria/pensão (parcela tributável)",
        payerName: "Previdência/Fonte",
        payerCnpjCpf: null,
        grossAmount: split.tributavel,
        irrf,
        inss,
        thirteenth: 0,
      });
    } else if (irrf > 0) {
      // Totalmente isenta mas com IRRF retido → restituível; não pode sumir.
      tributaveis.push({
        source: "auto",
        sourceId: null,
        description: "IRRF sobre aposentadoria isenta (restituível)",
        payerName: "Previdência/Fonte",
        payerCnpjCpf: null,
        grossAmount: 0,
        irrf,
        inss: 0,
        thirteenth: 0,
      });
      warnings.push({
        code: "irrf_sobre_isento",
        severity: "info",
        message:
          "Há IRRF retido sobre aposentadoria isenta — é restituível. Confira o informe da fonte.",
        amount: irrf,
        origin: "aposentadoria",
      });
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
    naoClassificados: {
      rows: naoClassificados,
      total: sumGross(naoClassificados),
    },
    warnings,
  };
}
