import * as React from "react";
import { Money } from "@/components/ui/money";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils/cn";

/**
 * KpiCard — bloco padronizado de número-destaque usado em todas as páginas.
 *
 * Substitui os ~6 padrões anteriores (Mini, Stat, Summary, DeltaCard, etc).
 * Suporta valor monetário (via Money, com comparison multi-moeda), valor
 * texto puro (`textValue`), Δ vs período anterior, hint, e sparkline.
 */
export function KpiCard({
  label,
  value,
  textValue,
  tone = "neutral",
  hint,
  /** Δ absoluto numérico — exibe como "+R$ X" ou "−R$ X" */
  deltaAbs,
  /** Δ percentual (0.12 = +12%) */
  deltaPct,
  /** Quando true, Δ positivo é vermelho (ex: despesa subindo é ruim) */
  invertDeltaColor = false,
  sparkline,
  sparklineTone = "navy",
  className,
}: {
  label: string;
  value?: number;
  textValue?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "muted";
  hint?: React.ReactNode;
  deltaAbs?: number | null;
  deltaPct?: number | null;
  invertDeltaColor?: boolean;
  sparkline?: number[];
  sparklineTone?: "navy" | "olive" | "gold" | "rust" | "ink";
  className?: string;
}) {
  const valueClass =
    tone === "positive"
      ? "text-olive-700 dark:text-olive-500"
      : tone === "negative"
        ? "text-rust-600"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";

  // Determina cor do delta. Positivo = "subiu". Default: subir é bom (verde).
  const hasDelta = deltaAbs != null || deltaPct != null;
  const deltaSign =
    deltaAbs != null ? Math.sign(deltaAbs) : deltaPct != null ? Math.sign(deltaPct) : 0;
  const goodWhenUp = !invertDeltaColor;
  const deltaTone =
    deltaSign === 0
      ? "text-muted-foreground"
      : (deltaSign > 0) === goodWhenUp
        ? "text-olive-700 dark:text-olive-500"
        : "text-rust-600";

  const sparkColor =
    sparklineTone === "olive"
      ? "rgba(59,231,114,0.65)"
      : sparklineTone === "gold"
        ? "rgba(176,123,50,0.7)"
        : sparklineTone === "rust"
          ? "rgba(178,90,73,0.7)"
          : sparklineTone === "ink"
            ? "rgba(34,34,38,0.55)"
            : "rgba(96,126,168,0.7)";

  return (
    <div
      className={cn(
        "rounded-[var(--radius)] bg-surface border border-border px-5 py-4 relative overflow-hidden",
        className,
      )}
    >
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        {label}
      </div>
      {textValue !== undefined ? (
        <div
          className={cn(
            "mt-1.5 font-mono text-[20px] tracking-[-0.02em] tabular-nums",
            valueClass,
          )}
        >
          {textValue}
        </div>
      ) : (
        <Money
          value={value ?? 0}
          showComparison
          className={cn(
            "mt-1.5 text-[20px] tracking-[-0.02em] items-start",
            valueClass,
          )}
          secondaryClassName="text-[11px]"
        />
      )}

      {hasDelta ? (
        <div className={cn("mt-1.5 font-mono text-[11px] tabular-nums", deltaTone)}>
          {deltaAbs != null ? (
            <>
              {deltaAbs >= 0 ? "+" : ""}
              <Money
                value={Math.abs(deltaAbs)}
                className="inline-flex !flex-row !items-baseline text-[11px]"
              />
            </>
          ) : null}
          {deltaPct != null ? (
            <>
              {deltaAbs != null ? " · " : ""}
              {deltaPct >= 0 ? "+" : ""}
              {(deltaPct * 100).toFixed(deltaPct >= 0.1 || deltaPct <= -0.1 ? 0 : 1).replace(".", ",")}%
            </>
          ) : null}
          <span className="text-faint-foreground"> vs mês anterior</span>
        </div>
      ) : null}

      {hint && !hasDelta ? (
        <div className="mt-1 font-mono text-[10.5px] text-muted-foreground tracking-[0.04em]">
          {hint}
        </div>
      ) : null}

      {sparkline && sparkline.length >= 2 ? (
        <div className="mt-2 -mb-1">
          <Sparkline
            data={sparkline}
            width={140}
            height={22}
            stroke={sparkColor}
            fill={sparkColor}
            strokeWidth={1.4}
            showDot
            className="w-full"
          />
        </div>
      ) : null}
    </div>
  );
}
