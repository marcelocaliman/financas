import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Auditoria runtime do sistema. Verifica consistência de dados, sincronização
 * de fontes externas, completude de configuração IR.
 *
 * Usado pela página /configuracoes/auditoria pra mostrar saúde do sistema
 * em tempo real. Cada usuário vê apenas o que é do seu household.
 */

export type Severity = "critical" | "major" | "minor" | "info";

export type Finding = {
  severity: Severity;
  area: string;
  title: string;
  detail?: string;
  /** Ação sugerida pra resolver. Quando presente, UI mostra botão/link. */
  fix?: {
    label: string;
    href?: string;
    action?: string; // server action key
  };
};

export type AuditReport = {
  generatedAt: string;
  counts: Record<Severity, number>;
  findings: Finding[];
};

export async function runAudit(): Promise<AuditReport> {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return {
      generatedAt: new Date().toISOString(),
      counts: { critical: 0, major: 0, minor: 0, info: 0 },
      findings: [],
    };
  }

  const supabase = await createClient();
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // ─── 1) Investimentos ─────────────────────────────────────────────
  const { data: invsRaw } = await supabase
    .from("investments")
    .select(
      "id, ticker, name, asset_type, indexer, indexer_multiplier, fixed_rate, initial_amount, current_balance, quantity, purchase_date, last_yield_at, closed_at, is_active, gross_proceeds_on_close, ir_withheld_on_close",
    )
    .eq("household_id", ctx.household.id);

  const invs = invsRaw ?? [];
  const activeInvs = invs.filter((i) => i.is_active);
  const closedInYear = invs.filter(
    (i) =>
      i.closed_at &&
      i.closed_at >= `${currentYear}-01-01` &&
      i.closed_at <= `${currentYear}-12-31`,
  );

  // Ativos sem quantity (necessário pra live sync de RV)
  for (const i of activeInvs) {
    if (
      (i.asset_type === "stock" || i.asset_type === "fii" || i.asset_type === "etf") &&
      !i.quantity
    ) {
      add({
        severity: "major",
        area: "Investimentos",
        title: `${i.ticker}: sem quantity cadastrado`,
        detail:
          "Necessário pra calcular valor live (qty × cotação brapi). Sem isso, IR e investimentos divergem.",
        fix: { label: "Cadastrar quantity", href: `/investimentos` },
      });
    }
    if (
      (i.asset_type === "fixed_income_public" || i.asset_type === "fixed_income_private") &&
      !i.indexer
    ) {
      add({
        severity: "major",
        area: "Investimentos",
        title: `${i.ticker}: RF sem indexador`,
        detail: "Sem indexador, não dá pra calcular yield diário.",
      });
    }
    if ((i.indexer === "ipca" || i.indexer === "fixed") && i.fixed_rate == null) {
      add({
        severity: "major",
        area: "Investimentos",
        title: `${i.ticker}: ${i.indexer} sem fixed_rate`,
        detail: "Sem taxa fixa cadastrada, projeção fica zerada.",
      });
    }
  }

  // Placeholder purchase_dates
  const purchaseDates = new Set(
    activeInvs.map((i) => i.purchase_date).filter(Boolean),
  );
  if (purchaseDates.size === 1 && activeInvs.length > 2) {
    const [single] = Array.from(purchaseDates);
    add({
      severity: "major",
      area: "Investimentos",
      title: `Todos os ${activeInvs.length} investimentos com mesma purchase_date (${single})`,
      detail:
        "Padrão típico de placeholder. As datas reais são necessárias pra cálculo histórico, custo médio (ganho de capital) e projeção correta.",
      fix: { label: "Editar datas reais", href: "/investimentos" },
    });
  }

  // ─── 2) Sincronização de fontes externas ──────────────────────────
  // Cast genérico — várias dessas colunas (fetched_at) foram adicionadas
  // via migrations que ainda não regeraram types automaticamente.
  const supaAny = supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        order: (c: string, o: object) => {
          limit: (n: number) => Promise<{ data: Array<Record<string, string>> | null }>;
        };
      };
    };
  };
  const syncChecks = [
    { table: "indexer_history", col: "fetched_at", label: "BCB (Selic/CDI/IPCA)", staleAfterHours: 48 },
    { table: "currency_rates", col: "fetched_at", label: "Câmbio (Frankfurter)", staleAfterHours: 48 },
    { table: "quote_snapshots", col: "fetched_at", label: "Cotações brapi", staleAfterHours: 24 },
    { table: "patrimonio_snapshots", col: "created_at", label: "Snapshot patrimônio", staleAfterHours: 30 * 24 },
  ];
  for (const c of syncChecks) {
    const { data } = await supaAny
      .from(c.table)
      .select(c.col)
      .order(c.col, { ascending: false })
      .limit(1);
    const last = data?.[0]?.[c.col] as string | undefined;
    if (!last) {
      add({
        severity: "major",
        area: "Sincronização",
        title: `${c.label}: sem dados`,
        detail: "Cron correspondente nunca rodou ou tabela vazia.",
      });
      continue;
    }
    const ageH = (Date.now() - new Date(last).getTime()) / 3600000;
    if (ageH > c.staleAfterHours) {
      add({
        severity: ageH > c.staleAfterHours * 2 ? "critical" : "major",
        area: "Sincronização",
        title: `${c.label}: ${ageH.toFixed(1)}h sem atualização`,
        detail: `Última atualização ${new Date(last).toLocaleString("pt-BR")}. Cron pode ter parado.`,
      });
    }
  }

  // ─── 3) Tabelas IRPF cadastradas ──────────────────────────────────
  type TableRow = { year: number; is_estimate: boolean };
  const { data: taxTablesRaw } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          order: (c: string, o: object) => Promise<{ data: TableRow[] | null }>;
        };
      };
    }
  )
    .from("ir_tax_table_annual")
    .select("year, is_estimate")
    .order("year", { ascending: false });
  const taxTables = taxTablesRaw ?? [];
  if (!taxTables.some((t) => t.year === currentYear)) {
    add({
      severity: "critical",
      area: "Tabelas IRPF",
      title: `Tabela ano-base ${currentYear} não cadastrada`,
      detail:
        "Cálculo de imposto vai falhar pra esse ano. Cadastrar via SQL em ir_tax_table_annual.",
    });
  }
  for (const t of taxTables.filter((t) => t.is_estimate)) {
    add({
      severity: "info",
      area: "Tabelas IRPF",
      title: `Tabela ${t.year} é estimativa`,
      detail: "Atualizar quando Receita publicar MP/Lei oficial pra esse ano.",
    });
  }

  // ─── 4) Contas com saldo suspeito ─────────────────────────────────
  const { data: accountsRaw } = await supabase
    .from("accounts")
    .select("name, type, current_balance, is_active")
    .eq("household_id", ctx.household.id)
    .eq("is_active", true);
  for (const a of accountsRaw ?? []) {
    if (Number(a.current_balance) < 0 && a.type !== "credit_card") {
      add({
        severity: "major",
        area: "Contas",
        title: `${a.name}: saldo negativo (R$ ${Number(a.current_balance).toFixed(2)})`,
        detail: "Apenas cartão de crédito deve ter saldo negativo.",
      });
    }
  }

  // (5) Lançamento de rendimento exclusivo de fonte por liquidação:
  // agora é tratado automaticamente em services/ir/exclusive-income-sync.ts
  // — chamado em liquidateInvestment e no render de /ir/[year].
  // Nada pra detectar aqui; se houver gap, o próprio /ir conserta.

  // ─── 6) Rendimentos do ano (tributáveis) ──────────────────────────
  const { data: txIncomesRaw } = await supabase
    .from("transactions")
    .select("id, amount_account", { count: "exact" })
    .eq("household_id", ctx.household.id)
    .eq("kind", "income")
    .eq("exclude_from_ir", false)
    .gte("date", `${currentYear}-01-01`)
    .lte("date", `${currentYear}-12-31`);
  const txIncomeCount = (txIncomesRaw ?? []).length;
  if (txIncomeCount === 0) {
    add({
      severity: "major",
      area: "IR · Rendimentos tributáveis",
      title: `Nenhum rendimento cadastrado em ${currentYear}`,
      detail:
        "Sem rendimentos (salário/pró-labore/aluguel), o cálculo de imposto fica em zero. Cadastre via /transacoes (kind=income) ou em /ir/configuracoes.",
      fix: { label: "Ir pra IR Configurações", href: `/ir/${currentYear}/configuracoes` },
    });
  }

  // ─── 7) Duplicatas ────────────────────────────────────────────────
  const tickerCounts = new Map<string, number>();
  for (const i of activeInvs) {
    tickerCounts.set(i.ticker, (tickerCounts.get(i.ticker) ?? 0) + 1);
  }
  for (const [ticker, count] of tickerCounts) {
    if (count > 1) {
      add({
        severity: "major",
        area: "Duplicatas",
        title: `Ticker ${ticker} aparece ${count}× em investments ativos`,
      });
    }
  }

  // ─── 8) Filers / dependentes ──────────────────────────────────────
  const { data: filers } = await supabase
    .from("ir_filers")
    .select("id, full_name, cpf, is_primary")
    .eq("household_id", ctx.household.id);
  if (!filers || filers.length === 0) {
    add({
      severity: "critical",
      area: "IR · Declarantes",
      title: "Nenhum declarante cadastrado",
      detail: "Precisa pelo menos 1 declarante (titular) pra exportar pra Receita.",
      fix: { label: "Cadastrar declarante", href: "/declarantes" },
    });
  } else {
    for (const f of filers) {
      if (!f.cpf) {
        add({
          severity: "major",
          area: "IR · Declarantes",
          title: `Declarante "${f.full_name}" sem CPF`,
          detail: "Obrigatório pra exportação Receita.",
          fix: { label: "Editar declarante", href: "/declarantes" },
        });
      }
    }
  }

  // ─── 9) Investimentos antigos sem prior_year_balance ──────────────
  const { data: priorBalancesRaw } = await supabase
    .from("ir_prior_year_balances")
    .select("investment_id")
    .eq("household_id", ctx.household.id);
  const priorInvIds = new Set(
    (priorBalancesRaw ?? []).map((p) => p.investment_id).filter(Boolean),
  );
  const oldInvsWithoutPrior = activeInvs.filter(
    (i) =>
      i.purchase_date &&
      i.purchase_date <= `${previousYear}-12-31` &&
      !priorInvIds.has(i.id),
  );
  if (oldInvsWithoutPrior.length > 0) {
    add({
      severity: "info",
      area: "IR · Saldos ano anterior",
      title: `${oldInvsWithoutPrior.length} investimento(s) sem saldo cadastrado em 31/12/${previousYear}`,
      detail: `${oldInvsWithoutPrior.map((i) => i.ticker).join(", ")}. UI esconde a coluna 31/12/${previousYear} por isso. Cadastre via /ir/${currentYear}/configuracoes pra ter comparação ano-a-ano.`,
      fix: { label: "Cadastrar saldos", href: `/ir/${currentYear}/configuracoes` },
    });
  }

  // ─── Computa contadores e retorna ────────────────────────────────
  const counts: Record<Severity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    info: 0,
  };
  for (const f of findings) counts[f.severity]++;

  return {
    generatedAt: new Date().toISOString(),
    counts,
    findings,
  };
}
