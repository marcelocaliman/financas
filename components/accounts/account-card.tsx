"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive, RotateCcw, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { Money } from "@/components/ui/money";
import { formatDateShort } from "@/lib/utils/format";
import {
  archiveAccount,
  deleteAccount,
  restoreAccount,
} from "@/services/accounts.actions";
import type { AccountType, MarriageRegime, Tables } from "@/types/database";
import { AccountSheet } from "./account-sheet";
import { BalanceAdjustDialog } from "./balance-adjust-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";

type Account = Tables<"accounts">;

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão",
  investment: "Investimento",
  cash: "Dinheiro",
};

export function AccountCard({
  account,
  displayBalance,
  balanceMode = "current",
  balanceLabel,
  assetsBalance = 0,
  creditBreakdown,
  filers = [],
  regime = "solteiro",
}: {
  account: Account;
  /** Saldo a exibir; default = account.current_balance */
  displayBalance?: number;
  /** "current" = saldo atual; "historical" = saldo retroativo; "forecast" = previsto */
  balanceMode?: "current" | "historical" | "forecast";
  /** Sobrescreve "Saldo atual" quando viewing past/future */
  balanceLabel?: string;
  /**
   * Soma do current_balance dos investimentos linkados (apenas type='investment').
   * Quando > 0, o card mostra três linhas: Caixa, Ativos, Total.
   */
  assetsBalance?: number;
  /**
   * Cartão: fatura fechada A PAGAR + vencimento. Quando presente, o card quebra o
   * saldo em "fatura a pagar" + "próxima fatura já lançado" (que somam o saldo) —
   * pra deixar claro por que -X não bate com a soma das faturas (parcelas futuras).
   */
  creditBreakdown?: { payable: number; dueDate: string | null };
  filers?: Tables<"ir_filers">[];
  regime?: MarriageRegime;
}) {
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const handleArchive = async () => {
    const ok = await confirm({
      title: `Arquivar "${account.name}"?`,
      description: "Aparece em \"Arquivadas\" e some das listas. Pode ser restaurada depois.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta arquivada.");
    });
  };
  const handleRestore = () => {
    startTransition(async () => {
      const r = await restoreAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta restaurada.");
    });
  };
  const handleDelete = async () => {
    const ok = await confirm({
      eyebrow: "Ação irreversível",
      title: `Excluir "${account.name}" DEFINITIVAMENTE?`,
      description:
        "Só funciona se a conta NÃO tem transações nem investimentos. Caso contrário, use arquivar.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteAccount(account.id);
      if (r.error) toast.error(r.error);
      else toast.success("Conta excluída.");
    });
  };

  const balance = displayBalance ?? Number(account.current_balance ?? 0);
  const balanceColor =
    account.type === "credit_card"
      ? balance < 0
        ? "text-rust-600"
        : "text-foreground"
      : balance >= 0
        ? "text-foreground"
        : "text-rust-600";
  const labelText =
    balanceLabel ??
    (balanceMode === "historical"
      ? "Saldo no fim do mês"
      : balanceMode === "forecast"
        ? "Saldo previsto"
        : "Saldo atual");

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
              {account.institution}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5 truncate">
              {account.name}
            </div>
          </div>
          {account.is_active ? (
            <RowActionsMenu
              actions={[
                {
                  label: "Editar nome/tipo",
                  icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setEditing(true),
                  disabled: pending,
                },
                {
                  label: "Ajustar saldo",
                  icon: <Scale className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: () => setAdjusting(true),
                  disabled: pending,
                },
                {
                  label: "Arquivar",
                  icon: <Archive className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleArchive,
                  disabled: pending,
                  danger: true,
                },
                {
                  label: "Excluir definitivamente",
                  icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />,
                  onSelect: handleDelete,
                  disabled: pending,
                  danger: true,
                },
              ]}
            />
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={handleRestore} disabled={pending}>
                <RotateCcw className="w-3 h-3" strokeWidth={1.7} />
                Restaurar
              </Button>
              <Tooltip content="Excluir definitivamente">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={pending}
                  aria-label="Excluir definitivamente"
                  className="text-rust-600"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="mt-5">
          {account.type === "investment" && assetsBalance > 0 ? (
            <InvestmentBreakdown
              cash={balance}
              assets={assetsBalance}
              currency={account.currency}
              balanceMode={balanceMode}
            />
          ) : account.type === "credit_card" &&
            balanceMode === "current" &&
            creditBreakdown &&
            creditBreakdown.payable > 0 ? (
            <CreditCardBreakdown
              balance={balance}
              payable={creditBreakdown.payable}
              dueDate={creditBreakdown.dueDate}
              currency={account.currency}
            />
          ) : (
            <>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium flex items-center gap-1.5">
                {labelText}
                {balanceMode === "forecast" ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-gold-600/15 text-gold-700 dark:text-gold-500 text-[9.5px] font-mono tracking-[0.12em] uppercase">
                    Previsão
                  </span>
                ) : null}
              </div>
              <Money
                value={balance}
                currency={account.currency}
                showComparison
                className={cn("text-[24px] tracking-[-0.02em] mt-1 items-start", balanceColor)}
                secondaryClassName="text-[11px]"
              />
              {account.type === "credit_card" && balanceMode === "current" ? (
                <p className="text-[11px] text-faint-foreground mt-2 leading-snug">
                  Total das faturas abertas — toda compra já conta como dívida, mesmo
                  parcela com data futura. A fatura a pagar está em “Faturas abertas”.
                </p>
              ) : null}
              {/* Reconciliação-primeiro: pra contas tipo caixa, "este é o saldo
                  hoje" é a forma principal de manter a conta certa — sem precisar
                  registrar transferências. Botão visível (não escondido no menu). */}
              {["checking", "savings", "cash"].includes(account.type) &&
              balanceMode === "current" ? (
                <button
                  type="button"
                  onClick={() => setAdjusting(true)}
                  disabled={pending}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <Scale className="w-3.5 h-3.5" strokeWidth={1.7} />
                  Conferir / ajustar saldo
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {account.is_active ? (
        <>
          <AccountSheet
            open={editing}
            onOpenChange={setEditing}
            account={account}
            filers={filers}
            regime={regime}
          />
          <BalanceAdjustDialog open={adjusting} onOpenChange={setAdjusting} account={account} />
        </>
      ) : null}
    </>
  );
}

/**
 * Breakdown pra cartão de crédito: o saldo (-X) é a soma das compras já lançadas
 * dos dois ciclos abertos. Quebra em "fatura a pagar" (a fechada) + "próxima
 * fatura, já lançado" — que SOMAM o saldo. Deixa explícito por que -X não bate
 * com a soma das faturas: as parcelas futuras ainda não entraram no saldo.
 */
function CreditCardBreakdown({
  balance,
  payable,
  dueDate,
  currency,
}: {
  balance: number;
  payable: number;
  dueDate: string | null;
  currency: "BRL" | "EUR" | "USD" | "GBP";
}) {
  // Saldo é negativo (dívida) e ACCRUAL: |saldo| = fatura a pagar + fatura em
  // formação (a soma das faturas abertas). Toda compra já conta, mesmo parcela
  // com data futura.
  const forming = Math.max(0, Math.abs(balance) - payable);
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
        Saldo atual
      </div>
      <Money
        value={balance}
        currency={currency}
        showComparison
        className="text-[24px] tracking-[-0.02em] mt-1 items-start text-rust-600"
        secondaryClassName="text-[11px]"
      />
      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint-foreground">
            Fatura a pagar{dueDate ? ` · vence ${formatDateShort(dueDate)}` : ""}
          </span>
          <Money
            value={payable}
            currency={currency}
            className="font-mono text-[12.5px] tabular-nums text-foreground inline-flex !flex-row !items-baseline"
          />
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint-foreground">
            Fatura em formação
          </span>
          <Money
            value={forming}
            currency={currency}
            className="font-mono text-[12.5px] tabular-nums text-foreground inline-flex !flex-row !items-baseline"
          />
        </div>
      </div>
      <p className="text-[11px] text-faint-foreground mt-2 leading-snug">
        As duas faturas abertas somam o saldo — toda compra já conta como dívida,
        mesmo as parcelas que ainda vão cair.
      </p>
    </div>
  );
}

/**
 * Breakdown pra conta tipo investment (corretora): mostra
 * Caixa (parado, ainda não aplicado) + Ativos (soma dos investimentos
 * linkados) + Total. Total é o que o usuário mentalmente vê como "o
 * saldo da corretora".
 *
 * O total não entra duas vezes no patrimônio líquido global: o cálculo
 * de getAccountsTotals exclui o caixa de corretora (anti-double-count) e
 * getPortfolioStats traz os ativos por fora.
 */
function InvestmentBreakdown({
  cash,
  assets,
  currency,
  balanceMode,
}: {
  cash: number;
  assets: number;
  currency: "BRL" | "EUR" | "USD" | "GBP";
  balanceMode: "current" | "historical" | "forecast";
}) {
  const total = cash + assets;
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium flex items-center gap-1.5">
        Total na corretora
        {balanceMode === "forecast" ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-gold-600/15 text-gold-700 dark:text-gold-500 text-[9.5px] font-mono tracking-[0.12em] uppercase">
            Previsão
          </span>
        ) : null}
      </div>
      <Money
        value={total}
        currency={currency}
        showComparison
        className="text-[24px] tracking-[-0.02em] mt-1 items-start text-foreground"
        secondaryClassName="text-[11px]"
      />
      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint-foreground">
            Caixa parado
          </span>
          <Money
            value={cash}
            currency={currency}
            className={cn(
              "font-mono text-[12.5px] tabular-nums inline-flex !flex-row !items-baseline",
              cash > 0 ? "text-foreground" : "text-faint-foreground",
            )}
          />
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint-foreground">
            Em ativos
          </span>
          <Money
            value={assets}
            currency={currency}
            className="font-mono text-[12.5px] tabular-nums text-foreground inline-flex !flex-row !items-baseline"
          />
        </div>
      </div>
    </div>
  );
}
