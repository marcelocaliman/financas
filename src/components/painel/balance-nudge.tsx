import { useTranslation } from "react-i18next";
import { X, Wallet } from "lucide-react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useEngagement } from "@/store/engagement";
import { useBalanceUpdater } from "@/store/balance-updater";
import { currentMonth } from "@/finance/months";

/**
 * Nudge mensal: no modelo por TOTAIS os saldos são manuais, então 1× por mês o Painel lembra o
 * usuário de atualizá-los (só se ele tem ativos e ainda não mexeu neste mês). O card inteiro abre
 * o drawer; o X adia pro próximo mês. "Atualizado" é marcado ao salvar no drawer (mesma chave).
 */
export function BalanceNudge() {
  const { t } = useTranslation();
  const data = usePatrimonio();
  const lastMonth = useEngagement((s) => s.lastBalanceMonth);
  const snooze = useEngagement((s) => s.setBalancesUpdated);
  const openDrawer = useBalanceUpdater((s) => s.openDrawer);

  const cur = currentMonth();
  if (!data || data.assets.length === 0 || lastMonth === cur) return null;

  return (
    <div className="relative mb-7">
      <button
        type="button"
        onClick={openDrawer}
        className="relative flex w-full items-center gap-3.5 overflow-hidden rounded-[16px] border border-border bg-gradient-to-br from-[var(--card-2)] to-card p-4 pr-11 text-left transition-colors hover:border-border-strong sm:p-5 sm:pr-12"
      >
        <span aria-hidden className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Wallet size={19} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[14px] font-semibold tracking-[-0.01em]">{t("balances.nudgeTitle")}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{t("balances.nudgeSub")}</span>
        </span>
        <span className="relative hidden h-9 shrink-0 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[12.5px] font-medium text-[#08130C] sm:inline-flex">
          {t("balances.cta")}
        </span>
      </button>
      <button
        type="button"
        onClick={() => snooze(cur)}
        aria-label={t("common.close")}
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-[8px] text-faint transition-colors hover:bg-card-hover hover:text-text"
      >
        <X size={15} />
      </button>
    </div>
  );
}
