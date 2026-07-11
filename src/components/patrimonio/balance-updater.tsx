import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Wallet } from "lucide-react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { actions } from "@/data/actions";
import { convert, formatMoney } from "@/money/currency";
import { formatAmountEdit, parseLocaleNumber, maskAmountInput } from "@/money/parse";
import { nameById, REGION_FLAG } from "@/domain/taxonomy";
import { CurrencyBadge } from "@/components/common/currency-badge";
import { useIsMobile } from "@/hooks/use-media";
import { pushModal, popModal, isTopModal } from "@/lib/modal-stack";
import { Button } from "@/components/common/button";
import { useBalanceUpdater } from "@/store/balance-updater";
import { useEngagement } from "@/store/engagement";
import { cn } from "@/lib/utils";
import type { Asset } from "@/domain/types";

/** Mês corrente "AAAA-MM" — pra marcar a última atualização de saldos (nudge 1×/mês). */
const ym = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * "Atualizar saldos" — o ritual do modelo por TOTAIS: uma tela só com o valor de cada ativo
 * (por classe), editável de uma vez, com o patrimônio recalculando ao vivo. Drawer lateral no
 * desktop; bottom sheet no celular. Salva tudo numa tacada (só o que mudou).
 */
export function BalanceUpdater() {
  const { t } = useTranslation();
  const open = useBalanceUpdater((s) => s.open);
  const close = useBalanceUpdater((s) => s.closeDrawer);
  const setBalancesUpdated = useEngagement((s) => s.setBalancesUpdated);
  const data = usePatrimonio();
  const tax = useTaxonomy();
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const isMobile = useIsMobile();
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Inicializa os valores ao ABRIR (não a cada mudança do banco, pra não atropelar a digitação).
  useEffect(() => {
    if (open && data) setEdits(Object.fromEntries(data.assets.map((a) => [a.id, formatAmountEdit(a.amount, a.currency)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape + trava de scroll + pilha de modais (igual ao Dialog).
  useEffect(() => {
    if (!open) return;
    const id = pushModal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopModal(id)) close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      popModal(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const groups = useMemo(() => {
    if (!data || !tax) return [] as { id: string; name: string; assets: Asset[] }[];
    const map: Record<string, Asset[]> = {};
    for (const a of data.assets) (map[a.classId] ||= []).push(a);
    return tax.assetClasses.filter((c) => map[c.id]?.length).map((c) => ({ id: c.id, name: c.name, assets: map[c.id] }));
  }, [data, tax]);

  const netWorth = useMemo(() => {
    if (!data) return 0;
    const assets = data.assets.reduce((s, a) => s + convert(parseLocaleNumber(edits[a.id] ?? "", a.currency) ?? a.amount, a.currency, disp, rates), 0);
    const liab = data.liabilities.reduce((s, l) => s + convert(l.amount, l.currency, disp, rates), 0);
    return assets - liab;
  }, [data, edits, disp, rates]);

  if (!open || !data || !tax) return null;

  const saveAll = () => {
    for (const a of data.assets) {
      const v = edits[a.id];
      if (v == null) continue;
      const n = parseLocaleNumber(v, a.currency);
      if (n != null && n !== a.amount) void actions.putAsset({ ...a, amount: n });
    }
    setBalancesUpdated(ym());
    close();
  };

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[70] flex bg-black/50 backdrop-blur-sm", isMobile ? "items-end justify-center" : "items-stretch justify-end")}
      onClick={close}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className={cn(
          "flex flex-col bg-card shadow-card",
          isMobile ? "max-h-[86vh] w-full rounded-t-2xl border-t border-border" : "h-full w-full max-w-[440px] border-l border-border",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
              <Wallet size={18} />
            </span>
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.01em]">{t("balances.title")}</div>
              <div className="text-[12px] text-muted">{t("balances.sub")}</div>
            </div>
          </div>
          <button type="button" onClick={close} aria-label={t("common.close")} className="shrink-0 text-muted transition hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div className="scrollbar-subtle flex-1 overflow-y-auto p-4">
          {groups.length === 0 ? (
            <p className="px-1 py-10 text-center text-[13px] leading-relaxed text-faint">{t("balances.empty")}</p>
          ) : (
            groups.map((g) => (
              <div key={g.id} className="mb-4">
                <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{g.name}</div>
                <div className="space-y-1.5">
                  {g.assets.map((a) => {
                    const flag = a.regionId ? REGION_FLAG[a.regionId] ?? "" : "";
                    const label = a.name || nameById(tax.subtypes, a.subtypeId) || a.currency;
                    return (
                    <div key={a.id} className="flex items-center gap-2.5 rounded-[12px] border border-border bg-card2 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{flag ? `${flag} ` : ""}{label}</span>
                      <CurrencyBadge currency={a.currency} />
                      <input
                        inputMode="numeric"
                        value={edits[a.id] ?? ""}
                        onFocus={(e) => e.currentTarget.select()}
                        // Máscara "centavos": só dígitos; os 2 últimos são os centavos e a pontuação
                        // entra sozinha (igual ao MoneyCell da grade e ao MoneyField do IRPF).
                        onChange={(e) => {
                          const el = e.currentTarget;
                          const { display } = maskAmountInput(el.value, a.currency);
                          setEdits((p) => ({ ...p, [a.id]: display }));
                          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
                        }}
                        onBlur={() =>
                          setEdits((p) => ({ ...p, [a.id]: formatAmountEdit(parseLocaleNumber(p[a.id] ?? "", a.currency) ?? a.amount, a.currency) }))
                        }
                        className="w-[120px] rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-right text-[13px] tabular text-text outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      />
                    </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{t("balances.netWorth")}</span>
            <span className="tabular text-[19px] font-semibold tracking-[-0.03em] text-text">{formatMoney(netWorth, disp)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={close}>
              {t("common.close")}
            </Button>
            <Button className="flex-1" onClick={saveAll}>
              {t("balances.saveAll")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
