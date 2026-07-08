import { useTranslation } from "react-i18next";
import { X, CalendarClock } from "lucide-react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxReturns } from "@/hooks/use-irpf";
import { useIsPro } from "@/hooks/use-pro";
import { useEngagement } from "@/store/engagement";
import { useUI } from "@/store/ui";
import { yearCloseWindow } from "@/irpf/codes";

/**
 * Lembrete no Painel (só Pro), na janela dez–mar, pra CONGELAR a posição de 31/12 pro IRPF — a
 * "automação possível" no local-first/E2EE: o app te cutuca ao abrir (nenhum servidor pode fazer por
 * você sem ver o dado). Some ao fechar o ano ou ao dispensar (volta na próxima janela).
 */
export function IrpfCloseNudge() {
  const { t } = useTranslation();
  const { isPro } = useIsPro();
  const data = usePatrimonio();
  const returns = useTaxReturns();
  const setIrpfOpen = useUI((s) => s.setIrpfOpen);
  const dismissed = useEngagement((s) => s.dismissedIrpfClose);
  const dismiss = useEngagement((s) => s.dismissIrpfClose);

  const year = yearCloseWindow();
  if (!isPro || year == null || dismissed === year) return null;
  if (!data || data.assets.length === 0) return null;
  if ((returns ?? []).find((r) => r.baseYear === year)?.closedAt) return null;

  return (
    <div className="relative mb-7">
      <button
        type="button"
        onClick={() => setIrpfOpen(true)}
        className="relative flex w-full items-center gap-3.5 overflow-hidden rounded-[16px] border border-border bg-gradient-to-br from-[var(--card-2)] to-card p-4 pr-11 text-left transition-colors hover:border-border-strong sm:p-5 sm:pr-12"
      >
        <span aria-hidden className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <CalendarClock size={19} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[14px] font-semibold tracking-[-0.01em]">{t("irpf.closeNudgeTitle")}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{t("irpf.closeNudgeSub", { year })}</span>
        </span>
        <span className="relative hidden h-9 shrink-0 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[12.5px] font-medium text-[#08130C] sm:inline-flex">
          {t("irpf.closeYear")}
        </span>
      </button>
      <button
        type="button"
        onClick={() => dismiss(year)}
        aria-label={t("common.close")}
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-[8px] text-faint transition-colors hover:bg-card-hover hover:text-text"
      >
        <X size={15} />
      </button>
    </div>
  );
}
