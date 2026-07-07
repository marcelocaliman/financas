import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Repeat } from "lucide-react";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import type { Subscription } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { SectionHead } from "@/components/common/section-head";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";
import { cn } from "@/lib/utils";

/** Assinaturas têm valores pequenos → mostrar 2 casas (o Money do app arredonda pra inteiro). */
const CENTS: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/** KPI no padrão do app: eyebrow mono + valor numérico tabular (hero = maior, destaque). */
function Kpi({ label, value, hero }: { label: string; value: ReactNode; hero?: boolean }) {
  return (
    <div className="min-w-0">
      <Eyebrow>{label}</Eyebrow>
      <div className={cn("mt-1.5 font-numeric font-semibold tabular tracking-[-0.01em] leading-none whitespace-nowrap", hero ? "text-[clamp(1.25rem,3vw,1.65rem)] text-text" : "text-[15px] lg:text-[16px] text-muted")}>
        {value}
      </div>
    </div>
  );
}
const KpiDivider = () => <span className="hidden h-9 w-px shrink-0 bg-border sm:block" aria-hidden />;

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

  // Totais na moeda de exibição. Separa o REAL: `mensal` = soma das assinaturas mensais (paga/mês);
  // `anual` = soma das anuais (paga inteira 1×/ano). Combinados: `media`/mês (= mensal + anual÷12,
  // pra comparar/orçar) e `ano` (= mensal×12 + anual, desembolso real no ano).
  const T = useMemo(() => {
    let mensal = 0;
    let anual = 0;
    for (const s of data ?? []) {
      const v = convert(s.amount, s.currency || base, disp, rates);
      if (s.cycle === "yearly") anual += v;
      else mensal += v;
    }
    return { mensal, anual, media: mensal + anual / 12, ano: mensal * 12 + anual };
  }, [data, disp, rates, base]);

  if (!data) {
    return <div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />;
  }

  const cols: GridColumn<Subscription>[] = [
    { key: "name", type: "text", header: t("assinaturas.name"), width: "minmax(150px,2fr)", placeholder: t("assinaturas.namePlaceholder") },
    {
      key: "cycle",
      type: "select",
      header: t("assinaturas.cycle"),
      width: "110px",
      options: [
        { value: "monthly", label: t("assinaturas.cycleMonthly") },
        { value: "yearly", label: t("assinaturas.cycleYearly") },
      ],
    },
    // Mês de início (opcional) — quando começou; numa anual, junto do dia, é a âncora da renovação.
    { key: "startMonth", type: "month", header: t("assinaturas.startMonth"), width: "minmax(92px,0.9fr)", align: "right" },
    { key: "renewalDay", type: "day", header: t("assinaturas.renewalDay"), width: "84px", align: "right" },
    // Valor cobrado NO CICLO REAL (mensal ou anual), na moeda da assinatura — o que você paga de
    // verdade (a anual sai inteira 1×/ano; nada de "por mês" que você não paga). Pequeno → 2 casas.
    { key: "amount", type: "money", header: t("assinaturas.amount"), width: "minmax(130px,1fr)", align: "right", currencyKey: "currency", decimals: 2 },
    // "Na sua moeda" — só quando há assinatura em moeda estrangeira: o MESMO valor convertido, no
    // MESMO ciclo (US$19/ano → R$99/ano). Sem inventar mensal; o Ciclo diz a cadência. (Padrão do app.)
    ...(data.some((a) => a.currency && a.currency !== disp)
      ? [{
          key: "conv",
          type: "computed" as const,
          header: `${t("patrimonio.in")} ${CURRENCY_SYMBOL[disp]}`,
          width: "minmax(96px,0.9fr)",
          align: "right" as const,
          compute: (r: Subscription) => (r.amount > 0 && r.currency ? formatMoney(convert(r.amount, r.currency, disp, rates), disp, CENTS) : "—"),
        }]
      : []),
  ];

  // Fantasma nasce SEM moeda e SEM ciclo (mostra "—"); ao salvar, moeda cai na base (DataGrid)
  // e o ciclo assume "monthly".
  const newSub = (): Subscription => ({ id: crypto.randomUUID(), name: "", currency: "" as Currency, amount: 0 });

  return (
    <div className="space-y-5 sm:space-y-7">
      {data.length > 0 ? (
        <Tile className="p-4 sm:p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4 sm:gap-x-6 lg:gap-x-7">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Repeat size={22} />
            </span>
            <Kpi hero label={t("assinaturas.monthlyAvg")} value={<Money value={T.media} currency={disp} options={CENTS} />} />
            <KpiDivider />
            <Kpi label={t("assinaturas.monthlyOnly")} value={<Money value={T.mensal} currency={disp} options={CENTS} />} />
            <Kpi label={t("assinaturas.yearlyOnly")} value={<Money value={T.anual} currency={disp} options={CENTS} />} />
            <KpiDivider />
            <Kpi label={t("assinaturas.yearlyLabel")} value={<Money value={T.ano} currency={disp} options={CENTS} />} />
            <KpiDivider />
            <Kpi label={t("nav.assinaturas")} value={data.length} />
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-faint">{t("assinaturas.note")}</p>
        </Tile>
      ) : null}

      <section>
        <SectionHead title={t("nav.assinaturas")} count={data.length} />
        <div className="overflow-x-auto">
          <div className="min-w-0 sm:min-w-[680px]">
            <DataGrid<Subscription>
              columns={cols}
              rows={data}
              blank={newSub}
              defaultCurrency={base}
              isComplete={(r) => r.name.trim().length > 0 && r.amount > 0}
              onCommit={(r) => void actions.putSubscription({ ...r, cycle: r.cycle || "monthly" })}
              onDelete={(id) => void actions.removeSubscription(id)}
              addPlaceholder={t("assinaturas.addSub")}
            />
          </div>
        </div>
        {data.length === 0 ? <p className="mt-3 text-[12px] leading-relaxed text-faint">{t("assinaturas.note")}</p> : null}
      </section>
    </div>
  );
}
