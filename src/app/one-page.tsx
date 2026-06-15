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
  patrimonio: <Patrimonio />,
  config: <Config />,
};

/** Página editorial única: o Painel é o HERO full-page; o resto, seções numeradas. */
export function OnePage() {
  const { t } = useTranslation();
  const [hero, ...rest] = NAV_ITEMS;

  return (
    <div>
      {/* HERO — dashboard full-page, sem cabeçalho numerado */}
      <section id={hero.id} className="scroll-mt-16">
        <Painel />
      </section>

      {rest.map((item, i) => (
        <Section key={item.id} id={item.id} index={i + 1} title={t(`nav.${item.key}`)}>
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
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("scroll-mt-20 pt-16 lg:pt-24 pb-4 border-t border-border")} id={id}>
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
