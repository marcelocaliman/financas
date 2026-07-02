import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { useDueBills } from "@/hooks/use-due-bills";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useRates } from "@/store/rates";
import { convert, type Currency } from "@/money/currency";
import { nameById } from "@/domain/taxonomy";
import type { BillStatus } from "@/domain/bills";
import { Money } from "@/components/common/money";
import { BILL_STATUS_TONE, daysLabel } from "@/components/common/bill-format";
import { cn } from "@/lib/utils";

const CAP = 5; // mostra até 5; o resto vira "+N mais"

interface Row {
  id: string;
  name: string;
  status: BillStatus;
  days: string; // "atrasada há 2d" / "vence hoje" / "em 3d"
  value: number; // já convertido p/ a moeda de exibição
}

/**
 * Conteúdo RICO do tooltip do item "Orçamento" (desktop): cabeçalho com total a pagar + lista
 * das contas vencidas/a vencer (mesma janela de 3d do badge, via useDueBills). Renderiza null se
 * não há nada — o gatilho cai no rótulo simples. Container: resolve dados; a View é pura.
 */
export function DueBillsTooltip() {
  const { t } = useTranslation();
  const { actionable, actionableTotal, overdueCount, count, disp } = useDueBills();
  const rates = useRates((s) => s.rates);
  const tax = useTaxonomy();
  if (count === 0) return null;

  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const rows: Row[] = actionable.slice(0, CAP).map((b) => ({
    id: b.id,
    name: b.name || nameById(tax.expenseCategories, b.categoryId) || t("orcamento.uncategorized"),
    status: b.status,
    days: daysLabel(t, b.status, b.daysUntil),
    value: conv(b.amount, b.currency),
  }));
  return <DueBillsTooltipView rows={rows} total={actionableTotal} count={count} overdueCount={overdueCount} extra={count - rows.length} currency={disp} />;
}

/** Parte visual pura — fácil de revisar/prever isolada (Money respeita o modo privacidade). */
export function DueBillsTooltipView({
  rows,
  total,
  count,
  overdueCount,
  extra,
  currency,
}: {
  rows: Row[];
  total: number;
  count: number;
  overdueCount: number;
  extra: number;
  currency: Currency;
}) {
  const { t } = useTranslation();
  return (
    <div className="w-full text-left">
      {/* Cabeçalho: eyebrow + contagem, e o total a pagar (vermelho se há vencida) */}
      <div className="px-3.5 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{t("orcamento.upcomingBills")}</span>
          <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-card2 text-muted text-[10px] font-bold tabular leading-none">{count}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-muted">{t("orcamento.duePayable")}</span>
          <Money value={total} currency={currency} options={{ signDisplay: "never" }} className={cn("text-[15px] font-semibold tabular", overdueCount > 0 ? "text-neg" : "text-text")} />
        </div>
      </div>
      <div className="border-t border-border" />

      {/* Linhas: ponto de status + nome + prazo + valor */}
      <div className="py-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 px-3.5 py-[5px]">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", r.status === "soon" ? "bg-muted" : "bg-neg")} />
            <span className="flex-1 min-w-0 truncate text-[12.5px] text-text">{r.name}</span>
            <span className={cn("shrink-0 text-[11px] tabular", BILL_STATUS_TONE[r.status])}>{r.days}</span>
            <Money value={r.value} currency={currency} className="shrink-0 text-[12.5px] font-medium tabular" />
          </div>
        ))}
      </div>

      {extra > 0 ? (
        <>
          <div className="border-t border-border" />
          <div className="px-3.5 py-2 flex items-center gap-1 text-[11px] text-faint">
            {t("orcamento.moreBills", { n: extra })}
            <ChevronRight size={12} />
          </div>
        </>
      ) : null}
    </div>
  );
}
