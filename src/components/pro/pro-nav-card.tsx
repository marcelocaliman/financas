import { useTranslation } from "react-i18next";
import { Sparkles, ChevronRight } from "lucide-react";
import { useIsPro } from "@/hooks/use-pro";
import { useProStore } from "@/store/pro";
import { cn } from "@/lib/utils";

/** Chip do plano atual (Grátis / Teste / Pro) — pra mostrar o plano no menu e onde precisar. */
export function PlanChip() {
  const { t } = useTranslation();
  const { isPro, resolved } = useIsPro();
  const sub = useProStore((s) => s.sub);
  if (!resolved) return null;
  const trialing = !!sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now();
  const label = trialing ? t("billing.state.trialing") : isPro ? t("pro.badge") : t("billing.free");
  const accent = isPro || trialing;
  return (
    <span
      className={cn(
        "shrink-0 rounded-[6px] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]",
        accent ? "bg-accent-soft text-accent" : "border border-border text-faint",
      )}
    >
      {label}
    </span>
  );
}

/** CTA do Pro no menu lateral — só pra quem NÃO é Pro (admin/Pro não vê). Verde pra
 *  destacar. Abre o diálogo de assinatura/benefícios. */
export function ProNavCard({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { isPro, resolved } = useIsPro();
  const openPaywall = useProStore((s) => s.openPaywall);

  if (!resolved || isPro) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => openPaywall("nav")}
        title={t("pro.navTitle")}
        aria-label={t("pro.navTitle")}
        className="grid place-items-center w-9 h-9 rounded-[10px] bg-accent-soft text-accent transition hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <Sparkles size={16} />
      </button>
    );
  }

  return (
    <div className="mb-2.5">
      <button
        type="button"
        onClick={() => openPaywall("nav")}
        className="w-full text-left rounded-[12px] bg-accent-soft p-3 transition hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
            <Sparkles size={15} />
          </span>
          <span className="text-[13px] font-semibold text-text">{t("pro.navTitle")}</span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{t("pro.navDesc")}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent">
          {t("pro.navCta")} <ChevronRight size={13} />
        </span>
      </button>
    </div>
  );
}
