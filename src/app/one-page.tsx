import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ComingSoon } from "@/components/common/coming-soon";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";
import { DashboardHero, DashboardDetail } from "@/pages/painel";
import Patrimonio from "@/pages/patrimonio";
import Investimentos from "@/pages/investimentos";
import Orcamento from "@/pages/orcamento";
import Historico from "@/pages/historico";
import Objetivos from "@/pages/objetivos";
import Projecao from "@/pages/projecao";

const CONTENT: Record<string, ReactNode> = {
  patrimonio: <Patrimonio />,
  investimentos: <Investimentos />,
  orcamento: <Orcamento />,
  historico: <Historico />,
  objetivos: <Objetivos />,
  projecao: <Projecao />,
};

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto";

/** Página editorial única: fundo do header/hero full-bleed; conteúdo capado em 1280px. */
export function OnePage() {
  const { t } = useTranslation();
  const rest = NAV_ITEMS.slice(1);

  return (
    <div>
      {/* PAINEL — hero (glow full-bleed, mais ar) | divisor | dashboard */}
      <section id="painel" className="scroll-mt-20">
        <div className="hero-bg w-full overflow-hidden">
          <div className={cn(CONTAINER, GUTTERS, "pt-[108px] pb-14")}>
            <DashboardHero />
          </div>
        </div>
        <div className="border-t border-border" />
        <div className={cn(CONTAINER, GUTTERS, "pt-9 pb-24")}>
          <DashboardDetail />
        </div>
      </section>

      {/* Demais seções (âncoras) */}
      <div className={cn(CONTAINER, GUTTERS)}>
        {rest.map((item) => (
          <Section key={item.id} id={item.id} title={t(`nav.${item.key}`)}>
            {CONTENT[item.id] ?? <ComingSoon />}
          </Section>
        ))}
      </div>

      <Footer />
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-[88px] pt-24 pb-24 border-t border-border" id={id}>
      <h2 className="font-semibold text-[clamp(26px,4vw,40px)] tracking-[-0.03em] leading-[1.05] mb-8">
        {title}
      </h2>
      {children}
    </section>
  );
}
