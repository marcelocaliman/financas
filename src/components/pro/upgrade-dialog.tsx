import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripe";
import { billing, type CheckoutPlan, type CreateSubResult } from "@/lib/billing";
import { useProStore } from "@/store/pro";
import { refreshPro } from "@/hooks/use-pro";
import { useUI } from "@/store/ui";
import { Button } from "@/components/common/button";
import { cn } from "@/lib/utils";

const stripePromise = getStripe();

/** Form do Payment Element — cartão embutido, 3DS em modal (redirect só "if_required"). */
function PayForm({ mode, onDone }: { mode: "payment" | "setup"; onDone: () => void }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const confirmParams = { return_url: window.location.href };
    const result =
      mode === "setup"
        ? await stripe.confirmSetup({ elements, confirmParams, redirect: "if_required" })
        : await stripe.confirmPayment({ elements, confirmParams, redirect: "if_required" });
    if (result.error) {
      setErr(result.error.message ?? t("pro.errGeneric"));
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-1">
      <PaymentElement />
      {err ? <p className="mt-3 text-[12.5px] text-neg">{err}</p> : null}
      <Button type="submit" disabled={!stripe || busy} className="mt-5 h-10 w-full">
        {busy ? t("pro.processing") : t("pro.pay")}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-faint">
        <ShieldCheck size={13} /> {t("pro.secure")}
      </p>
    </form>
  );
}

function PlanCard({ active, onClick, label, price, per, hint }: { active: boolean; onClick: () => void; label: string; price: string; per: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-[14px] border p-3.5 text-left transition", active ? "border-accent bg-accent-soft" : "border-border hover:bg-card-hover")}
    >
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[19px] font-semibold tracking-[-0.02em] tabular">{price}</span>
        <span className="text-[11px] text-muted">{per}</span>
      </div>
      {hint ? <div className="mt-1 text-[10.5px] font-medium text-accent">{hint}</div> : null}
    </button>
  );
}

/** Diálogo de assinatura embutido (aberto via useProStore.openPaywall). */
export function UpgradeDialog() {
  const { t } = useTranslation();
  const open = useProStore((s) => s.paywallOpen);
  const close = useProStore((s) => s.closePaywall);
  const sub = useProStore((s) => s.sub);
  const theme = useUI((s) => s.theme);

  const [plan, setPlan] = useState<CheckoutPlan>("monthly");
  const [step, setStep] = useState<"plan" | "pay" | "done">("plan");
  const [data, setData] = useState<CreateSubResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("plan");
      setData(null);
      setErr(null);
      setPlan("monthly");
    }
  }, [open]);

  if (!open) return null;

  const trialing = !!sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now();

  async function start() {
    setLoading(true);
    setErr(null);
    try {
      const r = await billing.createSubscription(plan);
      if (r.alreadyActive || r.mode === "none") {
        await refreshPro();
        setStep("done");
        return;
      }
      setData(r);
      setStep("pay");
    } catch {
      setErr(t("pro.errGeneric"));
    } finally {
      setLoading(false);
    }
  }

  const appearance: Appearance = {
    theme: theme === "dark" ? "night" : "stripe",
    variables: { colorPrimary: "#3ECF8E", borderRadius: "10px", fontFamily: "Inter, system-ui, sans-serif" },
  };

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-[18px] border border-border bg-card p-6 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
              <Sparkles size={18} />
            </span>
            <div>
              <div className="text-[15px] font-semibold">{t("pro.upgradeTitle")}</div>
              <div className="text-[12.5px] text-muted">{t("pro.upgradeSub")}</div>
            </div>
          </div>
          <button onClick={close} aria-label={t("pro.close")} className="text-faint transition hover:text-text">
            <X size={18} />
          </button>
        </div>

        {step === "plan" ? (
          <div className="mt-5">
            <div className="grid grid-cols-2 gap-2.5">
              <PlanCard active={plan === "monthly"} onClick={() => setPlan("monthly")} label={t("pro.monthly")} price="R$ 24,90" per={t("pro.perMonth")} />
              <PlanCard active={plan === "annual"} onClick={() => setPlan("annual")} label={t("pro.annual")} price="R$ 249" per={t("pro.perYear")} hint={t("pro.annualHint")} />
            </div>
            <ul className="mt-4 space-y-1.5">
              {[t("pro.benefit1"), t("pro.benefit2"), t("pro.benefit3")].map((b) => (
                <li key={b} className="flex items-center gap-2 text-[12.5px] text-muted">
                  <Check size={14} className="shrink-0 text-accent" /> {b}
                </li>
              ))}
            </ul>
            {trialing ? <p className="mt-3 text-[12px] leading-relaxed text-muted">{t("pro.trialKept")}</p> : null}
            {err ? <p className="mt-3 text-[12.5px] text-neg">{err}</p> : null}
            <Button className="mt-5 h-10 w-full" onClick={start} disabled={loading}>
              {loading ? t("pro.processing") : t("pro.continue")}
            </Button>
          </div>
        ) : null}

        {step === "pay" && data?.clientSecret ? (
          <div className="mt-5">
            <Elements stripe={stripePromise} options={{ clientSecret: data.clientSecret, appearance }}>
              <PayForm
                mode={data.mode === "setup" ? "setup" : "payment"}
                onDone={async () => {
                  await refreshPro();
                  setStep("done");
                }}
              />
            </Elements>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="mt-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
              <Check size={24} />
            </div>
            <div className="mt-3 text-[16px] font-semibold">{t("pro.success")}</div>
            <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">{t("pro.successDesc")}</p>
            <Button className="mt-5" onClick={close}>
              {t("pro.close")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
