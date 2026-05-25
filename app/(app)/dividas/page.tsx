import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DebtCard } from "@/components/debts/debt-card";
import { NewDebtButton } from "@/components/debts/new-debt-button";
import { listDebts } from "@/services/debts";
import { listPhysicalAssets } from "@/services/physical-assets";
import { listFilers, getRegimeContext } from "@/services/ir/filers";

export const dynamic = "force-dynamic";

export default async function DividasPage() {
  const [debts, assets, filers, regimeCtx] = await Promise.all([
    listDebts({ includeInactive: true }),
    listPhysicalAssets(),
    listFilers(),
    getRegimeContext(),
  ]);
  const regime = regimeCtx.regime;

  const active = debts.filter((d) => d.is_active);
  const archived = debts.filter((d) => !d.is_active);

  const totalCurrent = active.reduce((s, d) => s + Number(d.current_balance), 0);
  const declarable = active.filter((d) => Number(d.current_balance) > 5000);
  const assetsLite = assets.map((a) => ({ id: a.id, name: a.name, category: a.category }));

  return (
    <>
      <PageHeader
        eyebrow="Passivo · obrigações"
        title={
          <>
            O que você <em className="not-italic font-display italic text-rust-600">deve.</em>
          </>
        }
        subtitle="Financiamentos, empréstimos, consignados. Dívidas com saldo > R$ 5k em 31/12 são obrigatórias na declaração."
        actions={<NewDebtButton assets={assetsLite} filers={filers} regime={regime} />}
      />

      {active.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] bg-bone-50 dark:bg-ink-900 border border-dashed border-border-strong p-10 text-center">
          <p className="text-[14px] text-muted-foreground italic">
            Nenhuma dívida cadastrada. Bom sinal — mas se você tem financiamento de imóvel/carro
            ou consignado, registra aqui pra entrar no IR.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Total devido" value={totalCurrent} tone="negative" />
            <KpiCard label="Dívidas ativas" textValue={`${active.length}`} tone="neutral" />
            <KpiCard
              label="Declaráveis IR"
              textValue={`${declarable.length}`}
              tone="muted"
              hint="Saldo > R$ 5k em 31/12"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((d) => (
              <DebtCard key={d.id} debt={d} assets={assetsLite} filers={filers} regime={regime} />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 ? (
        <section className="mt-10">
          <Eyebrow className="mb-3">Arquivadas · {archived.length}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((d) => (
              <DebtCard key={d.id} debt={d} assets={assetsLite} filers={filers} regime={regime} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
