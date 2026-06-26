import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/common/button";
import { useProStore } from "@/store/pro";
import { startProTrial } from "@/hooks/use-pro";
import { ProBadge } from "./pro-badge";

/** Card de upsell mostrado no lugar de uma feature Pro pra quem é free.
 *  Oferece o teste grátis de 14 dias (sem Stripe) e o "Assinar Pro" (diálogo na Fase B). */
export function ProUpsell({ title, desc, feature }: { title?: string; desc?: string; feature?: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const trialStarted = useProStore((s) => s.sub?.trial_started ?? false);
  const openPaywall = useProStore((s) => s.openPaywall);

  async function onTrial() {
    setBusy(true);
    try {
      await startProTrial();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[16px] border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Sparkles size={20} />
      </div>
      <div className="flex items-center justify-center gap-2">
        <ProBadge />
        <span className="text-[15px] font-semibold">{title ?? t("pro.title")}</span>
      </div>
      <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted leading-relaxed">{desc ?? t("pro.lockedDesc")}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {!trialStarted ? (
          <Button onClick={onTrial} disabled={busy}>
            {t("pro.startTrial")}
          </Button>
        ) : null}
        <Button variant={trialStarted ? "primary" : "secondary"} onClick={() => openPaywall(feature ?? title)}>
          {t("pro.subscribe")}
        </Button>
      </div>
    </div>
  );
}
