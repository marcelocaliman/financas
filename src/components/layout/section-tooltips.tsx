import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KpiStack } from "@/components/common/header-kpis";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useLiberdade } from "@/hooks/use-liberdade";
import { useHistorico } from "@/hooks/use-historico";
import { useObjetivos } from "@/hooks/use-objetivos";
import { PatrimonioSummary } from "@/pages/summaries/patrimonio-summary";
import { LiberdadeSummary } from "@/pages/summaries/liberdade-summary";
import { ProjecaoSummary } from "@/pages/summaries/projecao-summary";
import { HistoricoSummary } from "@/pages/summaries/historico-summary";
import { ObjetivosSummary } from "@/pages/summaries/objetivos-summary";
import { CrossBorderSummary } from "@/pages/summaries/cross-border-summary";
import { useFxExposure } from "@/hooks/use-fx-exposure";

/**
 * Tooltips de RESUMO dos itens do menu (desktop) — reaproveitam os componentes *Summary das
 * seções (mesmos KPIs, já mascarando valores no modo privacidade), só que empilhados. Cada um
 * degrada pra um convite curto quando a seção está vazia (nada de zeros). Fase 2.
 */

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full text-left px-3.5 py-3">
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint mb-2.5">{title}</div>
      <KpiStack>{children}</KpiStack>
    </div>
  );
}

function Invite({ title, text }: { title: string; text: string }) {
  return (
    <div className="w-full text-left px-3.5 py-3">
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint mb-1.5">{title}</div>
      <div className="text-[12.5px] text-muted leading-snug">{text}</div>
    </div>
  );
}

export function PatrimonioTooltip() {
  const { t } = useTranslation();
  const data = usePatrimonio();
  if (data && data.assets.length === 0 && data.liabilities.length === 0) {
    return <Invite title={t("nav.patrimonio")} text={t("patrimonio.tipEmpty")} />;
  }
  return (
    <Shell title={t("nav.patrimonio")}>
      <PatrimonioSummary />
    </Shell>
  );
}

export function LiberdadeTooltip() {
  const { t } = useTranslation();
  const v = useLiberdade();
  if (!v || !v.ready) {
    return <Invite title={t("nav.liberdade")} text={t("liberdade.tipEmpty")} />;
  }
  return (
    <Shell title={t("nav.liberdade")}>
      <LiberdadeSummary />
    </Shell>
  );
}

export function ProjecaoTooltip() {
  const { t } = useTranslation();
  // Projeção nunca fica vazia (sempre projeta a partir do patrimônio/aportes) → sem convite.
  return (
    <Shell title={t("nav.projecao")}>
      <ProjecaoSummary />
    </Shell>
  );
}

export function HistoricoTooltip() {
  const { t } = useTranslation();
  const data = useHistorico();
  if (data && data.length === 0) {
    return <Invite title={t("nav.historico")} text={t("historico.tipEmpty")} />;
  }
  return (
    <Shell title={t("nav.historico")}>
      <HistoricoSummary />
    </Shell>
  );
}

export function ObjetivosTooltip() {
  const { t } = useTranslation();
  const data = useObjetivos();
  if (!data || data.length === 0) {
    return <Invite title={t("nav.objetivos")} text={t("objetivos.tipEmpty")} />;
  }
  return (
    <Shell title={t("nav.objetivos")}>
      <ObjetivosSummary />
    </Shell>
  );
}

export function CrossborderTooltip() {
  const { t } = useTranslation();
  const fx = useFxExposure();
  // Sem exposição estrangeira (tudo na moeda base) → convite, não "0 / 0%".
  if (fx.foreign === 0) {
    return <Invite title={t("nav.crossborder")} text={t("crossborder.tipEmpty")} />;
  }
  return (
    <Shell title={t("nav.crossborder")}>
      <CrossBorderSummary />
    </Shell>
  );
}
