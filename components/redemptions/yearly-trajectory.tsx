import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { YearlyRedemptionMonth } from "@/services/yield-overview";

/**
 * Gráfico de barras empilhadas — saques mês-a-mês no ano corrente.
 * Cada barra = mês. Empilha "executado" (verde sólido) + "previsto" (verde
 * tracejado/transparente).
 *
 * Acima do gráfico: 3 totais (YTD executado, restante previsto, ano todo).
 * Abaixo: hint educativo se a renda mensal estimada supera o ritmo de saque.
 */
export function YearlyTrajectory({
  year,
  months,
  executedYTD,
  pendingRestOfYear,
  projectedFullYear,
  monthlyYieldEstimate,
}: {
  year: number;
  months: YearlyRedemptionMonth[];
  executedYTD: number;
  pendingRestOfYear: number;
  projectedFullYear: number;
  /** Renda mensal estimada do portfolio — pra comparar com o ritmo de saque */
  monthlyYieldEstimate: number;
}) {
  const max = Math.max(...months.map((m) => m.total), 1);
  const yearlyYieldEstimate = monthlyYieldEstimate * 12;
  const surplus = yearlyYieldEstimate - projectedFullYear;

  const nowMonth = new Date().getUTCMonth() + 1;

  return (
    <Panel className="!p-7">
      <PanelHeader
        title={`Trajetória de saques · ${year}`}
        meta="executado + previsto pelas regras ativas"
      />

      {/* Totais */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryStat label="Sacado YTD" value={executedYTD} tone="olive" />
        <SummaryStat label="Previsto até dez" value={pendingRestOfYear} tone="muted" />
        <SummaryStat label="Ano todo" value={projectedFullYear} tone="default" />
      </div>

      {/* Gráfico */}
      <div className="grid grid-cols-12 gap-1.5 mb-2">
        {months.map((m) => {
          const executedHeight = max > 0 ? (m.executed / max) * 100 : 0;
          const pendingHeight = max > 0 ? (m.pending / max) * 100 : 0;
          const isCurrentMonth = m.month === nowMonth;
          return (
            <div key={m.month} className="flex flex-col items-center gap-1.5">
              <div
                className="w-full h-[120px] flex flex-col-reverse rounded-[4px] overflow-hidden bg-bone-100 dark:bg-ink-800 relative group"
                title={`${m.label}: ${formatMoney(m.total)}`}
              >
                {executedHeight > 0 ? (
                  <div
                    className="bg-olive-600 transition-[height] duration-500"
                    style={{ height: `${executedHeight}%` }}
                  />
                ) : null}
                {pendingHeight > 0 ? (
                  <div
                    className="bg-olive-600/30 border-t border-dashed border-olive-600/50 transition-[height] duration-500"
                    style={{ height: `${pendingHeight}%` }}
                  />
                ) : null}
                {/* Tooltip on hover */}
                {m.total > 0 ? (
                  <div className="absolute inset-x-0 -top-7 hidden group-hover:flex justify-center pointer-events-none">
                    <div className="px-2 py-0.5 rounded-[4px] bg-ink-950 text-white text-[10.5px] font-mono whitespace-nowrap">
                      <MoneyMask>{formatMoney(m.total)}</MoneyMask>
                    </div>
                  </div>
                ) : null}
              </div>
              <span
                className={
                  "font-mono text-[10.5px] uppercase tracking-[0.04em] " +
                  (isCurrentMonth ? "text-foreground font-medium" : "text-faint-foreground")
                }
              >
                {m.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legenda + leitura */}
      <div className="flex flex-wrap items-center gap-4 text-[10.5px] font-mono text-faint-foreground tracking-[0.04em] mt-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-olive-600" />
          executado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-olive-600/30 border border-dashed border-olive-600/50" />
          previsto pelas regras
        </span>
      </div>

      {/* Verdict — comparação com a renda passiva potencial */}
      {monthlyYieldEstimate > 0 ? (
        <div className="mt-5 pt-5 border-t border-border">
          {surplus > 100 ? (
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-olive-700 dark:text-olive-500 font-medium mr-2">
                Sobra
              </span>
              Sua carteira rende ~<b className="text-foreground"><MoneyMask>{formatMoney(yearlyYieldEstimate)}</MoneyMask></b>/ano
              e você está sacando só <b className="text-foreground"><MoneyMask>{formatMoney(projectedFullYear)}</MoneyMask></b>{" "}
              — <b className="text-olive-700 dark:text-olive-500"><MoneyMask>{formatMoney(surplus)}</MoneyMask></b> está sendo reinvestido,
              fazendo seu patrimônio crescer.
            </p>
          ) : surplus < -100 ? (
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-rust-600 font-medium mr-2">
                Atenção
              </span>
              Você está sacando mais (<b className="text-foreground"><MoneyMask>{formatMoney(projectedFullYear)}</MoneyMask></b>/ano)
              do que rende (<b className="text-foreground"><MoneyMask>{formatMoney(yearlyYieldEstimate)}</MoneyMask></b>/ano).
              Diferença de <b className="text-rust-600"><MoneyMask>{formatMoney(Math.abs(surplus))}</MoneyMask></b> sai do principal.
            </p>
          ) : (
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-foreground font-medium mr-2">
                Equilibrado
              </span>
              Saques ≈ rendimento anual. Patrimônio se mantém estável.
            </p>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "olive" | "muted" | "default";
}) {
  const toneClass =
    tone === "olive"
      ? "text-olive-700 dark:text-olive-500"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      <div className={`font-mono text-[18px] tracking-[-0.01em] mt-1 tabular-nums ${toneClass}`}>
        <MoneyMask>{formatMoney(value)}</MoneyMask>
      </div>
    </div>
  );
}
