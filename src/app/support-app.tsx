import { useTranslation } from "react-i18next";
import Suporte, { SuporteSummary } from "@/pages/suporte";
import { cn } from "@/lib/utils";

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto";

/**
 * Conteúdo da página de Ajuda & Suporte — renderizado DENTRO da casca (com o rail do menu
 * presente e o "Voltar ao app" no rodapé do menu), igual à Config. Hero + a central de tickets.
 */
export function SupportView() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <section className="scroll-mt-24">
        <div className={cn(CONTAINER, GUTTERS, "pt-8 lg:pt-10 pb-9")}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-semibold text-[clamp(2rem,4.4vw,3.2rem)] tracking-[-0.04em] leading-[1.04]">
              {t("nav.suporte")}
            </h1>
            <SuporteSummary />
          </div>
        </div>
        <div className="border-t border-border" />
      </section>
      <div className={cn(CONTAINER, GUTTERS, "py-8 lg:py-10")}>
        <Suporte />
      </div>
    </div>
  );
}
