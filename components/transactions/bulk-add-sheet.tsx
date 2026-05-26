"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { PillGroup, type PillOption } from "@/components/ui/pill-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  importTransactionsCSV,
  type ImportRow,
} from "@/services/transactions.import.actions";
import type { Currency, TransactionKind } from "@/types/database";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

type Draft = {
  uid: string;
  kind: TransactionKind;
  date: string;
  description: string;
  amount: number;
  currency: Currency;
  accountName: string;
  categoryName: string;
};

const KIND_OPTIONS: PillOption<TransactionKind>[] = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
];

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function newDraft(accounts: AccountLite[]): Draft {
  return {
    uid: crypto.randomUUID(),
    kind: "expense",
    date: todayISO(),
    description: "",
    amount: 0,
    currency: "BRL",
    accountName: accounts[0]?.name ?? "",
    categoryName: "",
  };
}

/**
 * "Adicionar várias" — sheet com N linhas editáveis pra inserir várias
 * transações de uma vez sem usar CSV. Reaproveita a action de import.
 */
export function BulkAddSheet({
  open,
  onOpenChange,
  accounts,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accounts: AccountLite[];
  categories: CategoryLite[];
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, startTransition] = useTransition();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDrafts(Array.from({ length: 3 }, () => newDraft(accounts)));
  }

  function update(uid: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  }
  function remove(uid: string) {
    setDrafts((prev) => prev.filter((d) => d.uid !== uid));
  }
  function add() {
    setDrafts((prev) => [...prev, newDraft(accounts)]);
  }

  function handleSubmit() {
    const filled = drafts.filter((d) => d.description.trim() && d.amount > 0);
    if (filled.length === 0) {
      toast.error("Preencha pelo menos uma linha.");
      return;
    }

    const payload: ImportRow[] = filled.map((d) => ({
      date: d.date,
      description: d.description.trim(),
      amount: d.amount,
      currency: d.currency,
      kind: d.kind,
      accountName: d.accountName,
      categoryName: d.categoryName || null,
      paymentMethod: null,
    }));

    startTransition(async () => {
      const r = await importTransactionsCSV(payload);
      if (r.errors && r.errors.length > 0) {
        toast.error(r.errors.map((e) => e.error).join("; "));
        return;
      }
      const inserted = r.inserted ?? 0;
      const skipped = r.skippedDuplicates?.length ?? 0;
      const msg = `${inserted} lançamento${inserted === 1 ? "" : "s"} criado${inserted === 1 ? "" : "s"}`
        + (skipped > 0 ? ` · ${skipped} pulado${skipped === 1 ? "" : "s"} (já existia${skipped === 1 ? "" : "m"})` : "");
      toast.success(msg);
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[min(720px,100vw)]">
        <SheetHeader
          eyebrow="Lançamento em lote"
          title="Adicionar várias transações."
          description="Cada linha é uma transação. Linhas vazias são ignoradas — preencha só as que importam."
        />

        <div className="space-y-2">
          {drafts.map((d, idx) => (
            <BulkRow
              key={d.uid}
              draft={d}
              index={idx}
              accounts={accounts}
              categories={categories}
              onChange={(patch) => update(d.uid, patch)}
              onRemove={() => remove(d.uid)}
            />
          ))}
          <button
            type="button"
            onClick={add}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-[8px] border border-dashed border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
            Mais uma linha
          </button>
        </div>

        <div className="flex justify-between items-center gap-2 pt-5 mt-5 border-t border-border">
          <span className="text-[12.5px] text-muted-foreground">
            {drafts.filter((d) => d.description.trim() && d.amount > 0).length} preenchida
            {drafts.filter((d) => d.description.trim() && d.amount > 0).length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={pending}>
              <Check className="w-3.5 h-3.5" strokeWidth={2} />
              {pending ? "Salvando…" : "Salvar todas"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ========================================================================== */

function BulkRow({
  draft: d,
  index,
  accounts,
  categories,
  onChange,
  onRemove,
}: {
  draft: Draft;
  index: number;
  accounts: AccountLite[];
  categories: CategoryLite[];
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  const filteredCategories = categories.filter((c) => c.kind === d.kind);

  return (
    <div className="rounded-[10px] border border-border bg-surface p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            #{index + 1}
          </span>
          <PillGroup
            options={KIND_OPTIONS}
            value={d.kind}
            onChange={(v) => onChange({ kind: v, categoryName: "" })}
            size="sm"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-[6px] text-faint-foreground hover:text-rust-600 hover:bg-rust-100/40 transition-colors"
          aria-label="Remover"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
        </button>
      </div>

      <div className="grid grid-cols-[110px_1fr_130px_80px] gap-2">
        <Field label="Data">
          <Input
            type="date"
            value={d.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </Field>
        <Field label="Descrição">
          <Input
            value={d.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={d.kind === "income" ? "Salário, freela…" : "Mercado, gasolina…"}
          />
        </Field>
        <Field label="Valor">
          <MoneyInput
            name={`amt-${d.uid}`}
            defaultValue={d.amount}
            onValueChange={(v) => onChange({ amount: v })}
          />
        </Field>
        <Field label="Moeda">
          <Select
            value={d.currency}
            onValueChange={(v) => onChange({ currency: v as Currency })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">R$</SelectItem>
              <SelectItem value="EUR">€</SelectItem>
              <SelectItem value="USD">US$</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Conta">
          <Select
            value={d.accountName}
            onValueChange={(v) => onChange({ accountName: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.name}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Categoria" hint="Opcional">
          <Select
            value={d.categoryName}
            onValueChange={(v) => onChange({ categoryName: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}
