"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { importDeductibles } from "@/services/ir/actions";
import type { DeductibleCandidate } from "@/services/ir/auto-deductibles";

const KIND_LABELS: Record<string, string> = {
  plano_saude: "Plano de saúde",
  hospital: "Hospital/exames",
  medico: "Médico",
  dentista: "Dentista",
  psicologo: "Psicólogo",
  outros_saude: "Outros saúde",
  educacao_titular: "Educação",
  educacao_dependente: "Educação dependente",
  inss_titular: "INSS",
  pgbl: "PGBL",
  previdencia_privada: "Previdência",
  pensao_alimenticia: "Pensão",
  outros: "Outros",
};

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function AutoDeductiblesImport({
  year,
  candidates,
}: {
  year: number;
  candidates: DeductibleCandidate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Pre-seleciona candidatos high confidence não-importados
    const s = new Set<string>();
    for (const c of candidates) {
      if (!c.alreadyImported && c.confidence === "high") s.add(c.transactionId);
    }
    return s;
  });

  const newCandidates = candidates.filter((c) => !c.alreadyImported);
  const totalNew = newCandidates.length;
  const selectedAmount = newCandidates
    .filter((c) => selected.has(c.transactionId))
    .reduce((s, c) => s + c.amount, 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(newCandidates.map((c) => c.transactionId)));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const handleImport = () => {
    if (selected.size === 0) {
      toast.info("Selecione ao menos uma transação.");
      return;
    }
    startTransition(async () => {
      const r = await importDeductibles({
        year,
        transactionIds: Array.from(selected),
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          `${r.created} pagamento${(r.created ?? 0) === 1 ? "" : "s"} importado${(r.created ?? 0) === 1 ? "" : "s"}.`,
        );
        router.refresh();
      }
    });
  };

  if (totalNew === 0) {
    return (
      <Panel className="border-olive-600/30">
        <div className="flex items-center gap-3">
          <Check className="w-5 h-5 text-olive-700 shrink-0" strokeWidth={1.8} />
          <div>
            <div className="text-[13px] font-medium text-foreground">
              Nada novo pra importar
            </div>
            <p className="text-[12px] text-muted-foreground">
              Todas as despesas dedutíveis do ano já foram identificadas ou
              importadas. Lance novas despesas no app e elas aparecem aqui.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="border-navy-700/30">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-gold-700" strokeWidth={1.7} />
            <span className="font-display text-[16px] tracking-[-0.01em] text-foreground">
              Importação automática
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Encontrei {totalNew} despesa{totalNew === 1 ? "" : "s"} que parecem
            dedutíveis no IR. Revise, ajuste a seleção e importe — vira{" "}
            <code>ir_deductible_payments</code> automaticamente.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            Selecionado
          </div>
          <div className="font-mono text-[20px] tabular-nums text-foreground font-medium mt-0.5">
            R$ {fmtBRL(selectedAmount)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Button size="sm" variant="ghost" onClick={selectAll}>
          Marcar todos
        </Button>
        <Button size="sm" variant="ghost" onClick={selectNone}>
          Desmarcar todos
        </Button>
      </div>

      <ul className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {newCandidates.map((c) => {
          const isSelected = selected.has(c.transactionId);
          return (
            <li
              key={c.transactionId}
              className={
                "flex items-start gap-2.5 p-2.5 rounded-[6px] border cursor-pointer transition-colors " +
                (isSelected
                  ? "border-navy-700/40 bg-navy-700/5"
                  : "border-border hover:bg-surface-muted")
              }
              onClick={() => toggle(c.transactionId)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(c.transactionId)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 accent-navy-700"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] text-foreground truncate">
                    {c.description}
                  </span>
                  <Badge tone={c.confidence === "high" ? "olive" : c.confidence === "medium" ? "navy" : "neutral"}>
                    {KIND_LABELS[c.suggestedKind ?? ""] ?? c.suggestedKind}
                  </Badge>
                  {c.recognizedName ? (
                    <Badge tone="gold">{c.recognizedName}</Badge>
                  ) : null}
                </div>
                <div className="font-mono text-[11px] text-faint-foreground mt-0.5">
                  {c.date.split("-").reverse().join("/")}
                  {c.categoryName ? ` · ${c.categoryName}` : ""}
                  {c.confidence === "low" ? " · ⚠ confiança baixa, revise" : ""}
                </div>
              </div>
              <div className="font-mono tabular-nums text-[13px] text-foreground shrink-0">
                R$ {fmtBRL(c.amount)}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 pt-3 border-t border-border flex justify-end">
        <Button variant="primary" onClick={handleImport} disabled={pending || selected.size === 0}>
          {pending ? "Importando…" : `Importar ${selected.size} selecionado${selected.size === 1 ? "" : "s"}`}
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" strokeWidth={1.8} />
        </Button>
      </div>
    </Panel>
  );
}
