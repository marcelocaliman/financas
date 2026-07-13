import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useObjetivos } from "@/hooks/use-objetivos";
import { convert, type Currency } from "@/money/currency";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

/** KPIs do cabeçalho do accordion de Objetivos. Vive FORA da página (que é lazy/code-split):
 *  renderiza sempre — no header do accordion e no tooltip do menu lateral. */
export function ObjetivosSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useObjetivos();
  const v = useMemo(() => {
    if (!data || data.length === 0) return null;
    const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
    const saved = data.reduce((s, g) => s + conv(g.current, g.currency), 0);
    const avg =
      data.reduce((s, g) => {
        const tt = conv(g.target, g.currency);
        const cc = conv(g.current, g.currency);
        return s + (tt > 0 ? Math.min(100, (cc / tt) * 100) : 0);
      }, 0) / data.length;
    return { count: data.length, saved, avg };
  }, [data, disp, rates]);
  if (!v) return null;
  return (
    <HeaderKpis>
      <HeaderKpi label={t("objetivos.saved")} value={<Money value={v.saved} currency={disp} />} />
      <HeaderKpi secondary label={t("objetivos.avgProgress")} tone="accent" value={`${Math.round(v.avg)}%`} />
      <HeaderKpi secondary label={t("nav.objetivos")} value={<span className="tabular">{v.count}</span>} />
    </HeaderKpis>
  );
}
