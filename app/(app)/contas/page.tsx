import { PageHeader } from "@/components/layout/page-header";
import { getOpenCreditCardBills } from "@/services/credit-card";
import { CreditCardBillsSection } from "@/components/accounts/credit-card-bills-section";
import {
  listAccounts,
  listAccountsForMonth,
  getAccountsTotalsAt,
} from "@/services/accounts";
import { AccountCard } from "@/components/accounts/account-card";
import { NewAccountButton } from "./new-account-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { KpiCard } from "@/components/ui/kpi-card";
import { StaggeredGrid, StaggeredItem } from "@/components/layout/staggered-grid";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { monthRange } from "@/services/transactions";
import { monthProgress } from "@/lib/financial/projection";
import { listFilers, getRegimeContext } from "@/services/ir/filers";
import type { AccountType, MarriageRegime, Tables } from "@/types/database";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão",
  investment: "Investimento",
  cash: "Dinheiro",
};

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { position } = monthProgress(month);
  const { label: monthLabel, from, to } = monthRange(month);
  const monthISO = from.slice(0, 7);
  const isCurrent = position === "current";

  // Para comparação Δ vs mês anterior — final do mês anterior
  const [y, m] = monthISO.split("-").map(Number);
  const prevMonthEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);

  const [activeAccounts, archivedAccounts, prevTotals, filers, regimeCtx, openBills] =
    await Promise.all([
      listAccountsForMonth(to, position, { includeArchived: false }),
      isCurrent
        ? listAccounts({ includeArchived: true }).then((all) => all.filter((a) => !a.is_active))
        : Promise.resolve([]),
      isCurrent ? getAccountsTotalsAt(prevMonthEnd) : Promise.resolve(null),
      listFilers(),
      getRegimeContext(),
      isCurrent ? getOpenCreditCardBills() : Promise.resolve([]),
    ]);
  // Mapa rápido pra passar ao componente de faturas
  const accountsById = new Map(activeAccounts.map((a) => [a.id, a]));
  const regime = regimeCtx.regime;

  const liquid = activeAccounts
    .filter((a) => ["checking", "savings", "investment", "cash"].includes(a.type))
    .reduce((s, a) => s + a.displayBalance, 0);
  const liquidExcludingInvCash = activeAccounts
    .filter((a) => ["checking", "savings", "cash"].includes(a.type))
    .reduce((s, a) => s + a.displayBalance, 0);
  const creditUsed = activeAccounts
    .filter((a) => a.type === "credit_card")
    .reduce((s, a) => s + a.displayBalance, 0);

  // Δ vs mês anterior — só no mês corrente
  const liquidDeltaAbs =
    prevTotals != null ? liquidExcludingInvCash - prevTotals.liquidExcludingInvestmentCash : null;
  const liquidDeltaPct =
    prevTotals != null && prevTotals.liquidExcludingInvestmentCash !== 0
      ? liquidDeltaAbs! / prevTotals.liquidExcludingInvestmentCash
      : null;

  const summaryHint = isCurrent
    ? "Saldo líquido"
    : position === "past"
      ? `Saldo líquido · fim de ${monthLabel}`
      : `Saldo líquido · previsto pra ${monthLabel}`;
  const creditHint = isCurrent ? "Cartão (fatura aberta)" : `Cartão · ${monthLabel}`;

  // Agrupamento por instituição (apenas info — não muda o grid)
  const byInstitution = new Map<string, { count: number; total: number }>();
  for (const a of activeAccounts) {
    const inst = a.institution || "—";
    const cur = byInstitution.get(inst) ?? { count: 0, total: 0 };
    cur.count += 1;
    // Só soma valores líquidos positivos (ignora cartão pra não confundir)
    if (a.type !== "credit_card") cur.total += a.displayBalance;
    byInstitution.set(inst, cur);
  }
  const institutionsRanked = [...byInstitution.entries()].sort(
    (a, b) => b[1].total - a[1].total,
  );

  return (
    <>
      <PageHeader
        eyebrow="Onde o dinheiro mora"
        title={
          <>
            Suas <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">contas.</em>
          </>
        }
        subtitle="Cartões, contas correntes, corretoras, dinheiro vivo — todos os endereços do seu patrimônio."
        actions={
          <>
            <MonthSwitcher
              currentMonth={monthISO}
              isCurrent={isCurrent}
              label={monthLabel.split(" ")[0]}
            />
            <NewAccountButton filers={filers} regime={regime} />
          </>
        }
      />

      {activeAccounts.length > 0 ? (
        <section className="mb-10">
          {/* KPIs com Δ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label={summaryHint}
              value={liquid}
              tone="neutral"
              deltaAbs={liquidDeltaAbs}
              deltaPct={liquidDeltaPct}
            />
            <KpiCard
              label={creditHint}
              value={Math.abs(creditUsed)}
              tone={creditUsed < 0 ? "negative" : "neutral"}
            />
            <KpiCard
              label="Patrimônio nas contas"
              value={liquidExcludingInvCash}
              tone="neutral"
              hint="excluindo caixa de corretora"
            />
            <KpiCard
              label="Contas ativas"
              textValue={`${activeAccounts.length}`}
              tone="muted"
              hint={`${institutionsRanked.length} ${institutionsRanked.length === 1 ? "instituição" : "instituições"}`}
            />
          </div>

          {/* Agrupamento por instituição */}
          {institutionsRanked.length >= 2 ? (
            <div className="rounded-[var(--radius)] bg-surface border border-border px-5 py-4 mb-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-3">
                Distribuição por instituição
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
                {institutionsRanked.map(([inst, data]) => (
                  <li key={inst} className="font-mono">
                    <span className="text-foreground font-medium">{inst}</span>
                    <span className="text-faint-foreground ml-1.5">
                      · {data.count} conta{data.count === 1 ? "" : "s"}
                    </span>
                    {data.total > 0 ? (
                      <span className="text-muted-foreground ml-1.5 tabular-nums">
                        ·{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        }).format(data.total)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Faturas abertas de cartão de crédito */}
          {openBills.length > 0 ? (
            <CreditCardBillsSection bills={openBills} accountsById={accountsById} />
          ) : null}

          {/* Grid de cartões agrupados por tipo */}
          <AccountsByType accounts={activeAccounts} filers={filers} regime={regime} />
        </section>
      ) : (
        <EmptyState filers={filers} regime={regime} />
      )}

      {archivedAccounts.length > 0 ? (
        <section>
          <Eyebrow className="mb-3">Arquivadas · {archivedAccounts.length}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {archivedAccounts.map((a) => (
              <AccountCard key={a.id} account={a} filers={filers} regime={regime} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function AccountsByType({
  accounts,
  filers,
  regime,
}: {
  accounts: Array<
    Awaited<ReturnType<typeof listAccountsForMonth>>[number]
  >;
  filers: Tables<"ir_filers">[];
  regime: MarriageRegime;
}) {
  // Ordem dos tipos no display
  const TYPE_ORDER: AccountType[] = ["checking", "savings", "cash", "investment", "credit_card"];

  const grouped = new Map<AccountType, typeof accounts>();
  for (const a of accounts) {
    if (!grouped.has(a.type)) grouped.set(a.type, []);
    grouped.get(a.type)!.push(a);
  }

  return (
    <div className="space-y-7">
      {TYPE_ORDER.map((type) => {
        const group = grouped.get(type);
        if (!group || group.length === 0) return null;
        return (
          <div key={type}>
            <div className="flex items-baseline justify-between mb-3">
              <Eyebrow>{TYPE_LABELS[type]} · {group.length}</Eyebrow>
            </div>
            <StaggeredGrid className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {group.map((a) => (
                <StaggeredItem key={a.id}>
                  <AccountCard
                    account={a}
                    displayBalance={a.displayBalance}
                    balanceMode={a.balanceMode}
                    assetsBalance={a.assetsBalance}
                    filers={filers}
                    regime={regime}
                  />
                </StaggeredItem>
              ))}
            </StaggeredGrid>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  filers,
  regime,
}: {
  filers: Tables<"ir_filers">[];
  regime: MarriageRegime;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-10 sm:p-14 relative overflow-hidden border border-ink-700">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px]"
        style={{ background: "radial-gradient(circle, rgba(176,123,50,0.16), transparent 70%)" }}
      />
      <div className="relative z-10 max-w-[480px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 mb-3 font-medium">
          Primeiro passo
        </div>
        <h2 className="font-display text-[28px] sm:text-[32px] leading-[1.1] tracking-[-0.025em] font-light">
          Nenhuma <em className="italic">conta</em> ainda.
        </h2>
        <p className="text-navy-300 text-[14px] mt-3 leading-relaxed">
          Antes de qualquer lançamento, a casa precisa de endereços: a corrente do Itaú, o cartão do
          Nubank, a corretora, o dinheiro na carteira.
        </p>
        <div className="mt-7">
          <NewAccountButton variant="white" filers={filers} regime={regime} />
        </div>
      </div>
    </div>
  );
}
