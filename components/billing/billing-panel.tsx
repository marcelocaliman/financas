"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { createCheckoutSession, createPortalSession } from "@/services/billing.actions";
import type { PlanTier } from "@/lib/billing/plans";
import { cn } from "@/lib/utils/cn";

interface PlanCard {
  tier: PlanTier;
  name: string;
  priceMonthlyBRL: number | null;
  blurb: string;
  highlights: string[];
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativa", tone: "text-olive-700 dark:text-olive-500" },
  trialing: { label: "Em teste grátis", tone: "text-navy-700 dark:text-navy-300" },
  past_due: { label: "Pagamento pendente", tone: "text-gold-700 dark:text-gold-500" },
  suspended: { label: "Suspensa", tone: "text-rust-700 dark:text-rust-400" },
  cancelled: { label: "Cancelada", tone: "text-faint-foreground" },
};

export function BillingPanel({
  tier,
  status,
  trialEndsAt,
  isAdmin,
  plans,
}: {
  tier: string;
  status: string;
  trialEndsAt: string | null;
  isAdmin: boolean;
  plans: PlanCard[];
}) {
  const [pending, startTransition] = useTransition();
  const isPaid = tier === "pro" || tier === "family" || tier === "lifetime";
  const st = STATUS_LABEL[status] ?? STATUS_LABEL.active;

  function goCheckout(t: PlanTier) {
    if (!isAdmin) {
      toast.error("Só o administrador do household gerencia a assinatura.");
      return;
    }
    startTransition(async () => {
      const r = await createCheckoutSession(t);
      if (r.error || !r.url) {
        toast.error(r.error ?? "Falha ao iniciar checkout.");
        return;
      }
      window.location.href = r.url;
    });
  }
  function goPortal() {
    if (!isAdmin) {
      toast.error("Só o administrador do household gerencia a assinatura.");
      return;
    }
    startTransition(async () => {
      const r = await createPortalSession();
      if (r.error || !r.url) {
        toast.error(r.error ?? "Falha ao abrir o portal.");
        return;
      }
      window.location.href = r.url;
    });
  }

  return (
    <div className="space-y-4">
      {/* Estado atual */}
      <Panel>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint-foreground">
              Plano atual
            </div>
            <div className="mt-1 text-[18px] font-display text-foreground capitalize">
              {tier === "owner" ? "Completo" : tier}
              <span className={cn("ml-2 text-[12.5px] font-sans", st.tone)}>· {st.label}</span>
            </div>
            {status === "trialing" && trialEndsAt ? (
              <p className="text-[12px] text-muted-foreground mt-1">
                Teste grátis até {new Date(trialEndsAt).toLocaleDateString("pt-BR")}.
              </p>
            ) : null}
          </div>
          {isPaid ? (
            <button
              onClick={goPortal}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-border-strong px-3.5 py-2 text-[13px] hover:bg-surface-muted disabled:opacity-50"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" strokeWidth={1.8} />}
              Gerenciar assinatura
            </button>
          ) : null}
        </div>
        {status === "suspended" ? (
          <p className="mt-3 rounded-[8px] border border-rust-600/40 bg-rust-100/40 dark:bg-rust-700/10 px-3.5 py-2.5 text-[12.5px] text-rust-700 dark:text-rust-400">
            Assinatura suspensa por pagamento pendente. O app está em modo leitura —
            seus dados continuam acessíveis e exportáveis. Regularize pra voltar a editar.
          </p>
        ) : null}
      </Panel>

      {/* Planos */}
      <div className="grid md:grid-cols-3 gap-4 items-stretch">
        {plans.map((p) => {
          const isCurrent = p.tier === tier || (tier === "owner" && p.tier === "free");
          return (
            <Panel key={p.tier} className={cn("flex flex-col h-full", isCurrent && "border-navy-600/50")}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[18px] text-foreground">{p.name}</h3>
                {isCurrent ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-navy-700 dark:text-navy-300">
                    atual
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 text-[22px] font-display text-foreground">
                {p.priceMonthlyBRL == null ? (
                  "Grátis"
                ) : (
                  <>
                    R$ {p.priceMonthlyBRL}
                    <span className="text-[12.5px] text-muted-foreground font-sans">/mês</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{p.blurb}</p>
              <ul className="mt-3 space-y-1.5 flex-1">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[12.5px] text-foreground">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-olive-600 shrink-0" strokeWidth={2} />
                    {h}
                  </li>
                ))}
              </ul>
              {!isCurrent && p.priceMonthlyBRL != null ? (
                <button
                  onClick={() => goCheckout(p.tier)}
                  disabled={pending}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-navy-700 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-navy-800 disabled:opacity-50"
                >
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Assinar {p.name}
                </button>
              ) : null}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
