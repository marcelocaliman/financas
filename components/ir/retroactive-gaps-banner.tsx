"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { fillRetroactiveMonths } from "@/services/ir/retroactive-gaps.actions";
import type { RetroactiveGap } from "@/services/ir/retroactive-gaps";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

export function RetroactiveGapsBanner({ gaps }: { gaps: RetroactiveGap[] }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);

  if (gaps.length === 0) return null;

  const totalMissing = gaps.reduce((s, g) => s + g.missingMonths.length, 0);
  const totalAmount = gaps.reduce((s, g) => s + g.totalMissingAmount, 0);

  const handleFill = (gap: RetroactiveGap) => {
    setPendingRuleId(gap.ruleId);
    startTransition(async () => {
      const r = await fillRetroactiveMonths({
        ruleId: gap.ruleId,
        months: gap.missingMonths,
      });
      setPendingRuleId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `${r.created} lançamento${r.created === 1 ? "" : "s"} histórico${r.created === 1 ? "" : "s"} criado${r.created === 1 ? "" : "s"} pra "${gap.description}".`,
      );
    });
  };

  const handleFillAll = () => {
    startTransition(async () => {
      let total = 0;
      for (const g of gaps) {
        setPendingRuleId(g.ruleId);
        const r = await fillRetroactiveMonths({
          ruleId: g.ruleId,
          months: g.missingMonths,
        });
        if (r.error) {
          toast.error(`${g.description}: ${r.error}`);
          continue;
        }
        total += r.created ?? 0;
      }
      setPendingRuleId(null);
      toast.success(`${total} lançamento(s) histórico(s) cadastrado(s) no total.`);
    });
  };

  return (
    <Panel className="mb-5 border-gold-600/40 bg-gold-100/30 dark:bg-gold-700/10">
      <div className="flex items-start gap-3">
        <CalendarClock className="w-5 h-5 text-gold-700 dark:text-gold-200 shrink-0 mt-0.5" strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gold-700 dark:text-gold-200 font-medium mb-1">
                Lacunas retroativas pra IR
              </div>
              <p className="text-[13.5px] text-foreground leading-snug">
                <b>{totalMissing} lançamento(s)</b> faltam ser cadastrado(s) pra IR/{gaps[0] && gaps[0].missingMonths[0]?.slice(0, 4)} ficar completo — <b>R$ {fmtBRL(totalAmount)}</b> em receitas/despesas que existem como recorrência mas ainda não foram materializadas nos meses passados.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.7} />
                    Esconder detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.7} />
                    Ver detalhes
                  </>
                )}
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleFillAll}
                disabled={pending}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" strokeWidth={1.7} />
                {pending && pendingRuleId === null ? "Cadastrando…" : "Preencher tudo"}
              </Button>
            </div>
          </div>

          {expanded ? (
            <div className="mt-4 space-y-2">
              {gaps.map((g) => (
                <div
                  key={g.ruleId}
                  className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-[8px] bg-surface border border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[13px] text-foreground truncate">
                      {g.description}
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.08em] ${g.kind === "income" ? "bg-olive-100 text-olive-800 dark:bg-olive-700/30 dark:text-olive-300" : "bg-rust-100 text-rust-700 dark:bg-rust-700/30 dark:text-rust-300"}`}>
                        {g.kind === "income" ? "receita" : "despesa"}
                      </span>
                      {g.isDeductible ? (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.08em] bg-navy-100 text-navy-800 dark:bg-navy-700/30 dark:text-navy-300">
                          dedutível
                        </span>
                      ) : null}
                      {g.excludeFromIr ? (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.08em] bg-surface-muted text-faint-foreground">
                          não declara
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[11px] text-faint-foreground mt-0.5">
                      R$ {fmtBRL(g.amount)}/mês ·{" "}
                      <b>{g.missingMonths.length} mês(es) faltando</b>:{" "}
                      {g.missingMonths.map(monthLabel).join(", ")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[13px] tabular-nums text-foreground">
                      R$ {fmtBRL(g.totalMissingAmount)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFill(g)}
                      disabled={pending}
                      className="mt-1 text-[11px] text-navy-700 dark:text-navy-300 hover:underline disabled:opacity-40"
                    >
                      {pendingRuleId === g.ruleId
                        ? "Cadastrando…"
                        : `+ Cadastrar ${g.missingMonths.length} histórica(s)`}
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground italic mt-2">
                Lançamentos históricos não afetam saldo da conta — só servem pra
                declaração IR. Aparecem em /transacoes com badge &quot;histórica · IR&quot;.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
