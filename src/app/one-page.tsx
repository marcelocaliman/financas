import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Eyebrow } from "@/components/common/tile";
import { ComingSoon } from "@/components/common/coming-soon";
import { cn } from "@/lib/utils";
import Painel from "@/pages/painel";
import Patrimonio from "@/pages/patrimonio";
import Config from "@/pages/config";

/** Conteúdo real por seção; o resto cai no teaser "Em breve". */
const CONTENT: Record<string, ReactNode> = {
  painel: <Painel />,
  patrimonio: <Patrimonio />,
  config: <Config />,
};

/** A página editorial única: cada item de nav vira uma seção-âncora. */
export function OnePage() {
  const { t } = useTranslation();
  return (
    <div>
      {NAV_ITEMS.map((item, i) => (
        <Section
          key={item.id}
          id={item.id}
          index={i + 1}
          title={t(`nav.${item.key}`)}
          first={i === 0}
        >
          {CONTENT[item.id] ?? <ComingSoon />}
        </Section>
      ))}
    </div>
  );
}

function Section({
  id,
  index,
  title,
  first,
  children,
}: {
  id: string;
  index: number;
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24",
        first ? "pt-6 pb-4" : "mt-16 lg:mt-24 pt-16 lg:pt-24 pb-4 border-t border-border",
      )}
    >
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
