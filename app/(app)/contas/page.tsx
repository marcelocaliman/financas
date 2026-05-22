import { PageHeader } from "@/components/layout/page-header";
import { listAccounts, listAccountsForMonth } from "@/services/accounts";
import { AccountCard } from "@/components/accounts/account-card";
import { NewAccountButton } from "./new-account-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { StaggeredGrid, StaggeredItem } from "@/components/layout/staggered-grid";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { monthRange } from "@/services/transactions";
import { monthProgress } from "@/lib/financial/projection";

export const dynamic = "force-dynamic";

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

  // Active: usa o saldo do mês alvo. Archived: só atual (não faz sentido
  // ver saldo histórico de conta arquivada — UX confusa).
  const [activeAccounts, archivedAccounts] = await Promise.all([
    listAccountsForMonth(to, position, { includeArchived: false }),
    isCurrent ? listAccounts({ includeArchived: true }).then((all) => all.filter((a) => !a.is_active)) : Promise.resolve([]),
  ]);

  const liquid = activeAccounts
    .filter((a) => ["checking", "savings", "investment", "cash"].includes(a.type))
    .reduce((s, a) => s + a.displayBalance, 0);
  const creditUsed = activeAccounts
    .filter((a) => a.type === "credit_card")
    .reduce((s, a) => s + a.displayBalance, 0);

  const summaryHint = isCurrent
    ? "Saldo líquido"
    : position === "past"
      ? `Saldo líquido · fim de ${monthLabel}`
      : `Saldo líquido · previsto pra ${monthLabel}`;
  const creditHint = isCurrent
    ? "Cartão (fatura aberta)"
    : `Cartão · ${monthLabel}`;

  return (
    <>
      <PageHeader
        eyebrow="Onde o dinheiro mora"
        title={
          <>
            Suas <em className="not-italic font-display italic text-navy-700">contas.</em>
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
            <NewAccountButton />
          </>
        }
      />

      {activeAccounts.length > 0 ? (
        <section className="mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <SummaryCard label={summaryHint} value={formatMoney(liquid)} tone="default" mask />
            <SummaryCard
              label={creditHint}
              value={formatMoney(Math.abs(creditUsed))}
              tone={creditUsed < 0 ? "negative" : "default"}
              mask
            />
            <SummaryCard
              label="Total de contas ativas"
              value={String(activeAccounts.length)}
              tone="default"
              mono
            />
          </div>

          <StaggeredGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAccounts.map((a) => (
              <StaggeredItem key={a.id}>
                <AccountCard
                  account={a}
                  displayBalance={a.displayBalance}
                  balanceMode={a.balanceMode}
                />
              </StaggeredItem>
            ))}
          </StaggeredGrid>
        </section>
      ) : (
        <EmptyState />
      )}

      {archivedAccounts.length > 0 ? (
        <section>
          <Eyebrow className="mb-3">Arquivadas · {archivedAccounts.length}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedAccounts.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  mono,
  mask = false,
}: {
  label: string;
  value: string;
  tone: "default" | "negative";
  mono?: boolean;
  mask?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] bg-surface border border-border px-5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div
        className={`mt-1 text-[20px] tracking-[-0.02em] ${tone === "negative" ? "text-rust-600" : "text-foreground"} ${mono ? "font-mono" : "font-mono"}`}
      >
        {mask ? <MoneyMask>{value}</MoneyMask> : value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-10 sm:p-14 relative overflow-hidden">
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
          <NewAccountButton variant="white" />
        </div>
      </div>
    </div>
  );
}
