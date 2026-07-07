import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Repeat } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { actions } from "@/data/actions";
import { convert } from "@/money/currency";
import type { Subscription } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

/** Assinaturas têm valores pequenos → mostrar 2 casas (o Money do app arredonda pra inteiro). */
const CENTS: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * Assinaturas — registro GLOBAL de recorrências (Netflix, Spotify…), como DOCUMENTAÇÃO.
 * NÃO entra no total do orçamento (as pagas no cartão já estão na fatura), então nunca duplica.
 * Serve pra ter o raio-x das assinaturas (total mensal/anual, o que cortar).
 */
export default function Assinaturas() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const data = useSubscriptions();

  const monthly = useMemo(
    () => (data ? data.reduce((s, a) => s + convert(a.amount, a.currency, disp, rates), 0) : 0),
    [data, disp, rates],
  );

  if (!data) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const cols: GridColumn<Subscription>[] = [
    { key: "name", type: "text", header: t("assinaturas.name"), width: "minmax(160px,2fr)", placeholder: t("assinaturas.namePlaceholder") },
    { key: "renewalDay", type: "day", header: t("assinaturas.renewalDay"), width: "96px", align: "right" },
    // Valores pequenos (R$ 21,90, € 4,99…): mostra sempre 2 casas (o padrão do app é 0).
    { key: "amount", type: "money", header: t("assinaturas.monthly"), width: "minmax(150px,1fr)", align: "right", currencyKey: "currency", decimals: 2 },
  ];

  const newSub = (): Subscription => ({ id: crypto.randomUUID(), name: "", currency: base, amount: 0 });

  return (
    <div className="space-y-5 sm:space-y-7">
      {data.length > 0 ? (
        <Tile className="p-4 sm:p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-x-9 gap-y-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Repeat size={22} />
            </span>
            <div className="min-w-0">
              <Eyebrow>{t("assinaturas.monthlyTotal")}</Eyebrow>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                <Money value={monthly} currency={disp} options={CENTS} className="text-[clamp(1.2rem,3vw,1.6rem)] font-semibold tabular" />
                <span className="text-faint text-[13px]">
                  · {t("assinaturas.yearlyTotal")} <Money value={monthly * 12} currency={disp} options={CENTS} />
                </span>
              </div>
            </div>
            <div className="w-full border-t border-border pt-4 sm:w-auto sm:border-0 sm:pt-0">
              <Eyebrow>{t("nav.assinaturas")}</Eyebrow>
              <div className="mt-1.5 text-[15px] font-semibold tabular">{data.length}</div>
            </div>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-faint">{t("assinaturas.note")}</p>
        </Tile>
      ) : null}

      <section>
        <SectionHead title={t("nav.assinaturas")} count={data.length} />
        <div className="overflow-x-auto">
          <div className="min-w-0 sm:min-w-[480px]">
            <DataGrid<Subscription>
              columns={cols}
              rows={data}
              blank={newSub}
              isComplete={(r) => r.name.trim().length > 0 && r.amount > 0}
              onCommit={(r) => void actions.putSubscription(r)}
              onDelete={(id) => void actions.removeSubscription(id)}
              addPlaceholder={t("assinaturas.addSub")}
              total={<Money value={monthly} currency={disp} options={CENTS} />}
            />
          </div>
        </div>
        {data.length === 0 ? <p className="mt-3 text-[12px] leading-relaxed text-faint">{t("assinaturas.note")}</p> : null}
      </section>
    </div>
  );
}
