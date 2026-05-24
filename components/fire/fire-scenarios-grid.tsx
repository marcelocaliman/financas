"use client";

import { Clock, TrendingUp, TrendingDown, Sparkles, Coffee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { ScenarioResult } from "@/lib/financial/fire";

export function FireScenariosGrid({
  scenarios,
  currentAge,
}: {
  scenarios: ScenarioResult[];
  currentAge?: number;
}) {
  const current = scenarios.find((s) => s.variant === "current");
  const baselineYears = current?.yearsToFire ?? null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {scenarios.map((s) => (
        <ScenarioCard
          key={s.label}
          scenario={s}
          baselineYears={baselineYears}
          currentAge={currentAge}
        />
      ))}
    </div>
  );
}

function ScenarioCard({
  scenario: s,
  baselineYears,
  currentAge,
}: {
  scenario: ScenarioResult;
  baselineYears: number | null;
  currentAge?: number;
}) {
  const Icon =
    s.variant === "current"
      ? Clock
      : s.variant === "more_savings"
        ? TrendingUp
        : s.variant === "less_expense"
          ? TrendingDown
          : s.variant === "higher_return"
            ? Sparkles
            : Coffee;

  const delta =
    baselineYears != null && s.yearsToFire != null && s.variant !== "current"
      ? s.yearsToFire - baselineYears
      : null;

  return (
    <div className="rounded-[10px] border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
        <span className="text-[12.5px] font-medium text-foreground truncate">
          {s.label}
        </span>
      </div>
      <p className="text-[11px] text-faint-foreground leading-relaxed mb-3 min-h-[28px]">
        {s.description}
      </p>
      <div className="font-mono text-[19px] tracking-[-0.02em] tabular-nums text-foreground">
        {s.yearsToFire == null
          ? "—"
          : s.yearsToFire < 1
            ? `${Math.round((s.monthsToFire ?? 0))}m`
            : `${s.yearsToFire.toFixed(1).replace(".", ",")}a`}
      </div>
      {currentAge != null && s.ageAtFire != null ? (
        <div className="font-mono text-[10.5px] text-muted-foreground mt-0.5">
          aos {Math.round(s.ageAtFire)} anos
        </div>
      ) : null}
      {delta != null ? (
        <div className="mt-2">
          <Badge tone={delta < 0 ? "olive" : delta > 0 ? "rust" : "neutral"}>
            {delta < 0
              ? `${Math.abs(delta).toFixed(1).replace(".", ",")}a antes`
              : delta > 0
                ? `${delta.toFixed(1).replace(".", ",")}a depois`
                : "igual"}
          </Badge>
        </div>
      ) : null}
      <div className="font-mono text-[10px] text-faint-foreground tracking-[0.04em] mt-2">
        Target: <MoneyMask>{formatMoney(s.fireTargetNetWorth)}</MoneyMask>
      </div>
    </div>
  );
}
