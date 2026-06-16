import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import type { Asset, Liability } from "@/domain/types";
import { CLASS } from "@/domain/taxonomy";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { DataGrid, type GridColumn, type SelectOption } from "@/components/grid/data-grid";

export default function Patrimonio() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const data = usePatrimonio();
  const tax = useTaxonomy();
  const rates = useRates((s) => s.rates);

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const totalAssets = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    return { totalAssets, totalLiab, netWorth: totalAssets - totalLiab };
  }, [data, disp, rates]);

  if (!data || !view) {
    return <div className="h-44 rounded-[20px] glass border border-border animate-pulse" />;
  }

  const sym = CURRENCY_SYMBOL[disp];
  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const opts = (items: { id: string; name: string }[]): SelectOption[] =>
    items.map((i) => ({ value: i.id, label: i.name }));
  const convertedCol = {
    key: "conv",
    type: "computed" as const,
    header: `${t("patrimonio.in")} ${sym}`,
    width: "minmax(80px,0.8fr)",
    align: "right" as const,
  };

  const assetCols: GridColumn<Asset>[] = [
    { key: "currency", type: "currency", header: "", width: "46px" },
    {
      key: "name",
      type: "text",
      header: t("patrimonio.name"),
      width: "minmax(150px,1.6fr)",
      placeholder: t("patrimonio.namePlaceholder"),
    },
    {
      key: "classId",
      type: "select",
      header: t("patrimonio.class"),
      width: "minmax(132px,1.1fr)",
      placeholder: t("patrimonio.classPlaceholder"),
      options: opts(tax.assetClasses),
    },
    {
      key: "subtypeId",
      type: "select",
      optional: true,
      header: t("patrimonio.subtype"),
      width: "minmax(150px,1.2fr)",
      optionsFor: (r) => opts(tax.subtypes.filter((s) => s.classId === r.classId)),
    },
    {
      key: "regionId",
      type: "select",
      optional: true,
      header: t("patrimonio.region"),
      width: "minmax(120px,1fr)",
      options: opts(tax.regions),
    },
    {
      key: "indexerId",
      type: "select",
      optional: true,
      header: t("patrimonio.indexer"),
      width: "minmax(104px,0.8fr)",
      optionsFor: (r) => (r.classId === CLASS.rendaFixa ? opts(tax.indexers) : []),
    },
    {
      key: "institution",
      type: "text",
      header: t("patrimonio.institution"),
      width: "minmax(116px,1fr)",
      placeholder: "—",
    },
    {
      key: "ticker",
      type: "text",
      header: t("patrimonio.ticker"),
      width: "minmax(92px,0.8fr)",
      placeholder: "—",
    },
    {
      key: "quantity",
      type: "number",
      header: t("patrimonio.quantity"),
      width: "minmax(78px,0.7fr)",
      align: "right",
    },
    {
      key: "amount",
      type: "money",
      header: t("patrimonio.amount"),
      width: "minmax(104px,0.9fr)",
      align: "right",
      currencyKey: "currency",
    },
    { ...convertedCol, compute: (r: Asset) => formatMoney(conv(r.amount, r.currency), disp) },
  ];

  const liabCols: GridColumn<Liability>[] = [
    { key: "currency", type: "currency", header: "", width: "46px" },
    {
      key: "name",
      type: "text",
      header: t("patrimonio.name"),
      width: "minmax(150px,1.7fr)",
      placeholder: t("patrimonio.namePlaceholderLiab"),
    },
    {
      key: "typeId",
      type: "select",
      header: t("patrimonio.type"),
      width: "minmax(160px,1.3fr)",
      placeholder: t("patrimonio.typePlaceholder"),
      options: opts(tax.liabilityTypes),
    },
    {
      key: "interestRate",
      type: "number",
      header: t("patrimonio.interestRate"),
      width: "minmax(96px,0.8fr)",
      align: "right",
    },
    {
      key: "installments",
      type: "number",
      header: t("patrimonio.installments"),
      width: "minmax(92px,0.7fr)",
      align: "right",
    },
    {
      key: "amount",
      type: "money",
      header: t("patrimonio.saldo"),
      width: "minmax(110px,1fr)",
      align: "right",
      currencyKey: "currency",
    },
    { ...convertedCol, compute: (r: Liability) => formatMoney(conv(r.amount, r.currency), disp) },
  ];

  /** Normaliza a cascata: limpa subtipo órfão e indexador fora de Renda Fixa. */
  const commitAsset = (a: Asset) => {
    const next = { ...a };
    if (next.subtypeId && !tax.subtypes.some((s) => s.id === next.subtypeId && s.classId === next.classId)) {
      next.subtypeId = undefined;
    }
    if (next.classId !== CLASS.rendaFixa) next.indexerId = undefined;
    void actions.putAsset(next);
  };

  const newAsset = (): Asset => ({
    id: crypto.randomUUID(),
    name: "",
    classId: "",
    currency: disp,
    amount: 0,
  });
  const newLiab = (): Liability => ({
    id: crypto.randomUUID(),
    name: "",
    typeId: "",
    currency: disp,
    amount: 0,
  });

  return (
    <div className="space-y-7">
      {/* Resumo enxuto: Ativos / Passivos / Líquido (composição já está no hero). */}
      <Tile className="p-6 md:p-7">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <div>
            <Eyebrow>{t("patrimonio.assets")}</Eyebrow>
            <Money
              value={view.totalAssets}
              currency={disp}
              className="block font-numeric font-semibold tabular tracking-[-0.02em] text-[clamp(20px,2.3vw,28px)] mt-1.5 text-text"
            />
          </div>
          <div>
            <Eyebrow>{t("patrimonio.liabilities")}</Eyebrow>
            <Money
              value={view.totalLiab}
              currency={disp}
              options={{ signDisplay: "never" }}
              className="block font-numeric font-semibold tabular tracking-[-0.02em] text-[clamp(20px,2.3vw,28px)] mt-1.5 text-neg"
            />
          </div>
          <div>
            <Eyebrow>{t("patrimonio.netWorth")}</Eyebrow>
            <Money
              value={view.netWorth}
              currency={disp}
              className="block font-numeric font-semibold tabular tracking-[-0.02em] text-[clamp(20px,2.3vw,28px)] mt-1.5 text-text"
            />
          </div>
        </div>
      </Tile>

      {/* Ativos */}
      <section>
        <SectionHead title={t("patrimonio.assets")} count={data.assets.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[1280px]">
            <DataGrid<Asset>
              columns={assetCols}
              rows={data.assets}
              blank={newAsset}
              isComplete={(r) => r.name.trim().length > 0 && r.classId.length > 0 && r.amount > 0}
              onCommit={commitAsset}
              onDelete={(id) => void actions.removeAsset(id)}
              addPlaceholder={t("patrimonio.addAsset")}
              total={<Money value={view.totalAssets} currency={disp} />}
            />
          </div>
        </div>
        <p className="text-[11.5px] text-faint mt-2 px-1 leading-relaxed">{t("patrimonio.tickerHint")}</p>
      </section>

      {/* Passivos */}
      <section>
        <SectionHead title={t("patrimonio.liabilities")} count={data.liabilities.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <DataGrid<Liability>
              columns={liabCols}
              rows={data.liabilities}
              blank={newLiab}
              isComplete={(r) => r.name.trim().length > 0 && r.typeId.length > 0 && r.amount > 0}
              onCommit={(r) => void actions.putLiability(r)}
              onDelete={(id) => void actions.removeLiability(id)}
              addPlaceholder={t("patrimonio.addLiability")}
              total={
                <Money
                  value={view.totalLiab}
                  currency={disp}
                  className="text-neg"
                  options={{ signDisplay: "never" }}
                />
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-baseline justify-between mb-3 px-1">
      <h2 className="eyebrow">{title}</h2>
      <span className="text-[11.5px] text-faint tabular">
        {count} {t(count === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}
      </span>
    </div>
  );
}
