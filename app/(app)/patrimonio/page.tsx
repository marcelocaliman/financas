import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PhysicalAssetCard } from "@/components/physical-assets/physical-asset-card";
import { NewPhysicalAssetButton } from "./new-asset-button";
import {
  CATEGORY_LABELS,
  getPhysicalAssetsTotals,
  listPhysicalAssets,
} from "@/services/physical-assets";
import type { PhysicalAssetCategory } from "@/types/database";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

export const dynamic = "force-dynamic";

export default async function PatrimonioPage() {
  const [assets, totals] = await Promise.all([
    listPhysicalAssets({ includeArchived: true }),
    getPhysicalAssetsTotals(),
  ]);

  const active = assets.filter((a) => a.is_active);
  const archived = assets.filter((a) => !a.is_active);

  // Categorias com pelo menos 1 ativo, em ordem do total decrescente
  const categoriesOrdered = (Object.entries(totals.byCategory) as Array<
    [PhysicalAssetCategory, number]
  >)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  return (
    <>
      <PageHeader
        eyebrow={`Imobilizado · ${totals.count} ${totals.count === 1 ? "bem" : "bens"}`}
        title={
          <>
            O que você <em className="not-italic font-display italic text-navy-700">possui.</em>
          </>
        }
        subtitle="Apartamento, carro, moto, computador, obras, joias. Bens que têm valor mas não rendem automaticamente — entram só no patrimônio total."
        actions={<NewPhysicalAssetButton />}
      />

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-[var(--radius-lg)] bg-surface border border-border px-7 py-6 mb-7">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Patrimônio imobilizado total
            </div>
            <div className="font-mono text-[34px] tracking-[-0.025em] text-foreground leading-none mt-1">
              <MoneyMask>{formatMoney(totals.total)}</MoneyMask>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[12px] font-mono">
              {categoriesOrdered.map((cat) => (
                <span key={cat} className="text-muted-foreground">
                  {CATEGORY_LABELS[cat]}{" "}
                  <b className="text-foreground"><MoneyMask>{formatMoney(totals.byCategory[cat])}</MoneyMask></b>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((a) => (
              <PhysicalAssetCard key={a.id} asset={a} />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 ? (
        <section className="mt-10">
          <Eyebrow className="mb-3">Arquivados · {archived.length}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((a) => (
              <PhysicalAssetCard key={a.id} asset={a} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function EmptyState() {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[460px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Inventário vazio
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2">
          O que vocês <em className="italic">possuem</em> no mundo físico?
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          Apartamento, carro, moto, bicicleta, computador, máquina fotográfica. Use a categoria
          mais próxima e o valor que considera de mercado hoje. Atualize quando achar relevante —
          não precisa ser exato.
        </p>
      </div>
    </Panel>
  );
}
