import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PartyPopper, ArrowRight, X } from "lucide-react";
import { useUI } from "@/store/ui";
import { useLiberdade } from "@/hooks/use-liberdade";
import type { Milestone } from "@/hooks/use-liberdade";
import { useEngagement } from "@/store/engagement";
import { goToSection } from "@/hooks/use-scroll-spy";
import { Money } from "@/components/common/money";

/** Chave ESTÁVEL do marco (o `value` muda com a moeda de exibição; o `pct` não). */
function msKey(m: Milestone): string {
  return m.kind === "wealth" && m.pct != null ? `w${Math.round(m.pct)}` : `${m.kind}:${Math.round(m.value)}`;
}

/**
 * Comemora quando o usuário CRUZA um marco rumo à independência. Roda uma vez por sessão (quando
 * os dados carregam): na 1ª vez de todas, semeia os marcos já batidos SEM comemorar (senão
 * festejaria conquistas antigas); depois, festeja o maior marco novo e mostra o próximo.
 */
export function MilestoneCelebration() {
  const v = useLiberdade();
  const seenMilestones = useEngagement((s) => s.seenMilestones);
  const milestonesInitialized = useEngagement((s) => s.milestonesInitialized);
  const initMilestones = useEngagement((s) => s.initMilestones);
  const markMilestones = useEngagement((s) => s.markMilestones);
  const [celebrate, setCelebrate] = useState<Milestone | null>(null);
  const [next, setNext] = useState<Milestone | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !v || !v.ready) return; // espera os dados de liberdade
    ranRef.current = true;
    const achieved = v.milestones.filter((m) => m.achieved);
    const keys = achieved.map(msKey);
    if (!milestonesInitialized) {
      initMilestones(keys); // 1ª rodada: semeia, não comemora
      return;
    }
    const newly = achieved.filter((m) => !seenMilestones.includes(msKey(m)));
    if (newly.length) {
      setCelebrate(newly.reduce((a, b) => (b.value > a.value ? b : a))); // o MAIOR marco novo
      setNext(v.milestones.find((m) => !m.achieved) ?? null);
      markMilestones(newly.map(msKey));
    }
  }, [v, milestonesInitialized, seenMilestones, initMilestones, markMilestones]);

  if (!celebrate) return null;
  return <MilestoneCelebrationView milestone={celebrate} next={next} onDismiss={() => setCelebrate(null)} />;
}

/** Parte visual pura — banner festivo (acento) com o marco batido + o próximo. */
export function MilestoneCelebrationView({ milestone, next, onDismiss }: { milestone: Milestone; next: Milestone | null; onDismiss: () => void }) {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const celebrate = milestone;
  return (
    <div className="relative mb-7 overflow-hidden rounded-[16px] border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[var(--accent-soft)] px-4 py-3.5">
      {/* brilho sutil no acento */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="grid place-items-center w-10 h-10 rounded-[12px] bg-card text-accent shrink-0">
          <PartyPopper size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{t("milestone.title")}</div>
          <div className="text-[14px] font-semibold text-text leading-tight mt-1">
            {celebrate.kind === "reserve" ? (
              t("milestone.reserve")
            ) : (
              <>
                {t("milestone.passed")} <Money value={celebrate.value} currency={disp} className="tabular" />
                {celebrate.pct != null ? <span className="text-muted font-normal"> · {t("liberdade.milestoneFreedom", { pct: celebrate.pct })}</span> : null}
              </>
            )}
          </div>
        </div>
        {next ? (
          <button
            type="button"
            onClick={() => goToSection("liberdade")}
            className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2.5 rounded-full border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-card text-[12px] font-medium text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] whitespace-nowrap"
          >
            {t("milestone.next")}: <Money value={next.value} currency={disp} className="tabular" />
            <ArrowRight size={13} className="text-accent" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("welcome.dismiss")}
          className="shrink-0 grid place-items-center w-7 h-7 rounded-[8px] text-faint hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
