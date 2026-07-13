import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useUI } from "@/store/ui";
import { useHistoricoView } from "@/hooks/use-historico-view";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

/** KPIs do cabeçalho do accordion de Histórico. Vive FORA da página (que é lazy/code-split) e
 *  reusa a MESMA view derivada da página (useHistoricoView) — fonte única, sem recalcular. */
export function HistoricoSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const v = useHistoricoView();
  if (!v) return null;
  const up = v.change >= 0;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("historico.current")} value={<Money value={v.current} currency={disp} />} />
      <HeaderKpi
        secondary
        label={t("historico.totalChange")}
        tone={up ? "accent" : "neg"}
        value={
          <span className="inline-flex items-center gap-0.5">
            {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {(up ? "+" : "") + v.change.toFixed(1)}%
          </span>
        }
      />
      <HeaderKpi secondary label={t("historico.contributions")} value={<Money value={v.contributions} currency={disp} />} />
    </HeaderKpis>
  );
}
