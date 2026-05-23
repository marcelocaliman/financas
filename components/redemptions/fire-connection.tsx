import Link from "next/link";
import { ArrowRight, Flame, Trophy } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

/**
 * Card pequeno que conecta /resgates com /dashboard (FIRE).
 * Mostra cobertura atual + tempo estimado pra independência financeira,
 * deixando óbvio que viver da renda é o jogo de longo prazo. Link
 * pra ver detalhes na home.
 */
export function FireConnection({
  monthlyPassiveIncome,
  monthlyExpense,
  netWorth,
  monthlySavings,
}: {
  monthlyPassiveIncome: number;
  monthlyExpense: number;
  netWorth: number;
  /** Sobra média mensal (renda - despesa) */
  monthlySavings: number;
}) {
  const coverage = monthlyExpense > 0 ? monthlyPassiveIncome / monthlyExpense : 0;
  const achieved = coverage >= 1;
  const yieldRate = netWorth > 0 ? monthlyPassiveIncome / netWorth : 0;
  const requiredNetWorth = yieldRate > 0 ? monthlyExpense / yieldRate : null;
  const gap = requiredNetWorth != null ? Math.max(0, requiredNetWorth - netWorth) : null;
  const monthsToFI =
    gap != null && monthlySavings > 0 ? Math.ceil(gap / monthlySavings) : null;

  return (
    <Link
      href="/dashboard"
      className="block rounded-[var(--radius-lg)] border border-border bg-surface px-6 py-5 hover:shadow-sm transition-shadow group"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {achieved ? (
            <Trophy className="w-5 h-5 text-olive-700 dark:text-olive-500 shrink-0" strokeWidth={1.7} />
          ) : (
            <Flame className="w-5 h-5 text-gold-600 shrink-0" strokeWidth={1.7} />
          )}
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Independência financeira
            </div>
            <div className="text-[14px] text-foreground mt-1 leading-snug">
              {achieved ? (
                <>
                  Você <em className="italic text-olive-700 dark:text-olive-500">já vive</em> da
                  renda — cobertura {formatPercent(coverage, 0)}.
                </>
              ) : monthsToFI != null ? (
                <>
                  Cobertura atual{" "}
                  <b className="text-foreground">{formatPercent(coverage, 0)}</b>. No ritmo
                  de aporte de{" "}
                  <b className="text-foreground">
                    <MoneyMask>{formatMoney(monthlySavings)}</MoneyMask>/mês
                  </b>
                  , chega a 100% em{" "}
                  <b className="text-navy-700">
                    {monthsToFI < 12
                      ? `${monthsToFI} ${monthsToFI === 1 ? "mês" : "meses"}`
                      : `${(monthsToFI / 12).toFixed(1).replace(".", ",")} anos`}
                  </b>
                  .
                </>
              ) : monthlySavings <= 0 ? (
                <>
                  Cobertura{" "}
                  <b className="text-foreground">{formatPercent(coverage, 0)}</b> — mas você não
                  tem sobra mensal pra construir. Aporte mensal &gt; 0 desbloqueia projeção.
                </>
              ) : (
                <>
                  Cobertura <b className="text-foreground">{formatPercent(coverage, 0)}</b>. Sem
                  ativos com rendimento — cadastre seus investimentos.
                </>
              )}
            </div>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-faint-foreground group-hover:text-navy-700 transition-colors shrink-0" strokeWidth={1.7} />
      </div>
    </Link>
  );
}
