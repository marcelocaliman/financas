import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ComingSoon } from "@/components/common/coming-soon";
import { Accordion } from "@/components/common/accordion";
import { useStickyOffset, StickyOffsetContext } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";
import { DashboardHero, DashboardDetail } from "@/pages/painel";
import { DueAlertBar } from "@/components/layout/due-alert-bar";
import Patrimonio, { PatrimonioSummary } from "@/pages/patrimonio";
import Orcamento, { OrcamentoSummary } from "@/pages/orcamento";
import Historico, { HistoricoSummary } from "@/pages/historico";
import Objetivos, { ObjetivosSummary } from "@/pages/objetivos";
import Projecao, { ProjecaoSummary } from "@/pages/projecao";
import Liberdade, { LiberdadeSummary } from "@/pages/liberdade";
import CrossBorder, { CrossBorderSummary } from "@/pages/cross-border";

/** id → { detalhe (corpo do accordion), summary (KPIs do header) }. */
const SECTIONS: Record<string, { detail: ReactNode; summary: ReactNode }> = {
  patrimonio: { detail: <Patrimonio />, summary: <PatrimonioSummary /> },
  orcamento: { detail: <Orcamento />, summary: <OrcamentoSummary /> },
  historico: { detail: <Historico />, summary: <HistoricoSummary /> },
  objetivos: { detail: <Objetivos />, summary: <ObjetivosSummary /> },
  projecao: { detail: <Projecao />, summary: <ProjecaoSummary /> },
  liberdade: { detail: <Liberdade />, summary: <LiberdadeSummary /> },
  crossborder: { detail: <CrossBorder />, summary: <CrossBorderSummary /> },
};

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto";

/** Página editorial única: hero full-bleed + seções em accordions (KPIs no header). */
export function OnePage() {
  const { t } = useTranslation();
  const stickyTop = useStickyOffset();
  const rest = NAV_ITEMS.slice(1);

  return (
    <div>
      {/* PAINEL — hero (glow full-bleed, mais ar) | divisor | dashboard */}
      <section id="painel" className="scroll-mt-20">
        {/* Título estável da página (outline do documento) — visível só p/ leitores de tela. */}
        <h1 className="sr-only">{t("app.name")}</h1>
        <div className="hero-bg w-full overflow-hidden">
          {/* pt-[68px] = folga do topo pro ticker/MobileBar flutuante (h-62 + respiro). */}
          <div className={cn(CONTAINER, GUTTERS, "pt-[68px] pb-8 sm:pb-14")}>
            <DueAlertBar />
            {/* Gap CONSTANTE do topo do hero — não incha quando NÃO há alerta. O 1º elemento
                (barra de vencidas, card de boas-vindas/nudge ou o eyebrow) fica sempre à mesma
                distância curta do ticker; antes, sem alerta, o wrapper virava `:first-child` e
                ganhava 40px, jogando o card de boas-vindas pra baixo com um vão enorme. */}
            <div className="pt-4 sm:pt-5">
              <DashboardHero />
            </div>
          </div>
        </div>
        <div className="border-t border-border" />
        <div className={cn(CONTAINER, GUTTERS, "pt-6 pb-10 sm:pt-9 sm:pb-16")}>
          <DashboardDetail />
        </div>
      </section>

      {/* Demais seções como accordions (KPIs no cabeçalho, detalhes dentro). O cabeçalho de cada
          seção aberta gruda no topo enquanto ela rola — offset do layout via StickyOffsetContext. */}
      <StickyOffsetContext.Provider value={stickyTop}>
        <div className={cn(CONTAINER, GUTTERS, "pb-6 sm:pb-20 lg:pb-28")}>
          {rest.map((item) => {
            const sec = SECTIONS[item.id];
            return (
              <Accordion key={item.id} id={item.id} title={t(`nav.${item.key}`)} summary={sec?.summary}>
                {sec?.detail ?? <ComingSoon />}
              </Accordion>
            );
          })}
        </div>
      </StickyOffsetContext.Provider>

      <Footer />
    </div>
  );
}
