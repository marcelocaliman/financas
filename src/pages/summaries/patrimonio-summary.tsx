import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { convert, type Currency } from "@/money/currency";
import { isInvestedClass } from "@/domain/taxonomy";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

/** KPIs do cabeçalho do accordion de Patrimônio. Vive FORA da página (que é lazy/code-split):
 *  renderiza sempre — no header do accordion e no tooltip do menu lateral. */
export function PatrimonioSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = usePatrimonio();
  const v = useMemo(() => {
    if (!data) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const totalAssets = data.assets.reduce((s, a) => s + conv(a.amount, a.currency), 0);
    const totalLiab = data.liabilities.reduce((s, l) => s + conv(l.amount, l.currency), 0);
    // Rentabilidade geral dos investidos (mesmo custo unificado de Investimentos).
    let totalCost = 0;
    let totalCostValue = 0;
    for (const a of data.assets.filter((x) => isInvestedClass(x.classId))) {
      const cost = a.cost ?? 0;
      if (cost > 0) {
        totalCost += conv(cost, a.currency);
        totalCostValue += conv(a.amount, a.currency);
      }
    }
    return {
      totalAssets,
      totalLiab,
      net: totalAssets - totalLiab,
      returnPct: totalCost > 0 ? ((totalCostValue - totalCost) / totalCost) * 100 : null,
    };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("patrimonio.netWorth")} value={<Money value={v.net} currency={disp} />} />
      {v.returnPct != null ? (
        <HeaderKpi
          secondary
          label={t("investimentos.profitability")}
          tone={v.returnPct >= 0 ? "accent" : "neg"}
          value={`${v.returnPct >= 0 ? "+" : ""}${v.returnPct.toFixed(1)}%`}
        />
      ) : null}
      <HeaderKpi secondary label={t("patrimonio.assets")} value={<Money value={v.totalAssets} currency={disp} />} />
      <HeaderKpi secondary label={t("patrimonio.liabilities")} tone={v.totalLiab > 0 ? "neg" : "text"} value={<Money value={v.totalLiab} currency={disp} options={{ signDisplay: "never" }} />} />
    </HeaderKpis>
  );
}
