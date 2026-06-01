"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { useQuickAdd } from "@/components/transactions/quick-add-context";
import { parseQuickEntry } from "@/lib/financial/parse-quick-entry";

/**
 * Barra de lançamento rápido na Início — o caminho mais curto pra registrar
 * um gasto. O usuário digita "30 mercado" e a gente abre o modal já preenchido
 * (valor + descrição + categoria sugerida), pra ele só confirmar.
 *
 * A ação mais frequente do dia a dia merece estar no topo, não escondida.
 */
function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function QuickEntryBar() {
  const { show } = useQuickAdd();
  const [text, setText] = useState("");

  const trimmed = text.trim();
  const preview = trimmed ? parseQuickEntry(trimmed) : null;
  const hasPreview = !!preview && (preview.amount !== null || preview.description.length > 0);

  function submit() {
    if (!trimmed) {
      show("expense");
      return;
    }
    show(preview?.kind ?? "expense", trimmed);
    setText("");
  }

  return (
    <div className="rounded-[12px] border border-border bg-surface px-3.5 py-3 sm:px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-navy-600 dark:text-navy-300 shrink-0" strokeWidth={1.8} />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Lançar rápido — ex.: 30 mercado, uber 27,90, +5000 salário"
          autoComplete="off"
          aria-label="Lançamento rápido"
          className="flex-1 min-w-0 bg-transparent text-[14px] outline-none placeholder:text-faint-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!trimmed}
          aria-label="Lançar"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-[8px] bg-foreground text-background px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Lançar
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
      {hasPreview ? (
        <div className="mt-2 flex items-center gap-2 text-[11.5px] text-muted-foreground pl-[26px]">
          <span className="font-mono tabular-nums">
            {preview!.amount !== null ? `R$ ${fmtBRL(preview!.amount)}` : "valor?"}
          </span>
          {preview!.description ? (
            <>
              <span className="text-faint-foreground">·</span>
              <span className="truncate">{preview!.description}</span>
            </>
          ) : null}
          <span className="text-faint-foreground">·</span>
          <span>{preview!.kind === "income" ? "receita" : "despesa"}</span>
        </div>
      ) : null}
    </div>
  );
}
