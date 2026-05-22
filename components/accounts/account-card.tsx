"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive, MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils/format";
import {
  archiveAccount,
  restoreAccount,
} from "@/services/accounts.actions";
import type { AccountType, Tables } from "@/types/database";
import { AccountSheet } from "./account-sheet";

type Account = Tables<"accounts">;

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão",
  investment: "Investimento",
  cash: "Dinheiro",
};

export function AccountCard({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleArchive = () => {
    if (!confirm(`Arquivar "${account.name}"? Aparece em "Arquivadas" e some das listas.`)) return;
    startTransition(async () => {
      const r = await archiveAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta arquivada.");
    });
    setMenuOpen(false);
  };
  const handleRestore = () => {
    startTransition(async () => {
      const r = await restoreAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta restaurada.");
    });
  };

  const balance = Number(account.current_balance ?? 0);
  const balanceColor =
    account.type === "credit_card"
      ? balance < 0
        ? "text-rust-600"
        : "text-foreground"
      : balance >= 0
        ? "text-foreground"
        : "text-rust-600";

  return (
    <>
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border bg-surface p-6 relative group",
          "transition-shadow duration-200",
          account.is_active ? "border-border hover:shadow-sm" : "border-dashed border-border-strong opacity-70",
        )}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="navy">{TYPE_LABELS[account.type]}</Badge>
              {!account.is_active ? <Badge tone="gold">Arquivada</Badge> : null}
            </div>
            <div className="font-display text-[20px] tracking-[-0.015em] text-foreground truncate">
              {account.name}
            </div>
            <div className="font-mono text-[11.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
              {account.institution}
            </div>
          </div>
          {account.is_active ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1.5 rounded-[6px] text-faint-foreground hover:text-foreground hover:bg-surface-muted opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Mais ações"
              >
                <MoreHorizontal className="w-4 h-4" strokeWidth={1.7} />
              </button>
              {menuOpen ? (
                <div
                  className="absolute right-0 mt-1 w-44 bg-surface border border-border-strong rounded-[10px] shadow-md py-1 z-10"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-surface-muted"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={pending}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-surface-muted text-rust-600"
                  >
                    <Archive className="w-3.5 h-3.5" strokeWidth={1.7} /> Arquivar
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleRestore} disabled={pending}>
              <RotateCcw className="w-3 h-3" strokeWidth={1.7} />
              Restaurar
            </Button>
          )}
        </div>

        <div className="mt-5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            Saldo atual
          </div>
          <div className={cn("font-mono text-[24px] tracking-[-0.02em] mt-1", balanceColor)}>
            {formatMoney(balance)}
          </div>
        </div>
      </div>

      {account.is_active ? (
        <AccountSheet open={editing} onOpenChange={setEditing} account={account} />
      ) : null}
    </>
  );
}
