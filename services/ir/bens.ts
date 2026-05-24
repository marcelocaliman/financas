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
): Promise<BensReport> {
  const supabase = await createClient();

  const endOfYear = `${year}-12-31`;
  const endOfPrevYear = `${year - 1}-12-31`;

  const accountsQuery = supabase
    .from("accounts")
    .select("id, name, institution, type, current_balance, currency, cnpj, agency, account_number")
    .eq("is_active", true)
    .neq("type", "credit_card");
  const investmentsQuery = supabase
    .from("investments")
    .select(
      "id, ticker, name, asset_type, tax_regime, initial_amount, current_balance, currency, quantity, cnpj, receita_code, account_id",
    )
    .eq("is_active", true);
  const physicalQuery = supabase
    .from("physical_assets")
    .select(
      "id, name, category, description, acquired_value, current_value, currency, receita_code, registration_number, address",
    )
    .eq("is_active", true);
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

  const [
    rates,
    ratesPrev,
    { data: accounts },
    { data: investments },
    { data: physical },
    { data: prevSnapshot },
    { data: accSnaps },
    { data: invSnaps },
  ] = await Promise.all([
    getRateMapAt(endOfYear),
    getRateMapAt(endOfPrevYear),
    (householdId ? accountsQuery.eq("household_id", householdId) : accountsQuery).order("sort_order"),
    householdId ? investmentsQuery.eq("household_id", householdId) : investmentsQuery,
    householdId ? physicalQuery.eq("household_id", householdId) : physicalQuery,
    (householdId ? snapshotQuery.eq("household_id", householdId) : snapshotQuery).maybeSingle(),
    householdId ? accSnapsQuery.eq("household_id", householdId) : accSnapsQuery,
    householdId ? invSnapsQuery.eq("household_id", householdId) : invSnapsQuery,
  ]);

  // Mapas pra lookup rápido nos helpers
  const accountSnapshotMap = new Map<string, number>(
    (accSnaps ?? []).map((s) => [s.account_id, Number(s.balance)]),
  );
  const investmentSnapshotMap = new Map<string, number>(
    (invSnaps ?? []).map((s) => [s.investment_id, Number(s.balance)]),
  );

  // Mapa do snapshot ano-anterior pra puxar previousYearValue
  const prevValueBySource = new Map<string, number>();
  if (prevSnapshot?.bens && Array.isArray(prevSnapshot.bens)) {
    for (const b of prevSnapshot.bens as BemDeclaravel[]) {
      prevValueBySource.set(`${b.source}:${b.sourceId}`, b.currentYearValue);
    }
  }

  const bens: BemDeclaravel[] = [];

  // ---- Contas ----
  for (const a of accounts ?? []) {
    const code = (a as Tables<"accounts">).type === "investment"
      ? "47"
      : inferAccountCode((a as Tables<"accounts">).type);
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
    const cnpj = fmtCNPJ(a.cnpj ?? lookupBankCNPJ(a.institution));
    const parts = [a.institution];
    if (a.agency) parts.push(`ag ${a.agency}`);
    if (a.account_number) parts.push(`c/c ${a.account_number}`);
    if (currency !== "BRL") parts.push(`saldo em ${currency}: ${fmtMoneyBRL(balance)}`);
    const prevKey = `account:${a.id}`;
    bens.push({
      source: "account",
      sourceId: a.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "06",
      discrimination: parts.join(" · "),
      cnpj,
      previousYearValue: prevValueBySource.get(prevKey) ?? 0,
      currentYearValue: Math.round(balanceBRL * 100) / 100,
      fxNote: currency !== "BRL"
        ? `Convertido ${currency}→BRL pela cotação BCB de 31/12/${year}`
        : undefined,
    });
  }

  // ---- Investimentos ----
  for (const inv of investments ?? []) {
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
    const cnpj = fmtCNPJ(inv.cnpj);
    const qty = inv.quantity ? Number(inv.quantity) : null;
    const initial = Number(inv.initial_amount ?? 0);
    const avgPrice = qty && qty > 0 ? initial / qty : null;
    const isVariable = ["fii", "stock", "etf"].includes(inv.asset_type);
    const discrParts: string[] = [];
    if (isVariable && qty) {
      discrParts.push(
        `${inv.ticker} — ${qty.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} cotas`,
      );
      if (avgPrice) {
        discrParts.push(`PM ${currency === "BRL" ? "R$" : currency} ${avgPrice.toFixed(2)}`);
      }
    } else {
      discrParts.push(inv.name);
      discrParts.push(`Aplicado R$ ${fmtMoneyBRL(convertOrSame(initial, currency, "BRL", rates))}`);
    }
    if (currency !== "BRL") {
      discrParts.push(`saldo em ${currency}: ${fmtMoneyBRL(balance)}`);
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
      previousYearValue: prevValueBySource.get(prevKey) ?? 0,
      currentYearValue: Math.round(balanceBRL * 100) / 100,
      fxNote: currency !== "BRL"
        ? `Convertido ${currency}→BRL pela cotação BCB de 31/12/${year}`
        : undefined,
    });
  }

  // ---- Bens físicos ----
  for (const p of physical ?? []) {
    const code = p.receita_code ?? inferPhysicalCode(
      p.category as Parameters<typeof inferPhysicalCode>[0],
    );
    const codeMeta = BEM_CODES[code];
    const currency = p.currency as Currency;
    const value = Number(p.current_value ?? 0);
    const valueBRL = currency === "BRL"
      ? value
      : convertOrSame(value, currency, "BRL", rates);
    const parts: string[] = [p.name];
    if (p.address) parts.push(p.address);
    if (p.registration_number) parts.push(`reg ${p.registration_number}`);
    if (p.description) parts.push(p.description);
    parts.push(`Custo aquisição R$ ${fmtMoneyBRL(
      convertOrSame(Number(p.acquired_value ?? 0), currency, "BRL", rates),
    )}`);
    const prevKey = `physical:${p.id}`;
    bens.push({
      source: "physical",
      sourceId: p.id,
      code,
      codeLabel: codeMeta?.label ?? "—",
      group: codeMeta?.group ?? "09",
      discrimination: parts.join(" · "),
      cnpj: null,
      previousYearValue: prevValueBySource.get(prevKey) ?? 0,
      currentYearValue: Math.round(valueBRL * 100) / 100,
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

  return {
    year,
    fxNote,
    byGroup,
    totals: {
      current: Math.round(totalCurrent * 100) / 100,
      previous: Math.round(totalPrevious * 100) / 100,
      delta: Math.round((totalCurrent - totalPrevious) * 100) / 100,
    },
  };
}
