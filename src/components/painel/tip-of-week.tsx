import { useTranslation } from "react-i18next";
import { Lightbulb, X } from "lucide-react";
import { currentTip } from "@/content/tips";
import { useEngagement } from "@/store/engagement";

/**
 * "Dica da semana" — card com o insight cross-border/FIRE do fundador, rotacionando por semana.
 * Mão única (sem UGC/moderação), sem link externo (mantém o usuário no app). Dispensável até a
 * próxima semana. Container: escolhe a dica + estado de dispensa. A View é pura.
 */
export function TipOfWeek() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? "pt").startsWith("en") ? "en" : "pt";
  const dismissedTip = useEngagement((s) => s.dismissedTip);
  const dismissTip = useEngagement((s) => s.dismissTip);
  const tip = currentTip(new Date());
  if (dismissedTip === tip.id) return null;
  return (
    <div className="mb-6">
      <TipOfWeekView title={tip.title[lang]} body={tip.body[lang]} onDismiss={() => dismissTip(tip.id)} />
    </div>
  );
}

/** Parte visual pura. */
export function TipOfWeekView({ title, body, onDismiss }: { title: string; body: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid place-items-center w-9 h-9 rounded-[11px] bg-accent-soft text-accent shrink-0">
          <Lightbulb size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{t("tip.eyebrow")}</div>
          <div className="text-[14.5px] font-semibold text-text leading-snug mt-1">{title}</div>
          <p className="text-[13px] text-muted leading-relaxed mt-1.5">{body}</p>
        </div>
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
