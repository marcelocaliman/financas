import { useState } from "react";
import { Accordion } from "@/components/common/accordion";
import { StickyOffsetContext, useStickyOffset } from "@/hooks/use-scroll-spy";
import { OverviewSection } from "./sections/overview";
import { UsersSection, UsersSummary } from "./sections/users";
import { AnalyticsSection, AnalyticsSummary } from "./sections/analytics";
import { AccessLogSection, AccessSummary } from "./sections/access-log";
import { AdminsSection, AdminsSummary } from "./sections/admins";
import { FlagsSection, FlagsSummary } from "./sections/flags";
import { AdsSection, AdsSummary } from "./sections/ads";
import { SectionErrorBoundary } from "./error-boundary";
import { cn } from "@/lib/utils";

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto";
const PERIODS = [7, 30, 90] as const;

/** Página do painel super-admin: mesma linguagem editorial do app (hero + accordions). */
export function AdminPage() {
  const [days, setDays] = useState<number>(30);
  const stickyTop = useStickyOffset();

  return (
    <div className="view-fade-in">
      {/* Hero — mesma faixa/gutters/topo do app */}
      <section className="scroll-mt-24">
        <div className={cn(CONTAINER, GUTTERS, "pt-2 lg:pt-6 pb-10")}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent mb-4">
                Super-admin · só metadados (LGPD)
              </div>
              <h1 className="font-semibold text-[clamp(2.2rem,4.6vw,3.4rem)] tracking-[-0.04em] leading-[1.04]">
                Gestão do app
              </h1>
              <p className="mt-3.5 text-muted text-[14px] leading-relaxed max-w-[560px]">
                Usuários, churn, acessos e analytics — tudo agregado e sem nunca ler o dado financeiro,
                que é cifrado ponta-a-ponta.
              </p>
            </div>
            <div className="flex gap-1 rounded-[11px] border border-border bg-card2 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  className={cn(
                    "h-8 px-3 rounded-[8px] text-[12.5px] font-medium tabular transition-colors",
                    days === p ? "bg-accent text-[#0A0B0D]" : "text-muted hover:text-text",
                  )}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border" />
      </section>

      {/* Visão geral — SEMPRE visível (não é accordion), igual ao Painel do app do usuário. */}
      <section id="adm-overview" className="scroll-mt-24">
        <div className={cn(CONTAINER, GUTTERS, "pt-8 pb-12")}>
          <div className="mb-5 flex items-baseline gap-2.5">
            <h2 className="text-[15px] font-semibold text-text">Visão geral</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">painel</span>
          </div>
          <SectionErrorBoundary name="Visão geral"><OverviewSection days={days} /></SectionErrorBoundary>
        </div>
      </section>

      {/* Demais seções: accordions. Cabeçalhos grudam no topo enquanto rolam — via StickyOffsetContext. */}
      <StickyOffsetContext.Provider value={stickyTop}>
      <div className={cn(CONTAINER, GUTTERS, "pb-24 lg:pb-28")}>
        <Accordion id="adm-users" title="Usuários" summary={<UsersSummary />}>
          <SectionErrorBoundary name="Usuários"><UsersSection /></SectionErrorBoundary>
        </Accordion>
        <Accordion id="adm-analytics" title="Analytics" summary={<AnalyticsSummary days={days} />}>
          <SectionErrorBoundary name="Analytics"><AnalyticsSection days={days} /></SectionErrorBoundary>
        </Accordion>
        <Accordion id="adm-access" title="Acessos & logs" summary={<AccessSummary />}>
          <SectionErrorBoundary name="Acessos & logs"><AccessLogSection /></SectionErrorBoundary>
        </Accordion>
        <Accordion id="adm-admins" title="Administradores" summary={<AdminsSummary />}>
          <SectionErrorBoundary name="Administradores"><AdminsSection /></SectionErrorBoundary>
        </Accordion>
        <Accordion id="adm-flags" title="Flags de funcionalidade" summary={<FlagsSummary />}>
          <SectionErrorBoundary name="Flags"><FlagsSection /></SectionErrorBoundary>
        </Accordion>
        <Accordion id="adm-ads" title="Ads" summary={<AdsSummary />}>
          <SectionErrorBoundary name="Ads"><AdsSection /></SectionErrorBoundary>
        </Accordion>
      </div>
      </StickyOffsetContext.Provider>
    </div>
  );
}
