import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { useDueBills } from "@/hooks/use-due-bills";
import { useUI } from "@/store/ui";
import { goToSection } from "@/hooks/use-scroll-spy";
import { Money } from "@/components/common/money";
import type { Currency } from "@/money/currency";

/**
 * Barra de alerta de contas VENCIDAS (o caso que precisa gritar). Aparece só quando há vencida,
 * some quando não há e é dispensável — reaparece se o conjunto de vencidas mudar (nova vencida).
 * O "a vencer" (calmo) fica no badge do "Orçamento"; aqui é só o vermelho urgente.
 */
export function DueAlertBar() {
  const { overdue, overdueTotal, overdueCount, disp } = useDueBills();
  const setConfigOpen = useUI((s) => s.setConfigOpen);
  const [dismissedSig, setDismissedSig] = useState<string | null>(null);

  const sig = overdue.map((b) => b.id).join("|"); // assinatura do conjunto de vencidas
  if (overdueCount === 0 || dismissedSig === sig) return null;

  const go = () => {
    setConfigOpen(false); // se a Config estiver aberta, volta pro app antes de rolar
    goToSection("orcamento");
  };
  return (
    <DueAlertBarView
      count={overdueCount}
      total={overdueTotal}
      currency={disp}
      onGo={go}
      onDismiss={() => setDismissedSig(sig)}
    />
  );
}

/** Parte visual pura (sem stores) — fácil de revisar/prever isolada. */
export function DueAlertBarView({
  count,
  total,
  currency,
  onGo,
  onDismiss,
}: {
  count: number;
  total: number;
  currency: Currency;
  onGo: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-[color-mix(in_oklab,var(--neg)_38%,transparent)] bg-[var(--neg-soft)] px-3.5 py-3">
      <span className="grid place-items-center w-9 h-9 rounded-[10px] bg-card text-neg shrink-0">
        <AlertTriangle size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-text leading-tight">
          {t(count === 1 ? "orcamento.overdueBarOne" : "orcamento.overdueBarOther", { n: count })}
        </div>
        <Money value={total} currency={currency} options={{ signDisplay: "never" }} className="text-[12px] text-muted tabular" />
      </div>
      <button
        type="button"
        onClick={onGo}
        className="shrink-0 h-9 px-3.5 rounded-[10px] bg-neg text-[#2b0c09] text-[12.5px] font-semibold hover:opacity-90 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {t("orcamento.overdueBarCta")}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("orcamento.overdueBarDismiss")}
        className="shrink-0 grid place-items-center w-9 h-9 rounded-[10px] text-faint hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <X size={16} />
      </button>
    </div>
  );
}
