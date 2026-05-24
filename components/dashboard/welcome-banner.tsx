"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { skipOnboarding } from "@/services/onboarding.actions";

/**
 * Banner que convida o usuário a rodar o wizard de onboarding.
 * Aparece SÓ pra households com:
 *   - onboarding_completed_at IS NULL
 *   - 0 transações lifetime
 * Quando o usuário pula (X), marca onboarding_completed_at = now() — não
 * aparece de novo. Click "Começar" → /welcome.
 */
export function WelcomeBanner({ firstName }: { firstName?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSkip = () => {
    startTransition(async () => {
      const r = await skipOnboarding();
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  };

  const handleStart = () => {
    router.push("/welcome");
  };

  return (
    <Panel className="mb-6 !p-5 relative overflow-hidden border-navy-700/30">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48"
        style={{
          background:
            "radial-gradient(circle, rgba(176,123,50,0.14), transparent 70%)",
        }}
      />
      <div className="relative z-10 flex items-start gap-4">
        <div className="hidden sm:flex w-10 h-10 rounded-full bg-gold-600/15 items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-gold-700" strokeWidth={1.7} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gold-700 dark:text-gold-500 font-medium mb-1">
            Bem-vindo{firstName ? `, ${firstName}` : ""}
          </div>
          <div className="font-display text-[17px] tracking-[-0.01em] text-foreground leading-snug mb-1">
            Quer popular o app em 3 minutos?
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Contas, renda mensal e despesas fixas — você sai com o painel
            funcionando. Pula passos que não quiser preencher agora.
          </p>
          <div className="flex items-center gap-2 mt-3.5">
            <Button variant="primary" size="sm" onClick={handleStart}>
              Começar onboarding
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={pending}
            >
              {pending ? "Salvando…" : "Vou popular manualmente"}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          disabled={pending}
          className="text-faint-foreground hover:text-foreground transition-colors p-1 -m-1 shrink-0"
          aria-label="Fechar (não mostrar mais)"
          title="Não mostrar mais"
        >
          <X className="w-4 h-4" strokeWidth={1.8} />
        </button>
      </div>
    </Panel>
  );
}
