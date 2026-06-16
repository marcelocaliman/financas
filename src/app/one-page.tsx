import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ComingSoon } from "@/components/common/coming-soon";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";
import { DashboardHero, DashboardDetail } from "@/pages/painel";
import Patrimonio from "@/pages/patrimonio";
import Config from "@/pages/config";

const CONTENT: Record<string, ReactNode> = {
  patrimonio: <Patrimonio />,
  config: <Config />,
};

const GUTTERS = "px-5 md:px-8 lg:px-10";
const CONTAINER = "max-w-[1120px] mx-auto";

/** Página editorial única: HERO full-bleed (header flutua por cima) + seções. */
export function OnePage() {
  const { t } = useTranslation();
  const rest = NAV_ITEMS.slice(1);

  return (
    <div>
      {/* DASHBOARD full-bleed — hero + detalhe, tudo no mesmo degradê */}
      <section id="painel" className="hero-bg relative">
        <div className={cn(CONTAINER, "pt-32 lg:pt-40 pb-24", GUTTERS)}>
          <DashboardHero />
          <DashboardDetail />
        </div>
      </section>

      {/* Seções no container */}
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
    <section className="scroll-mt-28 pt-24 pb-2 border-t border-border" id={id}>
      <h2 className="font-display font-semibold text-[clamp(28px,4.4vw,46px)] tracking-[-0.02em] leading-[1.05] mb-10 lg:mb-12">
        {title}
      </h2>
      {children}
    </section>
  );
}
