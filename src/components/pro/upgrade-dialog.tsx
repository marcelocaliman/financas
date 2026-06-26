import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, ShieldCheck, Sparkles, LineChart, Users, FileBarChart } from "lucide-react";
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

function PlanRow({ active, onClick, label, price, per, hint }: { active: boolean; onClick: () => void; label: string; price: string; per: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center justify-between rounded-[12px] border p-3 text-left transition", active ? "border-accent bg-accent-soft" : "border-border hover:bg-card-hover")}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-4 w-4 place-items-center rounded-full border", active ? "border-accent" : "border-border-strong")}>
          {active ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
        </span>
        <div>
          <div className="text-[13px] font-semibold">{label}</div>
          {hint ? <div className="text-[10.5px] font-medium text-accent">{hint}</div> : null}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[17px] font-semibold tabular tracking-[-0.02em]">{price}</span>
        <span className="text-[11px] text-muted">{per}</span>
      </div>
    </button>
  );
}

/** Diálogo de assinatura embutido (aberto via useProStore.openPaywall). Passo de planos
 *  rico (2 colunas: benefícios + confiança | planos); passo de pagamento embutido. */
export function UpgradeDialog() {
  const { t } = useTranslation();
  const open = useProStore((s) => s.paywallOpen);
  const close = useProStore((s) => s.closePaywall);
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

  const wide = step === "plan";

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

  const benefits = [
    { Icon: Users, title: t("pro.benefit1"), desc: t("pro.benefit1Desc") },
    { Icon: FileBarChart, title: t("pro.benefit2"), desc: t("pro.benefit2Desc") },
    { Icon: LineChart, title: t("pro.benefit3"), desc: t("pro.benefit3Desc") },
  ];
  const trust = [t("pro.trust1"), t("pro.trust2"), t("pro.trust3")];

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className={cn(
          "w-full rounded-[20px] border border-border bg-card shadow-[0_24px_70px_-20px_rgba(0,0,0,0.6)] transition-[max-width]",
          wide ? "max-w-2xl" : "max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
              <Sparkles size={18} />
            </span>
            <div>
              <div className="text-[16px] font-semibold tracking-[-0.01em]">{t("pro.upgradeTitle")}</div>
              <div className="text-[12.5px] text-muted">{t("pro.upgradeSub")}</div>
            </div>
          </div>
          <button onClick={close} aria-label={t("pro.close")} className="text-faint transition hover:text-text">
            <X size={18} />
          </button>
        </div>

        {step === "plan" ? (
          <div className="grid gap-6 p-6 pt-5 md:grid-cols-2">
            {/* Esquerda — o que vem no Pro + confiança */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{t("pro.benefitsTitle")}</div>
              <ul className="mt-3 space-y-3">
                {benefits.map((b) => (
                  <li key={b.title} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
                      <b.Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold leading-tight">{b.title}</div>
                      <div className="mt-0.5 text-[12px] leading-snug text-muted">{b.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-1.5 border-t border-border pt-4">
                {trust.map((x) => (
                  <div key={x} className="flex items-center gap-1.5 text-[11.5px] text-faint">
                    <Check size={13} className="shrink-0 text-accent" /> {x}
                  </div>
                ))}
              </div>
            </div>

            {/* Direita — planos + CTA */}
            <div className="flex flex-col rounded-[16px] border border-border bg-card2 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{t("pro.choosePlan")}</div>
              <div className="mt-3 space-y-2.5">
                <PlanRow active={plan === "monthly"} onClick={() => setPlan("monthly")} label={t("pro.monthly")} price="R$ 24,90" per={t("pro.perMonth")} />
                <PlanRow active={plan === "annual"} onClick={() => setPlan("annual")} label={t("pro.annual")} price="R$ 249" per={t("pro.perYear")} hint={t("pro.annualHint")} />
              </div>
              {err ? <p className="mt-2 text-[12.5px] text-neg">{err}</p> : null}
              <div className="mt-auto pt-4">
                <Button className="h-10 w-full" onClick={start} disabled={loading}>
                  {loading ? t("pro.processing") : t("pro.continue")}
                </Button>
                <p className="mt-2.5 text-center text-[11px] leading-relaxed text-faint">{t("pro.allFree")}</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === "pay" && data?.clientSecret ? (
          <div className="p-6 pt-5">
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
          <div className="p-6 pt-5 text-center">
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
