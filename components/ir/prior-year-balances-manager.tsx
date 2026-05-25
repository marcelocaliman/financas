"use client";

import { useState, useTransition } from "react";
import { Save, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import {
  upsertPriorYearBalance,
  deletePriorYearBalance,
} from "@/services/ir/prior-year-balances.actions";
import type { Tables } from "@/types/database";

type Account = Pick<Tables<"accounts">, "id" | "name" | "institution">;
type Investment = Pick<Tables<"investments">, "id" | "ticker" | "name">;
type Physical = Pick<Tables<"physical_assets">, "id" | "name">;
type PriorBalance = Tables<"ir_prior_year_balances">;

type Item =
  | { kind: "account"; id: string; label: string; sublabel: string }
  | { kind: "investment"; id: string; label: string; sublabel: string }
  | { kind: "physical"; id: string; label: string; sublabel: string };

export function PriorYearBalancesManager({
  year,
  accounts,
  investments,
  physical,
  existing,
}: {
  year: number;
  accounts: Account[];
  investments: Investment[];
  physical: Physical[];
  existing: PriorBalance[];
}) {
  const items: Item[] = [
    ...accounts.map((a) => ({
      kind: "account" as const,
      id: a.id,
      label: a.name,
      sublabel: a.institution,
    })),
    ...investments.map((i) => ({
      kind: "investment" as const,
      id: i.id,
      label: i.ticker,
      sublabel: i.name,
    })),
    ...physical.map((p) => ({
      kind: "physical" as const,
      id: p.id,
      label: p.name,
      sublabel: "Bem físico",
    })),
  ];

  const valueByItem = new Map<string, { id: string; balance: number }>();
  for (const b of existing) {
    const key = b.account_id ?? b.investment_id ?? b.physical_asset_id;
    if (key) valueByItem.set(key, { id: b.id, balance: Number(b.balance) });
  }

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic">
        Cadastre contas, investimentos ou bens físicos antes pra registrar saldos do ano anterior.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-[8px] border border-navy-200 dark:border-navy-700/40 bg-navy-50/60 dark:bg-navy-900/20 px-3 py-2.5">
        <Info className="w-4 h-4 mt-0.5 text-navy-700 dark:text-navy-300 flex-shrink-0" strokeWidth={1.7} />
        <p className="text-[12.5px] text-foreground leading-relaxed">
          Quando começa a usar o app no meio do ano, a coluna <b>"Situação em 31/12/{year - 1}"</b> da
          declaração fica vazia. Preencha aqui pra cada bem que já existia em 31/12/{year - 1}.
          Se um bem só foi adquirido em {year}, deixe vazio.
        </p>
      </div>

      <div className="rounded-[8px] border border-border overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-bone-100 dark:bg-ink-800 text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th className="text-left px-3 py-2 font-medium">Bem</th>
              <th className="text-right px-3 py-2 font-medium w-[200px]">Saldo 31/12/{year - 1}</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <BalanceRow
                key={`${item.kind}:${item.id}`}
                item={item}
                year={year - 1}
                existing={valueByItem.get(item.id) ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BalanceRow({
  item,
  year,
  existing,
}: {
  item: Item;
  year: number;
  existing: { id: string; balance: number } | null;
}) {
  const [balance, setBalance] = useState<number>(existing?.balance ?? 0);
  const [pending, startTransition] = useTransition();
  const [delPending, startDelete] = useTransition();

  async function handleSave() {
    if (balance <= 0 && !existing) {
      toast.info("Pulei — saldo 0 e nada salvo ainda.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("year", String(year));
      if (item.kind === "account") fd.set("accountId", item.id);
      else if (item.kind === "investment") fd.set("investmentId", item.id);
      else fd.set("physicalAssetId", item.id);
      fd.set("balance", String(balance));
      const r = await upsertPriorYearBalance(fd);
      if (r.error) toast.error(r.error);
      else toast.success("Salvo.");
    });
  }

  async function handleDelete() {
    if (!existing) return;
    startDelete(async () => {
      const r = await deletePriorYearBalance(existing.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Removido.");
        setBalance(0);
      }
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2.5">
        <div className="text-foreground">{item.label}</div>
        <div className="text-[11.5px] text-faint-foreground">{item.sublabel}</div>
      </td>
      <td className="px-3 py-2 text-right">
        <MoneyInput
          name={`balance-${item.id}`}
          defaultValue={balance}
          onValueChange={setBalance}
          className="text-right"
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1 justify-end">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSave}
            disabled={pending}
            aria-label="Salvar"
          >
            <Save className="w-3.5 h-3.5" strokeWidth={1.7} />
          </Button>
          {existing ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              disabled={delPending}
              aria-label="Remover"
              className="text-rust-600"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
