import Link from "next/link";
import { ChevronLeft, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { getFirePreferences } from "@/services/fire";
import { getCurrentUserContext } from "@/services/auth";
import { getCoverage } from "@/services/investments";
import { FirePreferencesForm } from "@/components/fire/fire-preferences-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesFirePage() {
  const [prefs, ctx, coverage] = await Promise.all([
    getFirePreferences(),
    getCurrentUserContext(),
    getCoverage(),
  ]);
  if (!prefs || !ctx) return null;

  const isAdmin = ctx.profile.role === "admin";
  const currentExpense = coverage.monthlyAverageExpense;

  return (
    <>
      <Link
        href="/independencia"
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar pra Independência
      </Link>

      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-gold-600" strokeWidth={1.8} />
            FIRE · seu plano de aposentadoria
          </span>
        }
        title={
          <>
            Ajustar meu <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">plano.</em>
          </>
        }
        subtitle="Quanto vc quer ter quando se aposentar, o que vc espera do mercado, e algumas infos pessoais. Não precisa preencher tudo — comece pelo que sabe."
      />

      {/* Explicação rápida em destaque */}
      <Panel className="mb-5 border-navy-700/30">
        <div className="text-[13px] leading-relaxed">
          <b className="text-foreground">Como funciona:</b>{" "}
          vc define <b>quanto quer ter de renda mensal</b> quando se aposentar, o app
          calcula quanto vc precisa acumular pra que essa renda venha sozinha dos
          juros do patrimônio (regra dos {prefs.swrPct}%) e mostra quanto tempo vc
          ainda precisa juntar no ritmo atual.
        </div>
      </Panel>

      <Panel>
        <FirePreferencesForm
          defaults={prefs}
          isAdmin={isAdmin}
          currentMonthlyExpense={currentExpense}
        />
      </Panel>
    </>
  );
}
