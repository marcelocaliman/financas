"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/utils/format";
import {
  runDetectSubscriptions,
  confirmDetectedSubscriptions,
} from "@/app/(app)/assinaturas/_actions/detect-subscriptions";
import type {
  DetectedSubscription,
  DetectionResult,
} from "@/services/ai/subscription-detector";

type AccountLite = { id: string; name: string; type?: string };

/**
 * Botão "Detectar com IA" + sheet com sugestões pra usuário confirmar.
 * Filtra automáticamente assinaturas que já estão cadastradas (RLS + tag).
 */
export function AiDetectorPanel({ accounts }: { accounts: AccountLite[] }) {
  const [isRunning, startRun] = useTransition();
  const [isConfirming, startConfirm] = useTransition();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [accountId, setAccountId] = useState<string>(
    accounts.find((a) => a.type === "credit_card")?.id ?? accounts[0]?.id ?? "",
  );

  function run() {
    startRun(async () => {
      const res = await runDetectSubscriptions();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.result.subscriptions.length === 0) {
        toast.success("IA não encontrou novas assinaturas. Tudo já parece mapeado.");
        return;
      }
      setResult(res.result);
      // Pré-seleciona as de high confidence
      const preSelected = new Set<number>();
      res.result.subscriptions.forEach((s, i) => {
        if (s.confidence === "high") preSelected.add(i);
      });
      setSelected(preSelected);
      setOpen(true);
    });
  }

  function toggle(idx: number) {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  }

  function confirm() {
    if (!result) return;
    const chosen: DetectedSubscription[] = [...selected]
      .sort((a, b) => a - b)
      .map((i) => result.subscriptions[i]!)
      .filter(Boolean);

    if (chosen.length === 0) {
      toast.error("Selecione ao menos uma assinatura.");
      return;
    }

    startConfirm(async () => {
      const res = await confirmDetectedSubscriptions(chosen, accountId || null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const msg =
        res.created > 0
          ? `${res.created} assinatura${res.created === 1 ? "" : "s"} criada${res.created === 1 ? "" : "s"}`
          : "Nenhuma assinatura nova criada";
      const skipMsg = res.skipped > 0 ? ` · ${res.skipped} duplicada${res.skipped === 1 ? "" : "s"} ignorada${res.skipped === 1 ? "" : "s"}` : "";
      toast.success(msg + skipMsg);
      setOpen(false);
      setResult(null);
      setSelected(new Set());
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={run} disabled={isRunning}>
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
        ) : (
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
        )}
        {isRunning ? "Analisando…" : "Detectar com IA"}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:!w-[min(680px,100vw)]">
          <SheetHeader
            eyebrow="Detector de assinaturas"
            title="Possíveis assinaturas não mapeadas"
            description={result?.summary}
          />

          {result ? (
            <>
              <div className="mt-6">
                <label className="block font-mono text-[10.5px] tracking-[0.14em] uppercase text-faint-foreground font-medium mb-1.5">
                  Conta padrão pras novas assinaturas
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-md text-[13px]"
                >
                  <option value="">— sem conta —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="mt-5 space-y-2">
                {result.subscriptions.map((sub, i) => {
                  const isSel = selected.has(i);
                  const confTone =
                    sub.confidence === "high"
                      ? "olive"
                      : sub.confidence === "medium"
                        ? "gold"
                        : "neutral";
                  return (
                    <li
                      key={i}
                      className={`border rounded-lg p-3.5 cursor-pointer transition-colors ${
                        isSel
                          ? "border-navy-400 bg-navy-50/40 dark:bg-navy-900/20"
                          : "border-border hover:bg-surface-muted/40"
                      }`}
                      onClick={() => toggle(i)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[14px]">{sub.merchant_name}</span>
                            <Badge tone={confTone}>
                              {sub.confidence === "high"
                                ? "alta confiança"
                                : sub.confidence === "medium"
                                  ? "média"
                                  : "baixa"}
                            </Badge>
                            {sub.suggested_category ? (
                              <Badge tone="navy">{sub.suggested_category}</Badge>
                            ) : null}
                          </div>
                          <div className="font-mono text-[11px] text-faint-foreground tracking-[0.04em] mt-1">
                            {formatMoney(sub.amount_average)} · {freqLabelPt(sub.frequency)}
                            {sub.day_of_month ? ` · dia ${sub.day_of_month}` : ""} ·{" "}
                            {sub.occurrences_count}× nos últimos 6 meses
                          </div>
                          <div className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
                            {sub.reasoning}
                          </div>
                          <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-1.5 truncate">
                            Como aparece: {sub.description_pattern}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-border">
                <div className="font-mono text-[11px] text-faint-foreground tracking-[0.04em]">
                  {selected.size} selecionada{selected.size === 1 ? "" : "s"} de{" "}
                  {result.subscriptions.length}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    <X className="w-3.5 h-3.5" strokeWidth={1.8} /> Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={confirm}
                    disabled={isConfirming || selected.size === 0}
                  >
                    {isConfirming ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
                    )}
                    Cadastrar selecionadas
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function freqLabelPt(f: DetectedSubscription["frequency"]): string {
  switch (f) {
    case "monthly":
      return "mensal";
    case "weekly":
      return "semanal";
    case "quarterly":
      return "trimestral";
    case "yearly":
      return "anual";
    default:
      return "irregular";
  }
}
