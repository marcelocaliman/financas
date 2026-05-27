import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import { businessDaysSinceContinuous, dateInSP } from "@/lib/financial/business-days";
import {
  inferAccountCode,
  inferInvestmentCode,
  inferPhysicalCode,
  lookupBankCNPJ,
  BEM_CODES,
} from "@/services/ir/codes";
import { listFilers, getRegimeContext } from "@/services/ir/filers";
import { splitAssetByRegime, type AssetForSplit, type FilerForSplit } from "@/lib/financial/ownership-split";
import type { Currency, IndexerCode, Tables } from "@/types/database";

/**
 * Bem declarável na Ficha "Bens e Direitos".
 *
 * - `code`: 2 dígitos Receita (31, 47, 61 etc.)
 * - `group`: 2 dígitos do grupo (01-09 no leiaute 2024+)
 * - `previousYearValue`: situação em 31/12 do ano N-1 (vem do snapshot)
 * - `currentYearValue`: situação em 31/12 do ano N (calculado agora)
 * - Valores SEMPRE em BRL (Receita só aceita BRL). Conversão via BCB 31/12.
 */
export type BemDeclaravel = {
  source: "account" | "investment" | "physical";
  sourceId: string;
  code: string;
  codeLabel: string;
  group: string;
  /** "Banco X · ag 1234 c/c 5678" ou "AÇÕES PETR4 - 100 cotas a R$ 25,30" */
  discrimination: string;
  /** CNPJ formatado (XX.XXX.XXX/XXXX-XX) — opcional */
  cnpj: string | null;
  previousYearValue: number; // 31/12 do ano N-1, em BRL (manual only)
  currentYearValue: number;  // 31/12 do ano N, em BRL (projetado/provisório/final)
  /** Valor de HOJE em BRL — útil pra UI mostrar "atual" lado a lado com projeção */
  todayValue: number;
  /** Câmbio usado pra converter (vazio se ativo nativo BRL) */
  fxNote?: string;
  /**
   * "projected"  → currentYearValue calculado por composição até 31/12
   *               (RF indexada, taxa atual). Vai mudar conforme rate move.
   * "provisional" → currentYearValue é o valor de HOJE, não 31/12 real
   *                (contas/ações/cripto/bens — sem como projetar com precisão)
   * "final"      → currentYearValue é o valor REAL de 31/12 (snapshot ou ano fechado)
   */
  valuationKind: "projected" | "provisional" | "final";
};

export type DividaDeclaravel = {
  id: string;
  kind: string;
  kindLabel: string;
  description: string;
  creditorName: string;
  creditorCnpjCpf: string | null;
  currentBalance: number; // em BRL
  /** % de propriedade deste filer (após regime/override) — usado pra display */
  ownershipPct: number;
};

export type BensReport = {
  year: number;
  fxNote: string; // ex.: "Conversão USD→BRL: 5,8523 · EUR→BRL: 6,1880 (BCB 31/12/2025)"
  byGroup: Array<{
    group: string;
    groupLabel: string;
    items: BemDeclaravel[];
    totalCurrent: number;  // soma de currentYearValue (projeção 31/12)
    totalPrevious: number; // soma de previousYearValue (31/12/N-1 manual)
    totalToday: number;    // soma de todayValue (estado real agora)
  }>;
  totals: {
    current: number;  // soma de currentYearValue (projetado/provisório/final)
    previous: number; // soma do ano anterior (31/12/N-1)
    today: number;    // soma do valor de HOJE (pré-projeção)
    delta: number;    // current - previous (variação projetada vs ano-base anterior)
    yieldProjected: number; // current - today (ganho esperado até 31/12)
  };
  /**
   * Breakdown agregado por classe pra exibir no rodapé com discriminação clara.
   * Cada classe agrupa códigos relacionados — RF (codes 02, 47, 48, etc),
   * Variável (04 ações + 07 FIIs), Bens (01 imóveis + 03 veículos + 09 outros),
   * Contas (06 depósito à vista + 62 exterior).
   */
  byClass: Array<{
    label: string;        // "Renda fixa", "Renda variável", "Bens físicos", "Contas e caixa"
    today: number;        // soma de todayValue dos itens dessa classe
    projected: number;    // soma de currentYearValue (projetado quando RF, atual quando outros)
    yieldProjected: number; // projected - today (positivo só pra RF)
  }>;
  /** Dívidas e Ônus Reais — ficha separada no programa IRPF */
  dividas: {
    items: DividaDeclaravel[];
    totalCurrent: number;
    /** Dívidas declaráveis = saldo > R$ 5k (obrigatórias na ficha) */
    declarableCount: number;
  };
  /**
   * Status global da coluna "31/12/year":
   *   - "final": ano já terminou (snapshots existem) — valor definitivo
   *   - "in_progress": estamos dentro do ano — alguns valores são projeção, outros provisórios
   */
  yearStatus: "final" | "in_progress";
  /** Quantos itens são projeção (RF composta) e quantos provisórios (valor de hoje) */
  yearStatusBreakdown: {
    projected: number;
    provisional: number;
    final: number;
  };
  /**
   * True se TODOS os ativos ativos que existiam antes de 31/12/N-1 têm
   * entry manual em ir_prior_year_balances. Quando false (gap ou vazio),
   * a UI esconde a coluna "31/12/N-1" e "Variação vs N-1" pra evitar
   * comparações enganosas com dados incompletos.
   */
  previousYearIsComplete: boolean;
};

const GROUP_LABELS: Record<string, string> = {
  "01": "Imóveis",
  "02": "Bens móveis",
  "03": "Veículos / aeronaves / embarcações",
  "04": "Aplicações em renda variável",
  "05": "Aplicações em renda fixa",
  "06": "Depósito à vista e numerário",
  "07": "Fundos",
  "08": "Criptoativos",
  "09": "Outros bens e direitos",
};

function fmtCNPJ(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return raw; // mantém como veio
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function fmtMoneyBRL(v: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata data ISO (yyyy-mm-dd) como "dd/mm/yyyy" pra discriminação.
 */
function fmtDateBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Monta a discriminação para um bem físico no formato exigido pela Receita.
 * Imóveis → endereço, matrícula, cartório, IPTU, área, %.
 * Veículos → marca/modelo, ano, placa, RENAVAM.
 * Outros → nome + descrição livre.
 * Em todos os casos, anexa "Custo aquisição R$ X" e "adq. dd/mm/yyyy" no fim.
 */
function buildPhysicalDiscrimination(
  p: Tables<"physical_assets">,
  acquiredBRL: number,
): string {
  const parts: string[] = [];

  if (p.category === "real_estate") {
    if (p.address) parts.push(p.address);
    if (p.registration_number) parts.push(`matr. ${p.registration_number}`);
    if (p.registry_office) parts.push(p.registry_office);
    if (p.iptu_registration) parts.push(`IPTU ${p.iptu_registration}`);
    if (p.area_sqm != null) parts.push(`${Number(p.area_sqm)} m²`);
    if (p.ownership_percent != null && Number(p.ownership_percent) !== 100) {
      parts.push(`${Number(p.ownership_percent)}% propriedade`);
    }
    if (parts.length === 0) parts.push(p.name);
  } else if (p.category === "vehicle") {
    const brandModel = [p.brand, p.model].filter(Boolean).join(" ").trim();
    parts.push(brandModel || p.name);
    if (p.manufacture_year) parts.push(`ano ${p.manufacture_year}`);
    if (p.license_plate) parts.push(`placa ${p.license_plate}`);
    if (p.registration_number) parts.push(`RENAVAM ${p.registration_number}`);
  } else {
    parts.push(p.name);
    if (p.description) parts.push(p.description);
  }

  const acquiredDate = fmtDateBR(p.acquired_at);
  if (acquiredDate) parts.push(`adq. ${acquiredDate}`);
  parts.push(`Custo aquisição R$ ${fmtMoneyBRL(acquiredBRL)}`);
  return parts.join(" · ");
}

/**
 * Calcula o saldo de uma CONTA em 31/12 de um ano dado.
 *
 * Estratégia: assume que o `current_balance` da conta reflete o "agora".
 * Pra 31/12 do ano passado, busca o último snapshot mensal disponível
 * (patrimonio_snapshots em month_end <= 31/12). Se não tiver snapshot,
 * usa current_balance como aproximação (degraded mode).
 *
 * Limite: snapshot é POR HOUSEHOLD, não por conta — então pra obter saldo
 * exato por conta em 31/12 precisaríamos de account_snapshots. Como solução
 * pragmática, usamos o current_balance e SINALIZAMOS no UI que a
 * "Situação em 31/12 do ano corrente" é provisória até o usuário ajustar.
 */
type AccBalanceResult = {
  balance: number;
  valuationKind: "projected" | "provisional" | "final";
};

async function getAccountBalanceAt(
  accountId: string,
  currentBalance: number,
  snapshotsByAccount: Map<string, number> | undefined,
  targetIso: string,
  todayIso: string,
): Promise<AccBalanceResult> {
  if (snapshotsByAccount?.has(accountId)) {
    return {
      balance: snapshotsByAccount.get(accountId)!,
      valuationKind: "final",
    };
  }
  // Sem como projetar conta corrente (depende de fluxos futuros indeterminados).
  // Se target ainda no futuro, valor é apenas provisório.
  const isProvisional = targetIso > todayIso;
  return {
    balance: currentBalance,
    valuationKind: isProvisional ? "provisional" : "provisional",
  };
}

/**
 * Calcula o saldo de um INVESTIMENTO em 31/12 de um ano dado, projetando se necessário.
 *
 * Prioridade:
 *   1. Snapshot real de 31/12 (`investment_snapshots`) → valor FINAL
 *   2. Para RF indexada (Selic/CDI/IPCA/Prefixado), com 31/12 ainda no futuro:
 *      projeta compondo a taxa atual sobre dias úteis até 31/12 → PROJECTED
 *   3. Senão: current_balance → PROVISIONAL
 */
type IndexerRates = {
  selic: number | null; // % a.a.
  cdi: number | null;
  ipca: number | null;  // % mensal (precisa anualizar)
};

type InvForProjection = {
  id: string;
  current_balance: number;
  indexer: string | null;
  indexer_multiplier: number | null;
  fixed_rate: number | null;
  asset_type: string;
};

function ipcaMonthlyToAnnual(monthlyPct: number): number {
  return (Math.pow(1 + monthlyPct / 100, 12) - 1) * 100;
}

function dailyFromAnnualPct(annualPct: number): number {
  if (annualPct <= 0) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 252) - 1;
}

/**
 * Conta dias úteis entre fromIso (exclusivo) e toIso (inclusivo).
 * Diferente de businessDaysSinceContinuous: aqui não somamos fração do dia
 * corrente — o saldo projetado é fechamento de 31/12, ponto.
 */
function businessDaysBetween(fromIso: string, toIso: string): number {
  if (fromIso >= toIso) return 0;
  const toDate = new Date(`${toIso}T23:59:59Z`); // fim do dia
  // businessDaysSinceContinuous conta [from+1, today midnight) + today fraction
  // Pra contar fechado [from+1, to] dias úteis completos, usamos to + 1 como "hoje"
  // (assim to fica iterado no loop com cursor < toUTC, e a fração de "tomorrow" é 0)
  const tomorrowOfTo = new Date(toDate.getTime() + 86400000);
  return Math.floor(businessDaysSinceContinuous(fromIso, tomorrowOfTo));
}

/**
 * Computa fator de composição pra RF entre duas datas.
 * Retorna null se o ativo não tem indexador suportado.
 */
function rfProjectionFactor(
  inv: InvForProjection,
  fromIso: string,
  toIso: string,
  rates: IndexerRates,
): { factor: number; sourceLabel: string } | null {
  if (fromIso >= toIso) return { factor: 1, sourceLabel: "" };
  const multiplier = Number(inv.indexer_multiplier ?? 1);
  let annualPct: number | null = null;
  let label = "";

  if (inv.indexer === "selic" && rates.selic != null) {
    annualPct = rates.selic * multiplier;
    label = `${Math.round(multiplier * 100)}% Selic (${rates.selic.toFixed(2)}% a.a.)`;
  } else if (inv.indexer === "cdi" && rates.cdi != null) {
    annualPct = rates.cdi * multiplier;
    label = `${Math.round(multiplier * 100)}% CDI (${rates.cdi.toFixed(2)}% a.a.)`;
  } else if (inv.indexer === "ipca" && rates.ipca != null) {
    const ipcaAnnual = ipcaMonthlyToAnnual(rates.ipca);
    const spread = Number(inv.fixed_rate ?? 0);
    annualPct = ((1 + ipcaAnnual / 100) * (1 + spread / 100) - 1) * 100;
    label = `IPCA + ${spread.toFixed(2)}% (≈${annualPct.toFixed(2)}% a.a.)`;
  } else if (inv.indexer === "fixed" && inv.fixed_rate != null) {
    annualPct = Number(inv.fixed_rate);
    label = `Prefixado ${annualPct.toFixed(2)}% a.a.`;
  }

  if (annualPct == null) return null;
  const dailyRate = dailyFromAnnualPct(annualPct);
  const days = businessDaysBetween(fromIso, toIso);
  if (days <= 0) return { factor: 1, sourceLabel: label };
  return { factor: Math.pow(1 + dailyRate, days), sourceLabel: label };
}

type InvBalanceResult = {
  balance: number;
  valuationKind: "projected" | "provisional" | "final";
  projectionNote?: string;
};

async function getInvestmentBalanceAt(
  inv: InvForProjection,
  snapshotsByInvestment: Map<string, number> | undefined,
  targetIso: string,
  todayIso: string,
  rates: IndexerRates,
): Promise<InvBalanceResult> {
  // 1. Snapshot existe → final
  if (snapshotsByInvestment?.has(inv.id)) {
    return {
      balance: snapshotsByInvestment.get(inv.id)!,
      valuationKind: "final",
    };
  }

  const currentBalance = Number(inv.current_balance ?? 0);

  // 2. Target já passou (ano fechado sem snapshot) → provisional usa current_balance
  if (targetIso <= todayIso) {
    return { balance: currentBalance, valuationKind: "provisional" };
  }

  // 3. Target no futuro: projeta RF indexada
  const isFixedIncome =
    inv.asset_type === "fixed_income_public" ||
    inv.asset_type === "fixed_income_private";

  if (isFixedIncome) {
    const proj = rfProjectionFactor(inv, todayIso, targetIso, rates);
    if (proj) {
      return {
        balance: Math.round(currentBalance * proj.factor * 100) / 100,
        valuationKind: "projected",
        projectionNote: `Projetado de ${todayIso.split("-").reverse().join("/")} até ${targetIso.split("-").reverse().join("/")} via ${proj.sourceLabel}`,
      };
    }
  }

  // 4. Não-RF ou sem indexador conhecido: provisório (current_balance)
  return { balance: currentBalance, valuationKind: "provisional" };
}

/**
 * Gera o relatório completo de Bens e Direitos.
 *
 * - Ano N = ano passado (o ano-base do IRPF, ex.: IRPF/2026 declara ano-base 2025)
 * - Valores em BRL conforme Receita exige
 * - Conversão USD/EUR pela cotação BCB de 31/12 do ano N
 */
export async function getBensReport(
  year: number,
  householdId?: string,
  filerId?: string,
): Promise<BensReport> {
  const supabase = await createClient();

  const endOfYear = `${year}-12-31`;
  const endOfPrevYear = `${year - 1}-12-31`;

  // Carrega filers + regime pra aplicar split nos bens comuns
  const [allFilers, regimeCtx] = await Promise.all([
    listFilers(householdId),
    getRegimeContext(householdId),
  ]);
  const filersForSplit: FilerForSplit[] = allFilers.map((f) => ({
    id: f.id,
    is_primary: f.is_primary,
  }));

  const accountsQuery = supabase
    .from("accounts")
    .select("id, name, institution, type, current_balance, currency, cnpj, agency, account_number, is_exterior, country, owner_filer_id, is_particular, ownership_percent, created_at")
    .eq("is_active", true)
    .eq("exclude_from_ir", false)
    .neq("type", "credit_card");
  const debtsQuery = supabase
    .from("debts")
    .select("id, kind, description, creditor_name, creditor_cnpj_cpf, current_balance, currency, owner_filer_id, is_particular, ownership_percent, contract_date")
    .eq("is_active", true)
    .eq("exclude_from_ir", false);
  const investmentsQuery = supabase
    .from("investments")
    .select(
      "id, ticker, name, asset_type, tax_regime, initial_amount, current_balance, currency, quantity, cnpj, receita_code, account_id, owner_filer_id, is_particular, ownership_percent, purchase_date, closed_at, closed_reason, gross_proceeds_on_close, ir_withheld_on_close, indexer, indexer_multiplier, fixed_rate",
    )
    .eq("exclude_from_ir", false)
    // Inclui ativos (closed_at NULL) OU liquidados DURANTE o ano-base
    // (tinham saldo em 31/12/N-1, vendidos em N → precisam declarar saída).
    // Liquidados em anos anteriores ao N-1 já não aparecem mais.
    .or(`closed_at.is.null,closed_at.gte.${year}-01-01`);
  const physicalQuery = supabase
    .from("physical_assets")
    .select(
      "id, name, category, description, acquired_at, acquired_value, current_value, currency, receita_code, registration_number, address, registry_office, iptu_registration, area_sqm, ownership_percent, brand, model, manufacture_year, license_plate, cnpj, owner_filer_id, is_particular",
    )
    .eq("is_active", true)
    .eq("exclude_from_ir", false);
  const snapshotQuery = supabase
    .from("ir_year_snapshots")
    .select("bens, totals")
    .eq("year", year - 1);

  // Snapshots de saldo em 31/12 do ano-base (se existirem)
  const accSnapsQuery = supabase
    .from("account_snapshots")
    .select("account_id, balance")
    .eq("snapshot_date", endOfYear);
  const invSnapsQuery = supabase
    .from("investment_snapshots")
    .select("investment_id, balance, quantity")
    .eq("snapshot_date", endOfYear);
  // Saldos manuais do user pra ano N-1 (quando começou a usar app mid-year)
  const priorYearQuery = supabase
    .from("ir_prior_year_balances")
    .select("account_id, investment_id, physical_asset_id, balance")
    .eq("year", year - 1);

  const [
    rates,
    ratesPrev,
    { data: accounts },
    { data: investments },
    { data: physical },
    { data: prevSnapshot },
    { data: accSnaps },
    { data: invSnaps },
    { data: priorYearManual },
    { data: debts },
    { data: indexerRows },
  ] = await Promise.all([
    getRateMapAt(endOfYear),
    getRateMapAt(endOfPrevYear),
    (householdId ? accountsQuery.eq("household_id", householdId) : accountsQuery).order("sort_order"),
    householdId ? investmentsQuery.eq("household_id", householdId) : investmentsQuery,
    householdId ? physicalQuery.eq("household_id", householdId) : physicalQuery,
    (householdId ? snapshotQuery.eq("household_id", householdId) : snapshotQuery).maybeSingle(),
    householdId ? accSnapsQuery.eq("household_id", householdId) : accSnapsQuery,
    householdId ? invSnapsQuery.eq("household_id", householdId) : invSnapsQuery,
    householdId ? priorYearQuery.eq("household_id", householdId) : priorYearQuery,
    householdId ? debtsQuery.eq("household_id", householdId) : debtsQuery,
    // Indexadores mais recentes do BCB pra projetar RF até 31/12
    supabase
      .from("indexer_history")
      .select("indexer, value, date")
      .order("date", { ascending: false }),
  ]);

  // Resolve indexadores correntes (Selic/CDI em % a.a., IPCA em % mensal)
  const indexerRates: IndexerRates = { selic: null, cdi: null, ipca: null };
  for (const row of indexerRows ?? []) {
    const k = row.indexer as IndexerCode;
    if (k in indexerRates && indexerRates[k] == null) {
      indexerRates[k] = Number(row.value);
    }
  }

  // Data de "hoje" em SP — usada pra decidir se 31/12 é passado/futuro
  const todayIso = dateInSP(new Date()).iso;

  // Mapas pra lookup rápido nos helpers
  const accountSnapshotMap = new Map<string, number>(
    (accSnaps ?? []).map((s) => [s.account_id, Number(s.balance)]),
  );
  const investmentSnapshotMap = new Map<string, number>(
    (invSnaps ?? []).map((s) => [s.investment_id, Number(s.balance)]),
  );

  // Mapa do snapshot ano-anterior pra puxar previousYearValue
  // Prioridade: snapshot fechado (ir_year_snapshots) > entrada manual (ir_prior_year_balances)
  const prevValueBySource = new Map<string, number>();
  for (const r of priorYearManual ?? []) {
    if (r.account_id) prevValueBySource.set(`account:${r.account_id}`, Number(r.balance));
    if (r.investment_id) prevValueBySource.set(`investment:${r.investment_id}`, Number(r.balance));
    if (r.physical_asset_id) prevValueBySource.set(`physical:${r.physical_asset_id}`, Number(r.balance));
  }
  if (prevSnapshot?.bens && Array.isArray(prevSnapshot.bens)) {
    for (const b of prevSnapshot.bens as BemDeclaravel[]) {
      prevValueBySource.set(`${b.source}:${b.sourceId}`, b.currentYearValue);
    }
  }

  const bens: BemDeclaravel[] = [];

  /**
   * Calcula a fração (0–100) que o filer pedido detém num bem.
   * Se filerId for undefined, retorna 100 (visão conjunta = soma tudo).
   * Aplica o regime de bens automaticamente.
   */
  const splitPctForFiler = (asset: AssetForSplit): number => {
    if (!filerId || filersForSplit.length <= 1) return 100;
    const split = splitAssetByRegime(
      asset,
      filersForSplit,
      regimeCtx.regime,
      regimeCtx.marriageDate,
      regimeCtx.commonAssetsStrategy,
    );
    return split.find((s) => s.filerId === filerId)?.percent ?? 0;
  };

  // ---- Contas ----
  for (const a of accounts ?? []) {
    const acc = a as Tables<"accounts">;
    const pct = splitPctForFiler({
      owner_filer_id: acc.owner_filer_id,
      is_particular: acc.is_particular,
      ownership_percent: acc.ownership_percent,
      acquired_at: acc.created_at,
    });
    if (pct === 0) continue; // não aparece na declaração desse filer
    // Conta no exterior usa código 62 (depósito em moeda estrangeira) — não
    // importa o type (checking/savings/investment): a Receita exige 62.
    const code = acc.is_exterior
      ? "62"
      : acc.type === "investment"
        ? "47"
        : inferAccountCode(acc.type);
    if (!code) continue;
    const codeMeta = BEM_CODES[code];
    const currency = a.currency as Currency;
    const accResult = await getAccountBalanceAt(
      a.id,
      Number(a.current_balance ?? 0),
      accountSnapshotMap,
      endOfYear,
      todayIso,
    );
    const balance = accResult.balance;
    const balanceBRL = currency === "BRL"
      ? balance
      : convertOrSame(balance, currency, "BRL", rates);
    // Conta exterior: CNPJ brasileiro não se aplica (banco é estrangeiro).
    // Usamos "não exigido" pra deixar explícito na declaração.
    const cnpj = acc.is_exterior
      ? "não exigido"
      : fmtCNPJ(a.cnpj ?? lookupBankCNPJ(a.institution));
    const parts: string[] = [];
    if (acc.is_exterior && acc.country) parts.push(`País: ${acc.country}`);
    parts.push(a.institution);
    if (a.agency) parts.push(`ag ${a.agency}`);
    if (a.account_number) parts.push(`c/c ${a.account_number}`);
    if (currency !== "BRL") parts.push(`saldo em ${currency}: ${fmtMoneyBRL(balance)}`);
    if (pct < 100) parts.push(`${pct}% — bem em comum`);
    const prevKey = `account:${a.id}`;
    // Pra contas, "hoje" = saldo atual cru × pct (mesma coisa que currentYearValue
    // quando provisional). Só diverge se algum dia tivermos projeção de conta.
    const todayBalanceBRL = currency === "BRL"
      ? Number(a.current_balance ?? 0)
      : convertOrSame(Number(a.current_balance ?? 0), currency, "BRL", rates);

    // Sem inferência: usa só entry manual (se houver). Sem entry → 0.
    // A flag previousYearIsComplete no report sinaliza pra UI se há gaps.
    const prevValueRaw: number = prevValueBySource.get(prevKey) ?? 0;

    bens.push({
      source: "account",
      sourceId: a.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "06",
      discrimination: parts.join(" · "),
      cnpj,
      previousYearValue: Math.round((prevValueRaw * pct)) / 100,
      currentYearValue: Math.round((balanceBRL * pct)) / 100,
      todayValue: Math.round((todayBalanceBRL * pct)) / 100,
      valuationKind: accResult.valuationKind,
      fxNote: currency !== "BRL"
        ? `Convertido ${currency}→BRL pela cotação BCB de 31/12/${year}`
        : undefined,
    });
  }

  // ---- Investimentos ----
  for (const inv of investments ?? []) {
    const pct = splitPctForFiler({
      owner_filer_id: inv.owner_filer_id,
      is_particular: inv.is_particular,
      ownership_percent: inv.ownership_percent,
      acquired_at: inv.purchase_date,
    });
    if (pct === 0) continue;
    const code = inv.receita_code ?? inferInvestmentCode(
      inv.asset_type as Parameters<typeof inferInvestmentCode>[0],
      inv.tax_regime,
      inv.ticker,
    );
    const codeMeta = BEM_CODES[code];
    const currency = inv.currency as Currency;
    const invResult = await getInvestmentBalanceAt(
      {
        id: inv.id,
        current_balance: Number(inv.current_balance ?? 0),
        indexer: (inv as { indexer?: string | null }).indexer ?? null,
        indexer_multiplier: (inv as { indexer_multiplier?: number | null }).indexer_multiplier ?? null,
        fixed_rate: (inv as { fixed_rate?: number | null }).fixed_rate ?? null,
        asset_type: inv.asset_type,
      },
      investmentSnapshotMap,
      endOfYear,
      todayIso,
      indexerRates,
    );
    const balance = invResult.balance;
    const balanceBRL = currency === "BRL"
      ? balance
      : convertOrSame(balance, currency, "BRL", rates);
    // Tesouro Direto: Receita não exige CNPJ (é título federal, "Tesouro
    // Nacional" basta). Mostramos "não exigido" pra remover a dúvida do
    // usuário sobre estar incompleto.
    const cnpj = inv.asset_type === "fixed_income_public"
      ? "não exigido"
      : fmtCNPJ(inv.cnpj);
    const qty = inv.quantity ? Number(inv.quantity) : null;
    const initial = Number(inv.initial_amount ?? 0);
    const avgPrice = qty && qty > 0 ? initial / qty : null;
    const isVariable = ["fii", "stock", "etf"].includes(inv.asset_type);
    // Liquidado DURANTE o ano-base: situação atual = 0 e descrição inclui
    // a venda. Receita usa isso pra justificar a saída do bem entre 31/12 N-1
    // e 31/12 N. Sem isso, a malha estranha "onde foi parar?".
    const closedAt = (inv as { closed_at?: string | null }).closed_at ?? null;
    const closedReason = (inv as { closed_reason?: string | null }).closed_reason ?? null;
    const grossProceeds = Number((inv as { gross_proceeds_on_close?: number | null }).gross_proceeds_on_close ?? 0);
    const irWithheld = Number((inv as { ir_withheld_on_close?: number | null }).ir_withheld_on_close ?? 0);
    const isClosedInYear = !!closedAt && closedAt >= `${year}-01-01` && closedAt <= `${year}-12-31`;
    const discrParts: string[] = [];
    if (isVariable && qty) {
      // Em split, mostra qtd proporcional
      const displayQty = qty * (pct / 100);
      discrParts.push(
        `${inv.ticker} — ${displayQty.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} cotas`,
      );
      if (avgPrice) {
        discrParts.push(`PM ${currency === "BRL" ? "R$" : currency} ${avgPrice.toFixed(2)}`);
      }
    } else {
      discrParts.push(inv.name);
      discrParts.push(`Aplicado R$ ${fmtMoneyBRL(convertOrSame(initial, currency, "BRL", rates) * (pct / 100))}`);
    }
    if (currency !== "BRL") {
      discrParts.push(`saldo em ${currency}: ${fmtMoneyBRL(balance * (pct / 100))}`);
    }
    if (pct < 100) discrParts.push(`${pct}% — bem em comum`);
    if (isClosedInYear) {
      const reasonLabel = closedReason === "sold" ? "Vendido" : closedReason === "matured" ? "Vencido" : "Encerrado";
      const dateBR = closedAt!.split("-").reverse().join("/");
      const saleParts = [`${reasonLabel} em ${dateBR} por R$ ${fmtMoneyBRL(grossProceeds * (pct / 100))}`];
      if (irWithheld > 0) {
        saleParts.push(`IR retido R$ ${fmtMoneyBRL(irWithheld * (pct / 100))}`);
      }
      discrParts.push(saleParts.join(" · "));
    }
    const prevKey = `investment:${inv.id}`;
    // Sem inferência: usa entry manual ou 0.
    const prevInvValueRaw: number = prevValueBySource.get(prevKey) ?? 0;

    bens.push({
      source: "investment",
      sourceId: inv.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "04",
      discrimination: discrParts.join(" · "),
      cnpj,
      previousYearValue: Math.round((prevInvValueRaw * pct)) / 100,
      // Liquidado no ano: situação atual = 0 (saiu do patrimônio).
      currentYearValue: isClosedInYear ? 0 : Math.round((balanceBRL * pct)) / 100,
      // Valor de hoje = current_balance cru × pct (sem projeção). Pra renda
      // variável e provisórios coincide com currentYearValue; pra RF projetada
      // mostra o ponto de partida da composição.
      todayValue: isClosedInYear ? 0 : Math.round((
        (currency === "BRL"
          ? Number(inv.current_balance ?? 0)
          : convertOrSame(Number(inv.current_balance ?? 0), currency, "BRL", rates)
        ) * pct
      )) / 100,
      // Liquidado vira FINAL (valor 0 é definitivo). Caso contrário, usa o
      // resultado da projeção/snapshot.
      valuationKind: isClosedInYear ? "final" : invResult.valuationKind,
      fxNote: currency !== "BRL"
        ? `Convertido ${currency}→BRL pela cotação BCB de 31/12/${year}`
        : undefined,
    });
  }

  // ---- Bens físicos ----
  for (const p of physical ?? []) {
    const pct = splitPctForFiler({
      owner_filer_id: p.owner_filer_id,
      is_particular: p.is_particular,
      ownership_percent: p.ownership_percent,
      acquired_at: p.acquired_at,
    });
    if (pct === 0) continue;
    const code = p.receita_code ?? inferPhysicalCode(
      p.category as Parameters<typeof inferPhysicalCode>[0],
    );
    const codeMeta = BEM_CODES[code];
    const currency = p.currency as Currency;
    const value = Number(p.current_value ?? 0);
    const valueBRL = currency === "BRL"
      ? value
      : convertOrSame(value, currency, "BRL", rates);
    const acquiredBRL = convertOrSame(Number(p.acquired_value ?? 0), currency, "BRL", rates) * (pct / 100);
    let discrimination = buildPhysicalDiscrimination(
      p as Tables<"physical_assets">,
      acquiredBRL,
    );
    if (pct < 100) discrimination += ` · ${pct}% — bem em comum`;
    const prevKey = `physical:${p.id}`;
    // Códigos de participação societária (31/32/39/49) precisam de CNPJ —
    // imóveis/veículos não. Pra outros codes, deixa null (display mostra "—").
    const REQUIRES_CNPJ_CODES = ["31", "32", "39", "49"];
    const rawCnpj = (p as { cnpj?: string | null }).cnpj ?? null;
    const physicalCnpj = REQUIRES_CNPJ_CODES.includes(code) && rawCnpj
      ? fmtCNPJ(rawCnpj)
      : null;
    // Sem inferência: usa entry manual ou 0.
    const prevPhyValueRaw: number = prevValueBySource.get(prevKey) ?? 0;

    bens.push({
      source: "physical",
      sourceId: p.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "09",
      discrimination,
      cnpj: physicalCnpj,
      previousYearValue: Math.round((prevPhyValueRaw * pct)) / 100,
      currentYearValue: Math.round((valueBRL * pct)) / 100,
      // Bens físicos: valor "hoje" = valor "currentYear" (não tem projeção)
      todayValue: Math.round((valueBRL * pct)) / 100,
      // Sem como projetar — valor atual é provisório se 31/12 futuro
      valuationKind: endOfYear > todayIso ? "provisional" : "provisional",
      fxNote: currency !== "BRL"
        ? `Convertido ${currency}→BRL pela cotação BCB de 31/12/${year}`
        : undefined,
    });
  }

  // Agrupa por group
  const groupedMap = new Map<string, BemDeclaravel[]>();
  for (const b of bens) {
    const arr = groupedMap.get(b.group) ?? [];
    arr.push(b);
    groupedMap.set(b.group, arr);
  }
  const byGroup = Array.from(groupedMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => {
      items.sort((a, b) => a.code.localeCompare(b.code));
      const totalCurrent = items.reduce((s, i) => s + i.currentYearValue, 0);
      const totalPrevious = items.reduce((s, i) => s + i.previousYearValue, 0);
      const totalToday = items.reduce((s, i) => s + i.todayValue, 0);
      return {
        group,
        groupLabel: GROUP_LABELS[group] ?? group,
        items,
        totalCurrent: Math.round(totalCurrent * 100) / 100,
        totalPrevious: Math.round(totalPrevious * 100) / 100,
        totalToday: Math.round(totalToday * 100) / 100,
      };
    });

  const totalCurrent = byGroup.reduce((s, g) => s + g.totalCurrent, 0);
  const totalPrevious = byGroup.reduce((s, g) => s + g.totalPrevious, 0);
  const totalToday = bens.reduce((s, b) => s + b.todayValue, 0);

  // Breakdown por classe — agrupa códigos Receita em buckets humanos pro
  // rodapé discriminado. Códigos Receita 2024+ leiaute:
  //   Imóveis: 11/12/13/14/15/19
  //   Veículos: 21/22/23
  //   Bens móveis: 25/26/29
  //   Renda variável (mercado): 31 Ações, 73 FII, 74 ETF, 46 Ouro
  //   Participações societárias: 32 Quotas, 39 Outras
  //   Renda fixa: 47 Mercado financeiro/caixa corretora, 48 Tesouro, 49 LCI/LCA/CRI/CRA
  //   Contas e caixa: 45 Poupança, 61 CC, 62 Exterior, 63 Espécie BRL, 64 Espécie ext
  //   Fundos: 71 RF, 72 Ações, 75 Multi, 79 Outros
  //   Criptoativos: 81/82/83/89
  //   Previdência e outros: 91 PGBL, 92 VGBL, 97 Crédito, 99 Outros
  function classifyForFooter(code: string): string {
    if (["11", "12", "13", "14", "15", "19"].includes(code)) return "Imóveis";
    if (["21", "22", "23"].includes(code)) return "Veículos";
    if (["25", "26", "29"].includes(code)) return "Bens móveis";
    if (["31", "46", "73", "74"].includes(code)) return "Renda variável (Ações, FIIs, ETFs)";
    if (["32", "39"].includes(code)) return "Participações societárias";
    if (["47", "48", "49"].includes(code)) return "Renda fixa";
    if (["45", "61", "62", "63", "64"].includes(code)) return "Contas e caixa";
    if (["71", "72", "75", "79"].includes(code)) return "Fundos de investimento";
    if (["81", "82", "83", "89"].includes(code)) return "Criptoativos";
    if (["91", "92", "97", "99"].includes(code)) return "Previdência e outros direitos";
    return "Outros";
  }
  const classMap = new Map<string, { today: number; projected: number }>();
  for (const b of bens) {
    const cls = classifyForFooter(b.code);
    const cur = classMap.get(cls) ?? { today: 0, projected: 0 };
    cur.today += b.todayValue;
    cur.projected += b.currentYearValue;
    classMap.set(cls, cur);
  }
  const byClass = Array.from(classMap.entries())
    // Ordena por today desc pra colocar as classes mais relevantes em cima
    .sort(([, a], [, b]) => b.today - a.today)
    .filter(([, v]) => v.today > 0 || v.projected > 0)
    .map(([label, v]) => ({
      label,
      today: Math.round(v.today * 100) / 100,
      projected: Math.round(v.projected * 100) / 100,
      yieldProjected: Math.round((v.projected - v.today) * 100) / 100,
    }));

  // Nota de câmbio (mostra ratos USD e EUR pra BRL se houver bens estrangeiros)
  const hasUSD = bens.some((b) => b.fxNote?.includes("USD"));
  const hasEUR = bens.some((b) => b.fxNote?.includes("EUR"));
  const noteParts: string[] = [];
  if (hasUSD) {
    const r = convertOrSame(1, "USD", "BRL", rates);
    noteParts.push(`USD→BRL: ${r.toFixed(4)}`);
  }
  if (hasEUR) {
    const r = convertOrSame(1, "EUR", "BRL", rates);
    noteParts.push(`EUR→BRL: ${r.toFixed(4)}`);
  }
  const fxNote = noteParts.length > 0
    ? `${noteParts.join(" · ")} (cotação BCB 31/12/${year})`
    : "";

  void ratesPrev;

  // ---- Dívidas e Ônus Reais ----
  const DEBT_KIND_LABELS: Record<string, string> = {
    financiamento_imovel: "Financiamento de imóvel",
    financiamento_veiculo: "Financiamento de veículo",
    emprestimo_pessoal: "Empréstimo pessoal",
    emprestimo_cheque_especial: "Cheque especial",
    emprestimo_cartao_credito: "Rotativo de cartão",
    parcelamento_cartao: "Compra parcelada no cartão",
    emprestimo_pj: "Empréstimo de/para PJ",
    emprestimo_pessoa_fisica: "Empréstimo de/para PF",
    outros: "Outras dívidas",
  };
  const dividaItems: DividaDeclaravel[] = [];
  for (const d of debts ?? []) {
    const pct = splitPctForFiler({
      owner_filer_id: d.owner_filer_id,
      is_particular: d.is_particular,
      ownership_percent: d.ownership_percent,
      acquired_at: d.contract_date,
    });
    if (pct === 0) continue;
    const balanceBRL = d.currency === "BRL"
      ? Number(d.current_balance)
      : convertOrSame(Number(d.current_balance), d.currency as Currency, "BRL", rates);
    dividaItems.push({
      id: d.id,
      kind: d.kind,
      kindLabel: DEBT_KIND_LABELS[d.kind] ?? d.kind,
      description: d.description,
      creditorName: d.creditor_name,
      creditorCnpjCpf: d.creditor_cnpj_cpf,
      currentBalance: Math.round((balanceBRL * pct)) / 100,
      ownershipPct: pct,
    });
  }
  const dividasTotalCurrent = Math.round(
    dividaItems.reduce((s, x) => s + x.currentBalance, 0) * 100,
  ) / 100;
  const declarableCount = dividaItems.filter((x) => x.currentBalance > 5000).length;

  // Breakdown agregado pra UI mostrar quantos itens são projeção vs provisório
  const yearStatusBreakdown = {
    projected: bens.filter((b) => b.valuationKind === "projected").length,
    provisional: bens.filter((b) => b.valuationKind === "provisional").length,
    final: bens.filter((b) => b.valuationKind === "final").length,
  };
  const yearStatus: "final" | "in_progress" =
    yearStatusBreakdown.projected === 0 && yearStatusBreakdown.provisional === 0
      ? "final"
      : "in_progress";

  // Completude do 31/12/N-1: true se todos os ativos atuais que existiam
  // antes daquela data tem entry manual. Gap → false → UI esconde a coluna.
  const previousYearIsComplete = (() => {
    // Investimentos: precisam de entry manual se purchase_date <= endOfPrevYear
    for (const inv of investments ?? []) {
      if (
        inv.purchase_date &&
        inv.purchase_date <= endOfPrevYear &&
        !prevValueBySource.has(`investment:${inv.id}`)
      ) {
        return false;
      }
    }
    // Contas: precisam de entry se created_at <= endOfPrevYear
    for (const a of accounts ?? []) {
      const acc = a as Tables<"accounts">;
      if (
        acc.created_at &&
        acc.created_at.slice(0, 10) <= endOfPrevYear &&
        !prevValueBySource.has(`account:${a.id}`)
      ) {
        return false;
      }
    }
    // Bens físicos: precisam de entry se acquired_at <= endOfPrevYear
    for (const p of physical ?? []) {
      if (
        p.acquired_at &&
        p.acquired_at <= endOfPrevYear &&
        !prevValueBySource.has(`physical:${p.id}`)
      ) {
        return false;
      }
    }
    return true;
  })();

  return {
    year,
    fxNote,
    byGroup,
    totals: {
      current: Math.round(totalCurrent * 100) / 100,
      previous: Math.round(totalPrevious * 100) / 100,
      today: Math.round(totalToday * 100) / 100,
      delta: Math.round((totalCurrent - totalPrevious) * 100) / 100,
      yieldProjected: Math.round((totalCurrent - totalToday) * 100) / 100,
    },
    dividas: {
      items: dividaItems,
      totalCurrent: dividasTotalCurrent,
      declarableCount,
    },
    yearStatus,
    yearStatusBreakdown,
    previousYearIsComplete,
    byClass,
  };
}
