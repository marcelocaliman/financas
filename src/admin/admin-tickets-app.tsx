import { TicketsSection, TicketsSummary } from "./sections/tickets";
import { SectionErrorBoundary } from "./error-boundary";
import { cn } from "@/lib/utils";

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto";

/**
 * Conteúdo da view de Tickets do painel — renderizado no main do AdminApp (com o rail do
 * painel presente), no lugar das métricas. Mesma cara de hero + seção do resto do painel.
 */
export function AdminTicketsView() {
  return (
    <div className="min-h-screen">
      <section className="scroll-mt-24">
        <div className={cn(CONTAINER, GUTTERS, "pt-2 lg:pt-6 pb-8")}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent mb-3">
                Atendimento
              </div>
              <h1 className="font-semibold text-[clamp(2.2rem,4.6vw,3.4rem)] tracking-[-0.04em] leading-[1.04]">Tickets</h1>
            </div>
            <TicketsSummary />
          </div>
        </div>
        <div className="border-t border-border" />
      </section>
      <div className={cn(CONTAINER, GUTTERS, "pt-7 pb-20 lg:pb-24")}>
        <SectionErrorBoundary name="Tickets">
          <TicketsSection />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
