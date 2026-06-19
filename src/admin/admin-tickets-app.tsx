import { useEffect } from "react";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { useAdminUI } from "@/store/admin-ui";
import { TicketsSection, TicketsSummary } from "./sections/tickets";
import { SectionErrorBoundary } from "./error-boundary";

/**
 * Tickets em TELA CHEIA dentro do painel — view própria (métricas ↔ tickets). Aberta pelo
 * rodapé do menu do painel; "Voltar ao painel" / ESC voltam pras métricas.
 */
export function AdminTicketsApp() {
  const setTicketsView = useAdminUI((s) => s.setTicketsView);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTicketsView(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setTicketsView]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 h-[60px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
              <LifeBuoy size={16} strokeWidth={2.4} />
            </span>
            <span className="font-semibold text-[15.5px] tracking-[-0.02em] truncate">Tickets</span>
          </div>
          <button
            type="button"
            onClick={() => setTicketsView(false)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] border border-border text-[12.5px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ArrowLeft size={15} /> Voltar ao painel
          </button>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-7 lg:py-9">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent mb-3">
              Atendimento
            </div>
            <h1 className="font-semibold text-[clamp(2rem,4.2vw,3rem)] tracking-[-0.04em] leading-none">Tickets</h1>
          </div>
          <TicketsSummary />
        </div>
        <SectionErrorBoundary name="Tickets">
          <TicketsSection />
        </SectionErrorBoundary>
      </main>
    </div>
  );
}
