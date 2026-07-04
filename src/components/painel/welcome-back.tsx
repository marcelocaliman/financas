import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, TrendingUp, TrendingDown, Sparkles, X } from "lucide-react";
import { useEngagement } from "@/store/engagement";
import { useDueBills } from "@/hooks/use-due-bills";
import { goToSection } from "@/hooks/use-scroll-spy";
import { Hidden } from "@/components/common/hidden";
import { cn } from "@/lib/utils";

/** Chave do dia local (AAAA-M-D) — pra mostrar a faixa 1× por dia (na 1ª visita do dia). */
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function relTime(gapMs: number, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const hours = Math.round(gapMs / 3_600_000);
  return hours < 24 ? rtf.format(-Math.max(1, hours), "hour") : rtf.format(-Math.round(hours / 24), "day");
}

function Chip({ icon: Icon, tone, onClick, children }: { icon: typeof CalendarClock; tone?: "accent" | "neg"; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border border-border bg-card text-[12px] font-medium text-muted hover:text-text hover:border-border-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] whitespace-nowrap"
    >
      <Icon size={13} className={cn("shrink-0", tone === "accent" ? "text-accent" : tone === "neg" ? "text-neg" : "text-faint")} />
      {children}
    </button>
  );
}

/**
 * Container: decide se mostra (1× por dia, na 1ª visita do dia) e calcula o "há X" + contas a vencer.
 * Marca a visita no mount. A View é pura (fácil de prever isolada). Números respeitam privacidade.
 */
export function WelcomeBack({ name, nwChange, freedomPct, hasTrend }: { name: string; nwChange: number; freedomPct: number | null; hasTrend: boolean }) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const due = useDueBills();
  const lastVisit = useEngagement((s) => s.lastVisit);
  const markVisit = useEngagement((s) => s.markVisit);
  const [firstSeen] = useState(lastVisit); // congela o valor da montagem antes de sobrescrever
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    markVisit();
  }, [markVisit]);

  const now = Date.now();
  const gapMs = firstSeen != null ? now - firstSeen : 0;
  // Mostra só na 1ª visita de um DIA NOVO (última visita foi em outro dia). Assim aparece 1×/dia
  // e some nos reloads seguintes do mesmo dia. 1ª visita de todas (firstSeen null) → nada.
  const newDay = firstSeen != null && dayKey(firstSeen) !== dayKey(now);
  if (dismissed || !newDay) return null;

  return (
    <WelcomeBackView
      name={name}
      relLabel={relTime(gapMs, lang)}
      dueCount={due.count}
      nwChange={nwChange}
      freedomPct={freedomPct}
      hasTrend={hasTrend}
      onDismiss={() => setDismissed(true)}
    />
  );
}

/** Parte visual pura — saudação + 1–3 chips do que pede atenção agora. */
export function WelcomeBackView({
  name,
  relLabel,
  dueCount,
  nwChange,
  freedomPct,
  hasTrend,
  onDismiss,
}: {
  name: string;
  relLabel: string;
  dueCount: number;
  nwChange: number;
  freedomPct: number | null;
  hasTrend: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const up = nwChange >= 0;
  return (
    <div className="relative mb-4 sm:mb-7 flex flex-col gap-3 rounded-[14px] border border-border bg-[color-mix(in_oklab,var(--card-2)_60%,transparent)] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2.5">
      <div className="flex items-center gap-2.5 min-w-0 pr-8 sm:pr-0">
        <span className="text-[15px] leading-none" aria-hidden>👋</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-text leading-tight truncate">
            {name ? t("welcome.titleName", { name }) : t("welcome.title")}
          </div>
          <div className="text-[11.5px] text-faint leading-tight mt-0.5">{t("welcome.lastVisit", { rel: relLabel })}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {dueCount > 0 ? (
          <Chip icon={CalendarClock} tone="neg" onClick={() => goToSection("orcamento")}>
            <Hidden>{dueCount}</Hidden> {t("welcome.due")}
          </Chip>
        ) : null}
        {hasTrend ? (
          <Chip icon={up ? TrendingUp : TrendingDown} tone={up ? "accent" : "neg"} onClick={() => goToSection("historico")}>
            <span className={cn("tabular", up ? "text-accent" : "text-neg")}>
              <Hidden>{(up ? "+" : "") + nwChange.toFixed(1) + "%"}</Hidden>
            </span>{" "}
            {t("dashboard.vsMonth")}
          </Chip>
        ) : null}
        {freedomPct != null ? (
          <Chip icon={Sparkles} tone="accent" onClick={() => goToSection("liberdade")}>
            <span className="tabular text-accent"><Hidden>{Math.round(freedomPct) + "%"}</Hidden></span> {t("welcome.fire")}
          </Chip>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("welcome.dismiss")}
        className="absolute top-2.5 right-2.5 sm:static sm:top-auto sm:right-auto shrink-0 grid place-items-center w-7 h-7 rounded-[8px] text-faint hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <X size={15} />
      </button>
    </div>
  );
}
