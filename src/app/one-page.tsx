import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ComingSoon } from "@/components/common/coming-soon";
import { Accordion } from "@/components/common/accordion";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";
import { DashboardHero, DashboardDetail } from "@/pages/painel";
import Patrimonio, { PatrimonioSummary } from "@/pages/patrimonio";
import Investimentos, { InvestimentosSummary } from "@/pages/investimentos";
import Orcamento, { OrcamentoSummary } from "@/pages/orcamento";
import Historico, { HistoricoSummary } from "@/pages/historico";
import Objetivos, { ObjetivosSummary } from "@/pages/objetivos";
import Projecao, { ProjecaoSummary } from "@/pages/projecao";

/** id → { detalhe (corpo do accordion), summary (KPIs do header) }. */
const SECTIONS: Record<string, { detail: ReactNode; summary: ReactNode }> = {
  patrimonio: { detail: <Patrimonio />, summary: <PatrimonioSummary /> },
  investimentos: { detail: <Investimentos />, summary: <InvestimentosSummary /> },
  orcamento: { detail: <Orcamento />, summary: <OrcamentoSummary /> },
  historico: { detail: <Historico />, summary: <HistoricoSummary /> },
  objetivos: { detail: <Objetivos />, summary: <ObjetivosSummary /> },
  projecao: { detail: <Projecao />, summary: <ProjecaoSummary /> },
};

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto";

/** Página editorial única: hero full-bleed + seções em accordions (KPIs no header). */
export function OnePage() {
  const { t } = useTranslation();
  const rest = NAV_ITEMS.slice(1);

  return (
    <div>
      {/* PAINEL — hero (glow full-bleed, mais ar) | divisor | dashboard */}
      <section id="painel" className="scroll-mt-20">
        {/* Título estável da página (outline do documento) — visível só p/ leitores de tela. */}
        <h1 className="sr-only">{t("app.name")}</h1>
        <div className="hero-bg w-full overflow-hidden">
          <div className={cn(CONTAINER, GUTTERS, "pt-[108px] pb-14")}>
            <DashboardHero />
          </div>
        </div>
        <div className="border-t border-border" />
        <div className={cn(CONTAINER, GUTTERS, "pt-9 pb-16")}>
          <DashboardDetail />
        </div>
      </section>

      {/* Demais seções como accordions (KPIs no cabeçalho, detalhes dentro) */}
      <div className={cn(CONTAINER, GUTTERS, "pb-20 lg:pb-28")}>
        {rest.map((item) => {
          const sec = SECTIONS[item.id];
          return (
            <Accordion key={item.id} id={item.id} title={t(`nav.${item.key}`)} summary={sec?.summary}>
              {sec?.detail ?? <ComingSoon />}
            </Accordion>
          );
        })}
      </div>

      <Footer />
    </div>
  );
}
