"use client";

import { useState, useTransition } from "react";
import { Sparkles, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { recordGoalContribution } from "@/services/goals.actions";
import { formatMoney, formatDateShort } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { AportSuggestion } from "@/services/goal-suggestions";

/**
 * Banner que aparece no /dashboard quando o app detecta transferências
 * recentes que parecem ser aportes em metas (heurística:
 * destination = linked_account / source da meta + amount compatível).
 *
 * UX intencionalmente leve: 1 click pra confirmar, 1 click pra dispensar.
 * Confirmar cria a goal_contribution vinculada à transactionId — sem dupla
 * contagem nem fluxos longos.
 */
export function ApportSuggestionCard({
  suggestions: initial,
}: {
  suggestions: AportSuggestion[];
}) {
  const [suggestions, setSuggestions] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (suggestions.length === 0) return null;

  const accept = (s: AportSuggestion) => {
    setPendingId(s.transactionId);
    startTransition(async () => {
      const r = await recordGoalContribution(s.goalId, s.transactionAmount, {
        date: s.transactionDate,
        source: "transfer_link",
        transactionId: s.transactionId,
        notes: `Vinculado da transferência "${s.transactionDescription}"`,
        bumpCurrent: true,
      });
      setPendingId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Aporte registrado em "${s.goalName}".`);
      setSuggestions((prev) =>
        prev.filter((x) => !(x.transactionId === s.transactionId && x.goalId === s.goalId)),
      );
    });
  };

  const dismiss = (s: AportSuggestion) => {
    setSuggestions((prev) =>
      prev.filter((x) => !(x.transactionId === s.transactionId && x.goalId === s.goalId)),
    );
  };

  return (
    <Panel className="!p-5 mb-6 border-navy-700/30 bg-navy-50/50 dark:bg-navy-700/5">
      <div className="flex items-baseline gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
        <h3 className="font-display text-[15px] font-medium tracking-[-0.01em] text-foreground">
          Possíveis aportes detectados
        </h3>
        <span className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em]">
          ·{" "}
          {suggestions.length} transferênci{suggestions.length === 1 ? "a recente" : "as recentes"}
        </span>
      </div>

      <ul className="space-y-2.5">
        {suggestions.map((s) => (
          <li
            key={`${s.transactionId}-${s.goalId}`}
            className="rounded-[8px] bg-surface border border-border px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-foreground leading-snug">
                Transferência de{" "}
                <b className="text-navy-700 dark:text-navy-300 tabular-nums">
                  <MoneyMask>{formatMoney(s.transactionAmount, s.transactionCurrency)}</MoneyMask>
                </b>{" "}
                pra <b>{s.destAccountName}</b> dia{" "}
                <span className="font-mono">{formatDateShort(s.transactionDate)}</span> — registrar
                como aporte em <b>{s.goalName}</b>?
              </div>
              <div className="font-mono text-[10.5px] text-faint-foreground mt-1 tracking-[0.04em]">
                {s.reason} · confiança {Math.round(s.confidence * 100)}%
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="primary"
                disabled={pendingId === s.transactionId}
                onClick={() => accept(s)}
              >
                <Check className="w-3 h-3" strokeWidth={2} />
                {pendingId === s.transactionId ? "Registrando…" : "Sim, é aporte"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => dismiss(s)}
                aria-label="Dispensar sugestão"
                className="text-faint-foreground"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.7} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
