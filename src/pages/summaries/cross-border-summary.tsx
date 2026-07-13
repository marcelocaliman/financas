import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useFxExposure } from "@/hooks/use-fx-exposure";
import { convert } from "@/money/currency";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

/** KPI do cabeçalho do accordion: quanto do patrimônio está em moeda estrangeira.
 *  Vive FORA da página (que é lazy/code-split): renderiza sempre. */
export function CrossBorderSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const base = useUI((s) => s.baseCurrency);
  const rates = useRates((s) => s.rates);
  const fx = useFxExposure();
  const pct = fx.magnitude > 0 ? (Math.abs(fx.foreign) / fx.magnitude) * 100 : 0;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("crossborder.foreignExposure")} value={<Money value={convert(fx.foreign, base, disp, rates)} currency={disp} />} />
      <HeaderKpi secondary label={t("crossborder.foreignShare")} value={`${Math.round(pct)}%`} />
      {/* Diversificação cambial: útil mesmo sem exposição estrangeira (1 moeda) — evita o relance 0/0% vazio. */}
      <HeaderKpi secondary label={t("crossborder.currencies")} value={<span className="tabular">{fx.rows.length}</span>} />
    </HeaderKpis>
  );
}
