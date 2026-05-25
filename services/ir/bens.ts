import "server-only";
import { createClient } from "@/lib/supabase/server";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";
import {
  inferAccountCode,
  inferInvestmentCode,
  inferPhysicalCode,
  lookupBankCNPJ,
  BEM_CODES,
} from "@/services/ir/codes";
import { listFilers, getRegimeContext } from "@/services/ir/filers";
import { splitAssetByRegime, type AssetForSplit, type FilerForSplit } from "@/lib/financial/ownership-split";
import type { Currency, Tables } from "@/types/database";

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
  previousYearValue: number; // 31/12 do ano N-1, em BRL
  currentYearValue: number;  // 31/12 do ano N, em BRL
  /** Câmbio usado pra converter (vazio se ativo nativo BRL) */
  fxNote?: string;
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
    totalCurrent: number;
    totalPrevious: number;
  }>;
  totals: {
    current: number;
    previous: number;
    delta: number;
  };
  /** Dívidas e Ônus Reais — ficha separada no programa IRPF */
  dividas: {
    items: DividaDeclaravel[];
    totalCurrent: number;
    /** Dívidas declaráveis = saldo > R$ 5k (obrigatórias na ficha) */
    declarableCount: number;
  };
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
async function getAccountBalanceAt(
  accountId: string,
  currentBalance: number,
  snapshotsByAccount?: Map<string, number>,
): Promise<number> {
  if (snapshotsByAccount?.has(accountId)) {
    return snapshotsByAccount.get(accountId)!;
  }
  return currentBalance;
}

/**
 * Calcula o saldo de um INVESTIMENTO em 31/12 de um ano dado.
 *
 * Pra renda fixa: compõe da data de compra até 31/12 (se ano corrente),
 * ou do checkpoint até 31/12 (se ano passado). MVP: usa current_balance.
 * Pra renda variável: qty × cotação no fechamento de 31/12. MVP: current_balance.
 *
 * O usuário pode editar manualmente o valor final na UI antes de exportar.
 */
async function getInvestmentBalanceAt(
  investmentId: string,
  currentBalance: number,
  snapshotsByInvestment?: Map<string, number>,
): Promise<number> {
  if (snapshotsByInvestment?.has(investmentId)) {
    return snapshotsByInvestment.get(investmentId)!;
  }
  return currentBalance;
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
      "id, ticker, name, asset_type, tax_regime, initial_amount, current_balance, currency, quantity, cnpj, receita_code, account_id, owner_filer_id, is_particular, ownership_percent, purchase_date, closed_at, closed_reason, gross_proceeds_on_close, ir_withheld_on_close",
    )
    .eq("exclude_from_ir", false)
    // Inclui ativos (closed_at NULL) OU liquidados DURANTE o ano-base
    // (tinham saldo em 31/12/N-1, vendidos em N → precisam declarar saída).
    // Liquidados em anos anteriores ao N-1 já não aparecem mais.
    .or(`closed_at.is.null,closed_at.gte.${year}-01-01`);
  const physicalQuery = supabase
    .from("physical_assets")
    .select(
      "id, name, category, description, acquired_at, acquired_value, current_value, currency, receita_code, registration_number, address, registry_office, iptu_registration, area_sqm, ownership_percent, brand, model, manufacture_year, license_plate, owner_filer_id, is_particular",
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
  ]);

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
    const balance = await getAccountBalanceAt(
      a.id,
      Number(a.current_balance ?? 0),
      accountSnapshotMap,
    );
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
    bens.push({
      source: "account",
      sourceId: a.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "06",
      discrimination: parts.join(" · "),
      cnpj,
      previousYearValue: Math.round((prevValueBySource.get(prevKey) ?? 0) * pct) / 100,
      currentYearValue: Math.round((balanceBRL * pct)) / 100,
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
    const balance = await getInvestmentBalanceAt(
      inv.id,
      Number(inv.current_balance ?? 0),
      investmentSnapshotMap,
    );
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
    bens.push({
      source: "investment",
      sourceId: inv.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "04",
      discrimination: discrParts.join(" · "),
      cnpj,
      previousYearValue: Math.round((prevValueBySource.get(prevKey) ?? 0) * pct) / 100,
      // Liquidado no ano: situação atual = 0 (saiu do patrimônio).
      currentYearValue: isClosedInYear ? 0 : Math.round((balanceBRL * pct)) / 100,
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
    bens.push({
      source: "physical",
      sourceId: p.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "09",
      discrimination,
      cnpj: null,
      previousYearValue: Math.round((prevValueBySource.get(prevKey) ?? 0) * pct) / 100,
      currentYearValue: Math.round((valueBRL * pct)) / 100,
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
      return {
        group,
        groupLabel: GROUP_LABELS[group] ?? group,
        items,
        totalCurrent: Math.round(totalCurrent * 100) / 100,
        totalPrevious: Math.round(totalPrevious * 100) / 100,
      };
    });

  const totalCurrent = byGroup.reduce((s, g) => s + g.totalCurrent, 0);
  const totalPrevious = byGroup.reduce((s, g) => s + g.totalPrevious, 0);

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

  return {
    year,
    fxNote,
    byGroup,
    totals: {
      current: Math.round(totalCurrent * 100) / 100,
      previous: Math.round(totalPrevious * 100) / 100,
      delta: Math.round((totalCurrent - totalPrevious) * 100) / 100,
    },
    dividas: {
      items: dividaItems,
      totalCurrent: dividasTotalCurrent,
      declarableCount,
    },
  };
}
