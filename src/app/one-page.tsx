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

const GUTTERS = "px-5 md:px-10 lg:px-14";

/** Página editorial única, FULL-WIDTH: HERO com glow + divisor + dashboard + seções. */
export function OnePage() {
  const { t } = useTranslation();
  const rest = NAV_ITEMS.slice(1);

  return (
    <div>
      {/* PAINEL — hero (glow, mais ar) | divisor | dashboard */}
      <section id="painel" className="scroll-mt-20">
        <div className={cn("hero-bg w-full overflow-hidden", GUTTERS)}>
          <div className="pt-[72px] pb-14">
            <DashboardHero />
          </div>
        </div>
        <div className="border-t border-border" />
        <div className={cn("w-full pt-9 pb-9", GUTTERS)}>
          <DashboardDetail />
        </div>
      </section>

      {/* Demais seções (âncoras) */}
      <div className={cn("w-full", GUTTERS)}>
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
    <section className="scroll-mt-20 pt-20 pb-2 border-t border-border" id={id}>
      <h2 className="font-semibold text-[clamp(26px,4vw,40px)] tracking-[-0.03em] leading-[1.05] mb-8">
        {title}
      </h2>
      {children}
    </section>
  );
}
