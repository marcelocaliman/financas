import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useUI } from "@/store/ui";
import { useDailyFx } from "@/hooks/use-daily-fx";
import { useFxHistory } from "@/store/fx-history";
import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";

/**
 * Variação do patrimônio pelo CÂMBIO desde o último fechamento — o motivo honesto de dar uma
 * olhada todo dia num app multimoeda (o câmbio mexe sozinho). Some quando não há exposição em
 * moeda estrangeira ou o movimento é desprezível. O valor (derivado das posições) respeita o
 * modo privado; o % da moeda é dado público de mercado.
 */
export function DailyFxLine() {
  const { t } = useTranslation();
  const disp = useUI((s) => s.displayCurrency);
  const fx = useDailyFx();
  const todayDate = useFxHistory((s) => s.todayDate);
  const prevDate = useFxHistory((s) => s.prevDate);

  if (!fx || !fx.hasForeign || Math.abs(fx.delta) < 0.5) return null;
  const up = fx.delta >= 0;
  const top = fx.drivers[0];

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
      title={prevDate && todayDate ? t("dashboard.fxSince", { from: prevDate, to: todayDate }) : undefined}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{t("dashboard.fxToday")}</span>
      <span className={cn("inline-flex items-center gap-1 font-semibold", up ? "text-accent" : "text-neg")}>
        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        <Money value={fx.delta} currency={disp} options={{ signDisplay: "always" }} />
      </span>
      {top ? (
        <span className="text-muted">
          · <span className="font-mono">{top.currency}</span> {top.pct >= 0 ? "↑" : "↓"} {Math.abs(top.pct).toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
