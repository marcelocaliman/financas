import { PageHeader } from "@/components/layout/page-header";
import { listAccounts } from "@/services/accounts";
import { AccountCard } from "@/components/accounts/account-card";
import { NewAccountButton } from "./new-account-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { StaggeredGrid, StaggeredItem } from "@/components/layout/staggered-grid";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const accounts = await listAccounts({ includeArchived: true });
  const active = accounts.filter((a) => a.is_active);
  const archived = accounts.filter((a) => !a.is_active);

  const liquid = active
    .filter((a) => ["checking", "savings", "investment", "cash"].includes(a.type))
    .reduce((s, a) => s + Number(a.current_balance ?? 0), 0);
  const creditUsed = active
    .filter((a) => a.type === "credit_card")
    .reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

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
        actions={<NewAccountButton />}
      />

      {active.length > 0 ? (
        <section className="mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <SummaryCard label="Saldo líquido" value={formatMoney(liquid)} tone="default" mask />
            <SummaryCard
              label="Cartão (fatura aberta)"
              value={formatMoney(Math.abs(creditUsed))}
              tone={creditUsed < 0 ? "negative" : "default"}
              mask
            />
            <SummaryCard
              label="Total de contas ativas"
              value={String(active.length)}
              tone="default"
              mono
            />
          </div>

          <StaggeredGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((a) => (
              <StaggeredItem key={a.id}>
                <AccountCard account={a} />
              </StaggeredItem>
            ))}
          </StaggeredGrid>
        </section>
      ) : (
        <EmptyState />
      )}

      {archived.length > 0 ? (
        <section>
          <Eyebrow className="mb-3">Arquivadas · {archived.length}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((a) => (
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
