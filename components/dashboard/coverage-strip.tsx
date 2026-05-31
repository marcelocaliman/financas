import Link from "next/link";
import { Flame, ArrowRight } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Linha compacta de Independência Financeira (FIRE) — substitui os dois cards
 * grandes (FireCard + CoveragePanel) na home. FIRE é um "plus": fica discreto e
 * linka pra /independencia, onde mora a análise completa. Não grita 0% ocupando
 * meia tela quando a pessoa ainda não tem renda passiva.
 */
export function CoverageStrip({
  coveragePct, // 0-100
  monthlyYield, // renda passiva/mês em moeda de exibição
}: {
  coveragePct: number;
  monthlyYield: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(coveragePct)));
  return (
    <Panel className="!py-3.5 !px-5">
      <Link href="/independencia" className="flex items-center justify-between gap-4 group">
        <div className="flex items-center gap-2.5 min-w-0">
          <Flame className="w-4 h-4 text-gold-600 shrink-0" strokeWidth={1.7} />
          <span className="text-[13px] font-medium text-foreground shrink-0">
            Independência financeira
          </span>
          <span className="font-mono text-[12px] text-muted-foreground truncate">
            <span className={cn("font-medium", pct > 0 ? "text-olive-700 dark:text-olive-500" : "text-foreground")}>
              {pct}%
            </span>{" "}
            das despesas cobertas
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-[12px] text-faint-foreground hidden sm:inline">
            renda passiva <MoneyMask>{formatMoney(monthlyYield)}</MoneyMask>/mês
          </span>
          <ArrowRight
            className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300 group-hover:translate-x-0.5 transition-transform"
            strokeWidth={1.8}
          />
        </div>
      </Link>
    </Panel>
  );
}
