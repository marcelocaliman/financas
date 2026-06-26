import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/common/button";
import { ProBadge } from "@/components/pro/pro-badge";
import { useProStore } from "@/store/pro";
import { useIsPro, startProTrial, refreshPro } from "@/hooks/use-pro";
import { billing } from "@/lib/billing";

/** Resumo pro cabeçalho do accordion (Grátis / Pro). */
export function BillingSummary() {
  const { t } = useTranslation();
  const { isPro } = useIsPro();
  return <>{isPro ? t("pro.badge") : t("billing.free")}</>;
}

/** Seção de Config: estado do plano + iniciar teste / assinar / cancelar. */
export function BillingSection() {
  const { t } = useTranslation();
  const { isPro } = useIsPro();
  const sub = useProStore((s) => s.sub);
  const openPaywall = useProStore((s) => s.openPaywall);
  const [busy, setBusy] = useState(false);

  const trialing = !!sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now();
  const active = sub?.status === "active";
  const canceling = active && !!sub?.cancel_at_period_end;
  const trialUsed = !!sub?.trial_started;
  const stateKey = active ? (canceling ? "canceling" : "active") : trialing ? "trialing" : "free";

  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    try {
      await fn();
      await refreshPro();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="rounded-[16px] border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <span className="text-[15px] font-semibold">{t("billing.title")}</span>
            {isPro ? <ProBadge /> : null}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{t(`billing.state.${stateKey}`)}</span>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t(active ? "billing.activeDesc" : "billing.freeDesc")}</p>
        {trialing && sub?.trial_ends_at ? (
          <p className="mt-1 text-[12px] text-faint">{t("billing.trialUntil", { date: new Date(sub.trial_ends_at).toLocaleDateString() })}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {!isPro && !trialUsed ? (
            <Button variant="secondary" onClick={run(startProTrial)} disabled={busy}>
              {t("pro.startTrial")}
            </Button>
          ) : null}
          {!active ? (
            <Button onClick={() => openPaywall("config")} disabled={busy}>
              {t("pro.subscribe")}
            </Button>
          ) : null}
          {active && !canceling ? (
            <Button variant="ghost" onClick={run(billing.cancel)} disabled={busy}>
              {t("billing.cancel")}
            </Button>
          ) : null}
          {canceling ? (
            <Button variant="secondary" onClick={run(billing.resume)} disabled={busy}>
              {t("billing.resume")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
