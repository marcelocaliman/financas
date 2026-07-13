import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useLiberdade } from "@/hooks/use-liberdade";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

/** KPIs do cabeçalho do accordion da Liberdade. Vive FORA da página (que é lazy/code-split):
 *  renderiza sempre — no header do accordion e no tooltip do menu lateral. */
export function LiberdadeSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const v = useLiberdade();
  if (!v || !v.ready) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("liberdade.short")} tone="accent" value={`${Math.round(v.freedomPct)}%`} />
      {v.yearsOfFreedom != null ? (
        <HeaderKpi secondary label={t("liberdade.yearsCovered")} value={t("liberdade.yearsValue", { n: v.yearsOfFreedom.toFixed(1) })} />
      ) : null}
      <HeaderKpi secondary label={t("liberdade.independenceNumber")} value={<Money value={v.independenceNumber} currency={disp} />} />
    </HeaderKpis>
  );
}
