#!/usr/bin/env node
/**
 * Auditoria completa do sistema. Conecta via pooler, coleta dados de TODAS
 * as tabelas relevantes, executa checks de consistência, e produz relatório
 * em AUDIT_REPORT.md.
 *
 * Roda: node scripts/audit.mjs
 */
import postgres from "postgres";
import { readFileSync, writeFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l.includes("="))
  .reduce((acc, l) => {
    const [k, ...v] = l.split("=");
    acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {});

const ref = env.SUPABASE_PROJECT_REF;
const pwd = env.SUPABASE_DB_PASSWORD;
const sql = postgres(
  `postgresql://postgres.${ref}:${encodeURIComponent(pwd)}@aws-1-us-west-1.pooler.supabase.com:6543/postgres`,
  { ssl: "require", max: 1 },
);

const findings = {
  critical: [],
  major: [],
  minor: [],
  info: [],
};

function add(level, area, problem, detail = null) {
  findings[level].push({ area, problem, detail });
}

const fmt = (n) =>
  typeof n === "number" ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : String(n);
const ageHours = (ts) =>
  ts ? ((Date.now() - new Date(ts).getTime()) / 3600000).toFixed(1) : null;
const today = new Date().toISOString().slice(0, 10);

async function main() {
  console.log("Auditando...\n");

  // ========= INVESTIMENTOS =========
  const inv = await sql`
    select * from public.investments where is_active = true order by current_balance desc
  `;
  for (const i of inv) {
    if (!i.purchase_date) {
      add("major", "investments", `${i.ticker}: sem purchase_date`);
    }
    if (
      (i.asset_type === "stock" || i.asset_type === "fii" || i.asset_type === "etf") &&
      !i.quantity
    ) {
      add(
        "major",
        "investments",
        `${i.ticker}: ação/FII/ETF sem quantity cadastrada`,
        `Necessário pra cálculo de live (qty × cotação brapi). Sem ele, IR usa current_balance estático.`,
      );
    }
    if (
      (i.asset_type === "fixed_income_public" || i.asset_type === "fixed_income_private") &&
      !i.indexer
    ) {
      add(
        "major",
        "investments",
        `${i.ticker}: RF sem indexador definido`,
        `Sem indexador, não dá pra calcular yield diário nem projeção 31/12.`,
      );
    }
    if (i.indexer === "selic" || i.indexer === "cdi") {
      if (!i.indexer_multiplier) {
        add(
          "minor",
          "investments",
          `${i.ticker}: indexer ${i.indexer} sem multiplier`,
          `Default = 1.0 (100%); valide se é correto.`,
        );
      }
    }
    if (i.indexer === "ipca" || i.indexer === "fixed") {
      if (i.fixed_rate == null) {
        add(
          "major",
          "investments",
          `${i.ticker}: indexer ${i.indexer} sem fixed_rate`,
          `Sem taxa fixa, projeção fica zerada.`,
        );
      }
    }
    if (Number(i.current_balance) < Number(i.initial_amount) - 0.01 && i.asset_type === "fixed_income_public") {
      add(
        "minor",
        "investments",
        `${i.ticker}: current_balance (${fmt(Number(i.current_balance))}) MENOR que initial_amount (${fmt(Number(i.initial_amount))})`,
        `RF normalmente rende; saldo menor que aplicado é estranho (a menos que tenha resgatado parcialmente).`,
      );
    }
  }

  // Verifica purchase_date placeholders (todos iguais)
  const purchaseDates = [...new Set(inv.map((i) => i.purchase_date?.toISOString().slice(0, 10)).filter(Boolean))];
  if (purchaseDates.length === 1 && inv.length > 2) {
    add(
      "major",
      "investments",
      `Todos os ${inv.length} investimentos têm a MESMA purchase_date (${purchaseDates[0]})`,
      `Padrão típico de placeholder. As datas reais são necessárias pra IR (custo médio, ganho de capital) e pra projeção correta.`,
    );
  }

  // ========= LIVE SYNC =========
  const live = await sql`
    select 'indexer_history' as src, max(fetched_at) as last
    from public.indexer_history
    union all
    select 'currency_rates', max(fetched_at) from public.currency_rates
    union all
    select 'tesouro_quotes', max(fetched_at) from public.tesouro_quotes
    union all
    select 'quote_snapshots', max(fetched_at) from public.quote_snapshots
    union all
    select 'patrimonio_snapshots', max(created_at) from public.patrimonio_snapshots
  `;
  for (const r of live) {
    if (!r.last) {
      add("major", "sync", `${r.src}: SEM DADOS`, `Cron correspondente nunca rodou ou tabela vazia.`);
    } else {
      const h = parseFloat(ageHours(r.last));
      if (r.src === "quote_snapshots" && h > 24) {
        add("critical", "sync", `${r.src}: ${h}h sem update`, `Cotações brapi stale.`);
      } else if (r.src === "indexer_history" && h > 48) {
        add("major", "sync", `${r.src}: ${h}h sem update`, `BCB indexers desatualizados.`);
      } else if (r.src === "tesouro_quotes" && h > 48) {
        add("major", "sync", `${r.src}: ${h}h sem update`, `Tesouro PU desatualizado — cron sync-tesouro-prices.`);
      } else if (r.src === "patrimonio_snapshots" && h > 30 * 24) {
        add("minor", "sync", `${r.src}: mais de 30 dias`, `Cron mensal pode ter quebrado.`);
      }
    }
  }

  // ========= TABELAS IRPF =========
  const taxAnnual = await sql`select year, is_estimate from public.ir_tax_table_annual order by year`;
  const taxMonthly = await sql`select year, effective_from_month from public.ir_tax_table_monthly order by year`;
  const years = new Set(taxAnnual.map((t) => t.year));
  const currentYear = new Date().getFullYear();
  if (!years.has(currentYear)) {
    add("critical", "ir-tables", `Tabela IRPF anual ${currentYear} NÃO cadastrada`);
  }
  const estimates = taxAnnual.filter((t) => t.is_estimate);
  for (const e of estimates) {
    add("info", "ir-tables", `Tabela ${e.year} é estimativa`, `Atualizar quando Receita publicar MP/Lei oficial.`);
  }

  // ========= CONTAS =========
  const accs = await sql`select * from public.accounts where is_active = true`;
  for (const a of accs) {
    if (Number(a.current_balance) < 0 && a.type !== "credit_card") {
      add(
        "major",
        "accounts",
        `${a.name}: saldo NEGATIVO R$ ${fmt(Number(a.current_balance))} em conta tipo ${a.type}`,
        `Apenas cartão de crédito deve ter saldo negativo (dívida).`,
      );
    }
  }

  // ========= IR YEAR METADATA =========
  const yearMeta = await sql`select * from public.ir_year_metadata order by year`;
  for (const m of yearMeta) {
    // Não tem campo específico de "atrás" — só verifica se existe
  }

  // ========= RENDIMENTOS PRO ANO-BASE CORRENTE =========
  const incomeYear = currentYear;
  const txIncome = await sql`
    select count(*) as count, coalesce(sum(amount_account)::numeric, 0) as total
    from public.transactions
    where kind = 'income'
      and exclude_from_ir = false
      and date >= ${incomeYear + "-01-01"}
      and date <= ${incomeYear + "-12-31"}
  `;
  if (Number(txIncome[0].count) === 0) {
    add(
      "major",
      "ir-rendimentos",
      `ZERO rendimentos tributáveis cadastrados em ${incomeYear}`,
      `App está computando imposto a pagar mas sem renda. Verificar se rendimentos (salário/pró-labore/aluguel) foram cadastrados como transactions kind=income com categoria adequada.`,
    );
  } else {
    add(
      "info",
      "ir-rendimentos",
      `${txIncome[0].count} transações de income em ${incomeYear}, total R$ ${fmt(Number(txIncome[0].total))}`,
    );
  }

  const otherIncomes = await sql`
    select count(*) as count from public.ir_other_incomes where year = ${incomeYear}
  `;
  if (Number(otherIncomes[0].count) === 0) {
    add(
      "minor",
      "ir-rendimentos",
      `ir_other_incomes vazio pra ${incomeYear}`,
      `Se você recebeu JCP, dividendos, alugueis, isentos, deveria cadastrar aqui.`,
    );
  }

  // ========= INVESTIMENTOS LIQUIDADOS NO ANO =========
  const closed = await sql`
    select ticker, closed_at, closed_reason, gross_proceeds_on_close, ir_withheld_on_close
    from public.investments
    where closed_at is not null and closed_at >= ${incomeYear + "-01-01"}
      and closed_at <= ${incomeYear + "-12-31"}
    order by closed_at
  `;
  if (closed.length > 0) {
    add(
      "info",
      "ir-rendimentos",
      `${closed.length} ativo(s) liquidados em ${incomeYear}`,
      closed.map((c) => `${c.ticker} em ${c.closed_at.toISOString().slice(0, 10)} por R$ ${fmt(Number(c.gross_proceeds_on_close))} (IR retido R$ ${fmt(Number(c.ir_withheld_on_close))})`).join(" · "),
    );

    // Cada um deveria ter gerado um lançamento de "rendimento exclusivo fonte"
    for (const c of closed) {
      const matchingExclusive = await sql`
        select count(*) as count from public.ir_other_incomes
        where year = ${incomeYear}
          and category = 'rendimento_aplicacao_financeira'
          and source_name like ${"%" + c.ticker + "%"}
      `;
      if (Number(matchingExclusive[0].count) === 0) {
        add(
          "minor",
          "ir-rendimentos",
          `${c.ticker} liquidado mas sem lançamento de rendimento exclusivo fonte em ir_other_incomes`,
          `Quando RF vence/é vendida, o broker retém 15% sobre rendimento. Esse valor precisa aparecer em "Rendimentos sujeitos a tributação exclusiva".`,
        );
      }
    }
  }

  // ========= DIVIDENDOS / JCP =========
  const dividends = await sql`
    select i.ticker, sum(m.total_amount)::numeric as total, count(*) as count
    from public.investment_movements m
    join public.investments i on i.id = m.investment_id
    where m.kind = 'dividend'
      and m.date >= ${incomeYear + "-01-01"}
      and m.date <= ${incomeYear + "-12-31"}
    group by i.ticker
  `;
  for (const d of dividends) {
    add(
      "info",
      "ir-rendimentos",
      `${d.ticker}: ${d.count} dividendos em ${incomeYear}, total R$ ${fmt(Number(d.total))}`,
      `Dividendos de PF brasileira são ISENTOS de IR (lei atual). JCP é tributado 15% na fonte — separar via tipo do movimento.`,
    );
  }

  // ========= CONSISTÊNCIA: investimentos × prior_year =========
  const prevYear = currentYear - 1;
  const priorBalances = await sql`
    select investment_id from public.ir_prior_year_balances where investment_id is not null
  `;
  const priorIds = new Set(priorBalances.map((p) => p.investment_id));
  const activeBeforePrevYear = inv.filter(
    (i) => i.purchase_date && i.purchase_date.toISOString().slice(0, 10) <= `${prevYear}-12-31` && !priorIds.has(i.id),
  );
  if (activeBeforePrevYear.length > 0) {
    add(
      "minor",
      "ir-prior-year",
      `${activeBeforePrevYear.length} investimento(s) com purchase_date <= 31/12/${prevYear} sem saldo registrado em ir_prior_year_balances`,
      activeBeforePrevYear.map((i) => i.ticker).join(", ") + `. UI esconde a coluna 31/12/${prevYear} por isso, mas se quiser comparação ano-a-ano, cadastre manualmente.`,
    );
  }

  // ========= CARTÃO DE CRÉDITO: dívida cadastrada como bem? =========
  // Já verificado nas accounts. Cartão XP -R$ 11.935,88 é dívida.

  // ========= DUPLICATAS =========
  const dupInv = await sql`
    select ticker, count(*) as count from public.investments where is_active = true group by ticker having count(*) > 1
  `;
  for (const d of dupInv) {
    add(
      "major",
      "duplicates",
      `Ticker "${d.ticker}" aparece ${d.count}× em investments ativos`,
    );
  }

  // ========= FILERS / DEPENDENTES =========
  const filers = await sql`select * from public.ir_filers order by is_primary desc`;
  if (filers.length === 0) {
    add(
      "critical",
      "ir-filers",
      `Nenhum filer cadastrado`,
      `Precisa pelo menos 1 declarante (titular) pra exportar pra Receita.`,
    );
  }
  for (const f of filers) {
    if (!f.cpf) {
      add("major", "ir-filers", `Filer "${f.name}" sem CPF`, `Obrigatório pra exportação.`);
    }
  }

  const deps = await sql`select * from public.ir_dependents where is_active = true`;
  for (const d of deps) {
    if (!d.cpf && d.dependency_type !== "filho_menor") {
      add("minor", "ir-dependents", `Dependente "${d.full_name}" sem CPF`, `Dependente >12 anos precisa ter CPF.`);
    }
  }

  // ========= RESULTADO =========
  let report = `# 🔍 Auditoria do Sistema — ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC\n\n`;
  report += `## Sumário\n\n`;
  report += `- 🔴 **Críticos**: ${findings.critical.length}\n`;
  report += `- 🟠 **Maiores**: ${findings.major.length}\n`;
  report += `- 🟡 **Menores**: ${findings.minor.length}\n`;
  report += `- ℹ️ **Informativos**: ${findings.info.length}\n\n`;
  report += `---\n\n`;

  const sections = [
    ["🔴 Críticos", findings.critical],
    ["🟠 Maiores", findings.major],
    ["🟡 Menores", findings.minor],
    ["ℹ️ Informativos", findings.info],
  ];
  for (const [title, items] of sections) {
    if (items.length === 0) continue;
    report += `## ${title} (${items.length})\n\n`;
    for (const f of items) {
      report += `### [${f.area}] ${f.problem}\n`;
      if (f.detail) report += `> ${f.detail}\n`;
      report += `\n`;
    }
  }

  writeFileSync("AUDIT_REPORT.md", report);
  console.log(`\n✅ AUDIT_REPORT.md gerado. Sumário:`);
  console.log(`   🔴 Críticos:    ${findings.critical.length}`);
  console.log(`   🟠 Maiores:     ${findings.major.length}`);
  console.log(`   🟡 Menores:     ${findings.minor.length}`);
  console.log(`   ℹ️  Informativos: ${findings.info.length}\n`);

  await sql.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
