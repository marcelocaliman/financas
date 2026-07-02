import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KpiStack } from "@/components/common/header-kpis";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useLiberdade } from "@/hooks/use-liberdade";
import { PatrimonioSummary } from "@/pages/patrimonio";
import { LiberdadeSummary } from "@/pages/liberdade";
import { ProjecaoSummary } from "@/pages/projecao";

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
