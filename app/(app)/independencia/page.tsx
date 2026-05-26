import Link from "next/link";
import { Flame, Trophy, Settings, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { getFirePreferences } from "@/services/fire";
import { getCurrentUserContext } from "@/services/auth";
import { getAccountsTotals } from "@/services/accounts";
import { getCoverage, getPortfolioStats } from "@/services/investments";
import { getPhysicalAssetsTotals } from "@/services/physical-assets";
import { getMonthlyHistory } from "@/services/transactions";
import {
  computeAge,
  computeFire,
  projectTrajectory,
  simulateMonteCarlo,
  simulateScenarios,
} from "@/lib/financial/fire";
import { FireCoverageRing } from "@/components/fire/fire-coverage-ring";
import { FireScenariosGrid } from "@/components/fire/fire-scenarios-grid";
import { FireTrajectoryChart } from "@/components/fire/fire-trajectory-chart";
import { FireMonteCarloChart } from "@/components/fire/fire-monte-carlo-chart";
import { FireCalculator } from "@/components/fire/fire-calculator";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function IndependenciaPage() {
  const [ctx, prefs, accountsTotals, portfolio, physical, coverage, history6] =
    await Promise.all([
      getCurrentUserContext(),
      getFirePreferences(),
      getAccountsTotals(),
      getPortfolioStats(),
      getPhysicalAssetsTotals(),
      getCoverage(),
      getMonthlyHistory(6),
    ]);

  if (!ctx || !prefs) return null;

  // Patrimônio líquido
  const netWorth =
    accountsTotals.liquidExcludingInvestmentCash + portfolio.total + physical.total;

  // Empty state: usuário novo sem dados FIRE configurados
  const isFireUnconfigured =
    netWorth === 0 &&
    prefs.targetMonthlyIncome == null &&
    prefs.birthDate == null;

  if (isFireUnconfigured) {
    return (
      <>
        <PageHeader
          eyebrow="Independência financeira"
          title={
            <>
              Quando o trabalho{" "}
              <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
                vira opcional
              </em>
            </>
          }
          subtitle="FIRE = Financial Independence, Retire Early. Quanto patrimônio você precisa pra viver da renda dos investimentos sem depender de salário."
        />
        <EmptyState
          eyebrow="Configure o FIRE"
          title={
            <>
              Defina suas <em className="italic">metas</em>.
            </>
          }
          description="Pra calcular sua trajetória até a independência financeira, precisamos saber: quanto você quer ter de renda mensal nessa fase, idade alvo, e seus investimentos atuais. Comece configurando."
          cta={{ href: "/configuracoes/fire", label: "Configurar parâmetros FIRE" }}
        />
      </>
    );
  }

  // Sobra média mensal últimos 6 meses
  const positiveNets = history6.map((h) => Math.max(0, h.net));
  const monthlySavings =
    positiveNets.length > 0
      ? positiveNets.reduce((s, v) => s + v, 0) / positiveNets.length
      : 0;

  // Renda alvo: default = despesa atual
  const targetMonthlyIncome =
    prefs.targetMonthlyIncome != null && prefs.targetMonthlyIncome > 0
      ? prefs.targetMonthlyIncome
      : coverage.monthlyAverageExpense;

  const currentAge = prefs.birthDate ? computeAge(prefs.birthDate) : undefined;

  // Inputs base pro cálculo
  const baseInputs = {
    currentNetWorth: netWorth,
    monthlyAddition: monthlySavings,
    targetMonthlyIncome,
    realAnnualReturnPct: prefs.expectedReturnPct,
    swrPct: prefs.swrPct,
    inssMonthlyEstimate: prefs.inssMonthlyEstimate ?? 0,
    currentAge,
  };

  const fire = computeFire(baseInputs);

  // Cenários comparativos
  const scenarios = simulateScenarios(baseInputs, [
    { label: "Atual", variant: "current" },
    { label: "+ R$ 500/mês", variant: "more_savings", monthlyAdditionDelta: 500 },
    { label: "-10% despesa", variant: "less_expense", targetMonthlyIncomeMultiplier: 0.9 },
    { label: "+1pp retorno", variant: "higher_return", realAnnualReturnDelta: 1 },
    { label: "Coast FIRE", variant: "coast", zeroOutAddition: true },
  ]);

  // Trajetória do patrimônio (curva única até FIRE)
  const trajectory = projectTrajectory({
    currentNetWorth: netWorth,
    monthlyAddition: monthlySavings,
    realAnnualReturnPct: prefs.expectedReturnPct,
    targetMonthlyIncome,
    swrPct: prefs.swrPct,
    inssMonthlyEstimate: prefs.inssMonthlyEstimate ?? 0,
    currentAge,
    maxMonths: 480,
  });

  // Monte Carlo — cone p10/p50/p90 (volatilidade 12% a.a. default)
  const monteCarlo = simulateMonteCarlo({
    currentNetWorth: netWorth,
    monthlyAddition: monthlySavings,
    realAnnualReturnPct: prefs.expectedReturnPct,
    monthsHorizon: Math.min(360, fire.monthsToFire ? Math.ceil(fire.monthsToFire * 1.3) : 360),
    trials: 500,
    volatilityAnnualPct: 12,
  });

  const classificationLabel: Record<typeof fire.classification, string> = {
    achieved: "Atingiu o target",
    fat: "Fat FIRE",
    regular: "FIRE regular",
    lean: "Lean FIRE (próximo)",
    coast: "Coast FIRE",
    barista: "Barista FIRE",
    building: "Construindo",
  };
  const classificationTone: Record<typeof fire.classification, "olive" | "gold" | "navy" | "neutral"> = {
    achieved: "olive",
    fat: "olive",
    regular: "olive",
    lean: "gold",
    coast: "navy",
    barista: "navy",
    building: "neutral",
  };

  return (
    <>
      <PageHeader
        eyebrow="FIRE · viver dos juros"
        title={
          <>
            Independência <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">financeira</em>
          </>
        }
        subtitle="Quando o trabalho vira opção. Quanto vc precisa, quanto falta, em quanto tempo chega — com juros compostos reais e cenários alternativos."
        actions={
          <Link
            href="/configuracoes/fire"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100"
          >
            <Settings className="w-3.5 h-3.5" strokeWidth={1.7} />
            Ajustar meu plano
          </Link>
        }
      />

      {/* HERO — Cobertura atual + classificação + status */}
      <Panel className="!p-7 mb-6 relative overflow-hidden border-navy-700/30">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 w-72 h-72"
          style={{
            background:
              fire.classification === "achieved" || fire.classification === "fat"
                ? "radial-gradient(circle, rgba(59,231,114,0.16), transparent 70%)"
                : "radial-gradient(circle, rgba(176,123,50,0.12), transparent 70%)",
          }}
        />
        <div className="relative z-10 grid lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {fire.classification === "achieved" || fire.classification === "fat" ? (
                <Trophy className="w-4 h-4 text-olive-600" strokeWidth={1.8} />
              ) : (
                <Flame className="w-4 h-4 text-gold-600" strokeWidth={1.8} />
              )}
              <Badge tone={classificationTone[fire.classification]}>
                {classificationLabel[fire.classification]}
              </Badge>
              {fire.ageAtFire != null ? (
                <Badge tone="navy">
                  Chega aos {Math.round(fire.ageAtFire)} anos
                </Badge>
              ) : null}
              {prefs.targetRetirementAge && fire.ageAtFire != null ? (
                <Badge
                  tone={
                    fire.ageAtFire <= prefs.targetRetirementAge ? "olive" : "rust"
                  }
                >
                  {fire.ageAtFire <= prefs.targetRetirementAge
                    ? `${Math.round(prefs.targetRetirementAge - fire.ageAtFire)} anos de folga`
                    : `${Math.round(fire.ageAtFire - prefs.targetRetirementAge)} anos atrasado`}
                </Badge>
              ) : null}
            </div>
            <h2 className="font-display text-[32px] tracking-[-0.025em] text-foreground leading-tight">
              {fire.classification === "achieved" ? (
                <>
                  Vc <em className="italic text-olive-700 dark:text-olive-500">já vive</em> dos juros
                </>
              ) : fire.monthsToFire != null ? (
                <>
                  <span className="text-navy-700 dark:text-navy-300">
                    {fire.yearsToFire! < 1
                      ? `${Math.round(fire.monthsToFire)} ${Math.round(fire.monthsToFire) === 1 ? "mês" : "meses"}`
                      : `${fire.yearsToFire?.toFixed(1).replace(".", ",")} anos`}
                  </span>{" "}
                  pra independência
                </>
              ) : (
                <>Sem trajetória — ajuste a sobra mensal</>
              )}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-2">
              Renda alvo:{" "}
              <b className="text-foreground">
                <MoneyMask>{formatMoney(targetMonthlyIncome)}</MoneyMask>/mês
              </b>
              {prefs.inssMonthlyEstimate ? (
                <>
                  {" "}· INSS cobre{" "}
                  <b className="text-olive-700 dark:text-olive-500">
                    <MoneyMask>{formatMoney(prefs.inssMonthlyEstimate)}</MoneyMask>
                  </b>
                  , carteira precisa cobrir{" "}
                  <b className="text-foreground">
                    <MoneyMask>{formatMoney(fire.netTargetMonthlyIncome)}</MoneyMask>
                  </b>
                </>
              ) : null}
            </p>
          </div>
          <FireCoverageRing
            coverageRatio={fire.coverageRatio}
            classification={fire.classification}
          />
        </div>
      </Panel>

      {/* STATS — números frios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCell
          label="Patrimônio atual"
          value={netWorth}
          tone="neutral"
        />
        <StatCell
          label={`Target (${prefs.swrPct}% SWR)`}
          value={fire.fireTargetNetWorth}
          tone="navy"
          hint={`${(prefs.swrPct === 4 ? 25 : prefs.swrPct === 3 ? 33.3 : 1 / (prefs.swrPct / 100)).toFixed(1).replace(".", ",")}× anual`}
        />
        <StatCell
          label="Falta no patrimônio"
          value={fire.gap}
          tone={fire.gap === 0 ? "positive" : "negative"}
          hint={fire.gap === 0 ? "atingido" : undefined}
        />
        <StatCell
          label="Renda passiva atual"
          value={fire.currentPassiveMonthlyIncome}
          tone="positive"
          hint="se sacasse hoje (SWR)"
        />
      </div>

      {/* GRÁFICO TRAJETÓRIA */}
      <Panel className="mb-6">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Trajetória até FIRE
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4">
          Patrimônio crescendo no ritmo atual ({formatMoney(monthlySavings)}/mês de aporte, retorno real {prefs.expectedReturnPct}% a.a.).
          Linha pontilhada = target.
        </p>
        <FireTrajectoryChart
          points={trajectory}
          targetNetWorth={fire.fireTargetNetWorth}
          currentAge={currentAge}
        />
      </Panel>

      {/* CONE MONTE CARLO */}
      <Panel className="mb-6">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Cone de cenários · 500 simulações
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
          Mercados são voláteis. Esta projeção simula 500 trajetórias possíveis assumindo
          retorno real médio {prefs.expectedReturnPct}% a.a. com volatilidade típica de 12% a.a.
          Mostra o intervalo de 80% (10º–90º percentil) ao longo do tempo.
        </p>
        <FireMonteCarloChart points={monteCarlo} targetNetWorth={fire.fireTargetNetWorth} />
      </Panel>

      {/* CALCULATOR INTERATIVO */}
      <Panel className="mb-6">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Brincar com os números
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4">
          Mexa nos sliders e veja em tempo real o impacto no tempo até FIRE.
        </p>
        <FireCalculator base={baseInputs} />
      </Panel>

      {/* CENÁRIOS COMPARATIVOS */}
      <Panel className="mb-6">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Cenários comparativos
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4">
          O que muda em cada decisão.
        </p>
        <FireScenariosGrid scenarios={scenarios} currentAge={currentAge} />
      </Panel>

      {/* CONCEITOS — educacional */}
      <Panel className="border-navy-700/30">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />
          <div className="text-[13px] leading-relaxed space-y-2">
            <div>
              <b>4% Rule (Trinity Study):</b> sacar 4% do patrimônio por ano teve 90% de
              sucesso em janelas de 30 anos no mercado americano. Pra prazos maiores ou
              perfil mais conservador, considere 3.5% ou 3%.
            </div>
            <div>
              <b>FIRE = patrimônio × SWR ≥ despesa anual:</b> com SWR de {prefs.swrPct}%,
              vc precisa de {(prefs.swrPct === 4 ? 25 : 1 / (prefs.swrPct / 100)).toFixed(1).replace(".", ",")}×
              a renda anual alvo ({formatMoney(targetMonthlyIncome * 12)}).
            </div>
            <div>
              <b>Coast FIRE:</b> se vc já tem patrimônio que crescerá sozinho até o
              target (sem precisar mais aportar), vc atingiu Coast FIRE — pode trabalhar
              menos, viajar, etc.
            </div>
            <div>
              <b>Inflação:</b> os cálculos usam retorno REAL (já descontada inflação de{" "}
              {prefs.inflationPct}% a.a.). Patrimônio e renda alvo são em valor REAL hoje —
              ignore corrigir mentalmente.
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}

function StatCell({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "neutral" | "navy" | "positive" | "negative";
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-olive-700 dark:text-olive-500"
      : tone === "negative"
        ? "text-rust-600"
        : tone === "navy"
          ? "text-navy-700 dark:text-navy-300"
          : "text-foreground";
  return (
    <div className="rounded-[var(--radius)] bg-surface border border-border px-5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <Money
        value={value}
        showComparison
        className={`text-[18px] tracking-[-0.02em] mt-1.5 items-start ${toneClass}`}
        secondaryClassName="text-[10.5px]"
      />
      {hint ? (
        <div className="font-mono text-[10px] text-muted-foreground tracking-[0.04em] mt-1">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
