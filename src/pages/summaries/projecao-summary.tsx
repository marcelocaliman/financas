import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useProjection } from "@/store/projection";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useFireTarget } from "@/hooks/use-fire-target";
import { projectBalance, realValue } from "@/finance/projection";
import { Money } from "@/components/common/money";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";

/** KPIs do cabeçalho do accordion de Projeção (cenário-base a partir do patrimônio atual).
 *  Vive FORA da página (que é lazy/code-split): renderiza sempre. */
export function ProjecaoSummary() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const p = useProjection();
  const netWorth = useNetWorth();
  const fire = useFireTarget();
  const v = useMemo(() => {
    // Mesma base unificada da página: patrimônio INVESTÍVEL (ou o "Inicial" customizado).
    const initial = p.initialOverride ?? fire?.eligibleWealth ?? netWorth;
    const years = Math.max(1, Math.min(60, Math.round(p.years)));
    const b = p.scenarios.base;
    const nominal = projectBalance(initial, b.monthly, b.annualReturn / 100, years);
    // Número da independência — fonte única (idêntico à aba Liberdade e ao relatório).
    const target = fire?.independenceNumber ?? Infinity;
    // % FIRE = ponto de partida (investível ou Inicial customizado) sobre o alvo → reflete o Inicial.
    const fireProgress =
      fire && fire.annualCost > 0 && Number.isFinite(target) && target > 0 ? (initial / target) * 100 : null;
    return { years, nominal, real: realValue(nominal, p.annualInflation / 100, years), fireProgress };
  }, [netWorth, fire, p.initialOverride, p.scenarios, p.annualInflation, p.years]);
  return (
    <HeaderKpis>
      <HeaderKpi label={t("projecao.finalNominal", { years: v.years })} tone="accent" value={<Money value={v.nominal} currency={disp} />} />
      <HeaderKpi secondary label={t("projecao.finalReal")} value={<Money value={v.real} currency={disp} />} />
      {v.fireProgress != null ? (
        <HeaderKpi secondary label={t("fire.short")} tone="accent" value={`${Math.round(v.fireProgress)}%`} />
      ) : null}
    </HeaderKpis>
  );
}
