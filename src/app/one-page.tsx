import { lazy, Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ComingSoon } from "@/components/common/coming-soon";
import { Accordion } from "@/components/common/accordion";
import { useStickyOffset, StickyOffsetContext } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";
import { lazyRetry } from "@/lib/lazy-retry";
import { Footer } from "@/components/layout/footer";
import { SectionBoundary } from "@/components/common/error-boundary";
import { DashboardHero, DashboardDetail, PainelViewProvider } from "@/pages/painel";
import { DueAlertBar } from "@/components/layout/due-alert-bar";
// Os *Summary são EAGER (renderizam SEMPRE: header dos accordions + tooltips do menu lateral).
import { PatrimonioSummary } from "@/pages/summaries/patrimonio-summary";
import { OrcamentoSummary } from "@/pages/summaries/orcamento-summary";
import { HistoricoSummary } from "@/pages/summaries/historico-summary";
import { ObjetivosSummary } from "@/pages/summaries/objetivos-summary";
import { ProjecaoSummary } from "@/pages/summaries/projecao-summary";
import { LiberdadeSummary } from "@/pages/summaries/liberdade-summary";
import { CrossBorderSummary } from "@/pages/summaries/cross-border-summary";

// Corpo das seções em lazy (code-split): cada página vira um chunk próprio, carregado quando o
// accordion renderiza o detalhe — o bundle inicial fica só com o hero/dashboard + summaries.
// lazyRetry: aba antiga + deploy novo = chunk sumiu → recarrega 1× sozinho em vez de quebrar.
const Patrimonio = lazy(lazyRetry(() => import("@/pages/patrimonio")));
const Orcamento = lazy(lazyRetry(() => import("@/pages/orcamento")));
const Historico = lazy(lazyRetry(() => import("@/pages/historico")));
const Objetivos = lazy(lazyRetry(() => import("@/pages/objetivos")));
const Projecao = lazy(lazyRetry(() => import("@/pages/projecao")));
const Liberdade = lazy(lazyRetry(() => import("@/pages/liberdade")));
const CrossBorder = lazy(lazyRetry(() => import("@/pages/cross-border")));

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
      {/* PAINEL — hero (glow full-bleed, mais ar) | divisor | dashboard.
          Provider: a view (agregados/conversões) é computada UMA vez pro Hero E pro Detail.
          Boundary EXTERNO cobre o próprio provider (a computação da view). */}
      <SectionBoundary name="painel">
      <PainelViewProvider>
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
              <SectionBoundary name="painel-hero">
                <DashboardHero />
              </SectionBoundary>
            </div>
          </div>
        </div>
        <div className="border-t border-border" />
        <div className={cn(CONTAINER, GUTTERS, "pt-6 pb-10 sm:pt-9 sm:pb-16")}>
          <SectionBoundary name="painel-detail">
            <DashboardDetail />
          </SectionBoundary>
        </div>
      </section>
      </PainelViewProvider>
      </SectionBoundary>

      {/* Demais seções como accordions (KPIs no cabeçalho, detalhes dentro). O cabeçalho de cada
          seção aberta gruda no topo enquanto ela rola — offset do layout via StickyOffsetContext. */}
      <StickyOffsetContext.Provider value={stickyTop}>
        <div className={cn(CONTAINER, GUTTERS, "pb-6 sm:pb-20 lg:pb-28")}>
          {rest.map((item) => {
            const sec = SECTIONS[item.id];
            return (
              <Accordion
                key={item.id}
                id={item.id}
                title={t(`nav.${item.key}`)}
                // Boundary também no summary (renderiza SEMPRE, no header): um crash ali não pode
                // derrubar a página toda — vira só um aviso compacto no cabeçalho.
                summary={sec?.summary ? <SectionBoundary name={`${item.id}-summary`} inline>{sec.summary}</SectionBoundary> : undefined}
              >
                {/* Boundary FORA do Suspense: um crash na seção vira aviso local; o fallback do
                    Suspense cobre só o carregamento do chunk lazy. */}
                <SectionBoundary name={item.id}>
                  <Suspense fallback={<div className="h-44 rounded-[16px] bg-card border border-border animate-pulse" />}>
                    {sec?.detail ?? <ComingSoon />}
                  </Suspense>
                </SectionBoundary>
              </Accordion>
            );
          })}
        </div>
      </StickyOffsetContext.Provider>

      <Footer />
    </div>
  );
}
