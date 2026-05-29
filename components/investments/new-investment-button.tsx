"use client";

import { useState } from "react";
import { Plus, TrendingUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { InvestmentSheet } from "./investment-sheet";
import { OptionDialog } from "./option-dialog";
import type { MarriageRegime, Tables } from "@/types/database";

export function NewInvestmentButton({
  investmentAccounts,
  filers = [],
  regime = "solteiro",
}: {
  investmentAccounts: { id: string; name: string; institution: string }[];
  filers?: Tables<"ir_filers">[];
  regime?: MarriageRegime;
}) {
  const [open, setOpen] = useState(false);
  const [optionOpen, setOptionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="relative inline-flex">
        <Button
          variant="primary"
          onClick={() => setOpen(true)}
          className="rounded-r-none border-r border-r-ink-800/40"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Novo ativo
        </Button>
        <Tooltip content="Mais opções (opções, calls/puts…)">
          <Button
            variant="primary"
            onClick={() => setMenuOpen((m) => !m)}
            className="rounded-l-none px-2"
            aria-label="Mais opções"
          >
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
        </Tooltip>
        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-[8px] shadow-lg overflow-hidden min-w-[220px]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setOptionOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left text-foreground hover:bg-surface-muted"
              >
                <TrendingUp
                  className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300"
                  strokeWidth={1.7}
                />
                Cadastrar opção (call/put)
              </button>
            </div>
          </>
        ) : null}
      </div>

      <InvestmentSheet
        open={open}
        onOpenChange={setOpen}
        investmentAccounts={investmentAccounts}
        filers={filers}
        regime={regime}
      />
      <OptionDialog
        open={optionOpen}
        onOpenChange={setOptionOpen}
        investmentAccounts={investmentAccounts}
      />
    </>
  );
}
