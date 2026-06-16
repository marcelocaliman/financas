import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Eyebrow } from "@/components/common/tile";
import { ComingSoon } from "@/components/common/coming-soon";
import { cn } from "@/lib/utils";
import { DashboardHero, DashboardDetail } from "@/pages/painel";
import Patrimonio from "@/pages/patrimonio";
import Config from "@/pages/config";

const CONTENT: Record<string, ReactNode> = {
  patrimonio: <Patrimonio />,
  config: <Config />,
};

const GUTTERS = "px-5 md:px-8 lg:px-12 xl:px-16";

/** Página editorial única: HERO full-bleed (header flutua por cima) + seções numeradas. */
export function OnePage() {
  const { t } = useTranslation();
  const rest = NAV_ITEMS.slice(1);

  return (
    <div>
      {/* DASHBOARD full-bleed — hero + detalhe, tudo no mesmo degradê */}
      <section id="painel" className="hero-bg relative">
        <div className={cn("max-w-[1560px] mx-auto pt-28 lg:pt-32 pb-20", GUTTERS)}>
          <DashboardHero />
          <DashboardDetail />
        </div>
      </section>

      {/* Seções numeradas no container */}
      <div className={cn("max-w-[1560px] mx-auto", GUTTERS)}>
        {rest.map((item, i) => (
          <Section key={item.id} id={item.id} index={i + 1} title={t(`nav.${item.key}`)}>
            {CONTENT[item.id] ?? <ComingSoon />}
          </Section>
        ))}
      </div>
    </div>
  );
}

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-20 pt-16 lg:pt-24 pb-4 border-t border-border" id={id}>
      <header className="mb-8 lg:mb-12">
        <Eyebrow>{String(index).padStart(2, "0")}</Eyebrow>
        <h2 className="font-display font-semibold text-[clamp(30px,4.6vw,52px)] tracking-[-0.025em] mt-2.5">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}
