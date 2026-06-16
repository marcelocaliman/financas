import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { actions } from "@/data/actions";
import { convert, formatMoney, CURRENCY_SYMBOL, type Currency } from "@/money/currency";
import { currencyBreakdown, currencyColors } from "@/money/composition";
import type { Asset, AssetType, Liability, LiabilityType } from "@/domain/types";
import { Tile, Eyebrow } from "@/components/common/tile";
import { Money } from "@/components/common/money";
import { CompositionBar } from "@/components/patrimonio/composition-bar";
import { DataGrid, type GridColumn } from "@/components/grid/data-grid";

const ASSET_TYPES: AssetType[] = ["investment", "property", "cash"];
const LIAB_TYPES: LiabilityType[] = ["loan", "card", "mortgage", "other"];

export default function Patrimonio() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const theme = useUI((s) => s.theme);
  const data = usePatrimonio();

  const view = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp);
    const colors = currencyColors(theme);
    const totalAssets = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    const segments = currencyBreakdown(data.assets, disp).map((s) => ({
      label: s.currency,
      pct: s.pct,
      color: colors[s.currency],
    }));
    return { totalAssets, totalLiab, netWorth: totalAssets - totalLiab, segments };
  }, [data, disp, theme]);

  if (!data || !view) {
    return <div className="h-44 rounded-[20px] glass border border-border animate-pulse" />;
  }

  const sym = CURRENCY_SYMBOL[disp];
  const conv = (a: number, c: Currency) => convert(a, c, disp);
  const convertedCol = {
    key: "conv",
    type: "computed" as const,
    header: `${t("patrimonio.in")} ${sym}`,
    width: "minmax(84px,0.9fr)",
    align: "right" as const,
  };

  const assetCols: GridColumn<Asset>[] = [
    { key: "currency", type: "currency", header: "", width: "48px" },
    {
      key: "name",
      type: "text",
      header: t("patrimonio.name"),
      width: "minmax(130px,1.7fr)",
      placeholder: t("patrimonio.namePlaceholder"),
    },
    {
      key: "type",
      type: "select",
      header: t("patrimonio.type"),
      width: "minmax(108px,1fr)",
      options: ASSET_TYPES.map((ty) => ({ value: ty, label: t(`patrimonio.assetType.${ty}`) })),
    },
    {
      key: "amount",
      type: "money",
      header: t("patrimonio.amount"),
      width: "minmax(104px,1fr)",
      align: "right",
      currencyKey: "currency",
    },
    { ...convertedCol, compute: (r: Asset) => formatMoney(conv(r.amount, r.currency), disp) },
  ];

  const liabCols: GridColumn<Liability>[] = [
    { key: "currency", type: "currency", header: "", width: "48px" },
    {
      key: "name",
      type: "text",
      header: t("patrimonio.name"),
      width: "minmax(130px,1.7fr)",
      placeholder: t("patrimonio.namePlaceholderLiab"),
    },
    {
      key: "type",
      type: "select",
      header: t("patrimonio.type"),
      width: "minmax(108px,1fr)",
      options: LIAB_TYPES.map((ty) => ({ value: ty, label: t(`patrimonio.liabilityType.${ty}`) })),
    },
    {
      key: "amount",
      type: "money",
      header: t("patrimonio.amount"),
      width: "minmax(104px,1fr)",
      align: "right",
      currencyKey: "currency",
    },
    { ...convertedCol, compute: (r: Liability) => formatMoney(conv(r.amount, r.currency), disp) },
  ];

  const newAsset = (): Asset => ({
    id: crypto.randomUUID(),
    name: "",
    currency: disp,
    amount: 0,
    type: "investment",
  });
  const newLiab = (): Liability => ({
    id: crypto.randomUUID(),
    name: "",
    currency: disp,
    amount: 0,
    type: "loan",
  });

  return (
    <div className="space-y-7">
      {/* Hero editorial: líquido à esquerda, composição à direita (ocupa a largura) */}
      <Tile className="p-7 md:p-8">
        <div className="grid grid-cols-12 gap-x-8 gap-y-7 items-end">
          <div className="col-span-12 lg:col-span-7">
            <div className="text-[13px] uppercase tracking-[0.12em] text-muted font-semibold">
              {t("patrimonio.netWorth")}
            </div>
            <Money
              value={view.netWorth}
              currency={disp}
              className="block font-display font-semibold text-[clamp(26px,3.2vw,42px)] mt-1.5 text-text"
            />
            <div className="flex flex-wrap gap-x-8 gap-y-1 mt-4 text-[13.5px]">
              <span className="text-muted">
                {t("patrimonio.assets")}{" "}
                <Money value={view.totalAssets} currency={disp} className="font-semibold text-text" />
              </span>
              <span className="text-muted">
                {t("patrimonio.liabilities")}{" "}
                <Money
                  value={view.totalLiab}
                  currency={disp}
                  className="font-semibold text-neg"
                  options={{ signDisplay: "never" }}
                />
              </span>
            </div>
          </div>
          {view.segments.length > 0 ? (
            <div className="col-span-12 lg:col-span-5">
              <Eyebrow className="mb-3">{t("dashboard.composition")}</Eyebrow>
              <CompositionBar segments={view.segments} />
            </div>
          ) : null}
        </div>
      </Tile>

      {/* Ativos */}
      <section>
        <SectionHead title={t("patrimonio.assets")} count={data.assets.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <DataGrid<Asset>
              columns={assetCols}
              rows={data.assets}
              blank={newAsset}
              isComplete={(r) => r.name.trim().length > 0}
              onCommit={(r) => void actions.putAsset(r)}
              onDelete={(id) => void actions.removeAsset(id)}
              addPlaceholder={t("patrimonio.addAsset")}
              total={<Money value={view.totalAssets} currency={disp} />}
            />
          </div>
        </div>
      </section>

      {/* Passivos */}
      <section>
        <SectionHead title={t("patrimonio.liabilities")} count={data.liabilities.length} />
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <DataGrid<Liability>
              columns={liabCols}
              rows={data.liabilities}
              blank={newLiab}
              isComplete={(r) => r.name.trim().length > 0}
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
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <span className="text-[11.5px] text-faint tabular">
        {count} {t(count === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}
      </span>
    </div>
  );
}
