"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateSummary } from "@/app/(app)/viagens/[id]/_actions/generate-summary";
import type { TripNarrative } from "@/services/ai/trip-summary";

export function TripAiSummary({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TripNarrative | null>(null);

  const run = () => {
    startTransition(async () => {
      const r = await generateSummary(tripId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResult(r.result);
      toast.success("Resumo gerado.");
    });
  };

  return (
    <Panel className="mb-6 border-navy-700/30">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
            Resumo narrativo (IA)
          </span>
        }
        meta={result ? "gerado" : "viagem concluída"}
      />
      {!result ? (
        <div className="flex items-start gap-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">
            Gere uma carta editorial curta sobre a viagem — balanço financeiro,
            categoria dominante, surpresas, lembranças pra próxima vez.
          </p>
          <Button variant="primary" onClick={run} disabled={pending}>
            {pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
            ) : (
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
            )}
            {pending ? "Escrevendo…" : "Gerar resumo"}
          </Button>
        </div>
      ) : (
        <div>
          <h3 className="font-display text-[20px] tracking-[-0.015em] mb-1">
            {result.title}
          </h3>
          <p className="text-[14px] text-muted-foreground italic mb-4">
            {result.lead}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {result.highlights.map((h, i) => (
              <div
                key={i}
                className={`rounded-[8px] border p-3 ${
                  h.tone === "positive"
                    ? "border-olive-200 dark:border-olive-900/40 bg-olive-50/30 dark:bg-olive-950/10"
                    : h.tone === "negative"
                      ? "border-rust-200 dark:border-rust-900/40 bg-rust-50/30 dark:bg-rust-950/10"
                      : "border-border bg-surface-muted/20"
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-0.5">
                  {h.label}
                </div>
                <div className="text-[15px] font-mono tabular-nums font-medium">
                  {h.value}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3 text-[13.5px] leading-relaxed text-foreground">
            {result.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" onClick={run} disabled={pending} size="sm">
              <Sparkles className="w-3 h-3" strokeWidth={1.8} />
              Gerar de novo
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
