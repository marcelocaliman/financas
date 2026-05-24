"use client";

import { useActionState, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAccount,
  updateAccount,
  type AccountFormState,
} from "@/services/accounts.actions";
import type { AccountType, Currency, Tables } from "@/types/database";

type Account = Tables<"accounts">;

const TYPES: { value: AccountType; label: string; hint: string }[] = [
  { value: "checking", label: "Conta corrente", hint: "movimento do dia" },
  { value: "savings", label: "Poupança", hint: "guardada, líquida" },
  { value: "credit_card", label: "Cartão de crédito", hint: "fatura no futuro" },
  { value: "investment", label: "Investimento", hint: "corretora, fundos" },
  { value: "cash", label: "Dinheiro", hint: "espécie" },
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "BRL", label: "R$ Real (BRL)" },
  { value: "EUR", label: "€ Euro (EUR)" },
  { value: "USD", label: "US$ Dólar (USD)" },
];

export function AccountSheet({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account?: Account | null;
}) {
  const isEdit = !!account;
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? "BRL");

  const [state, action, pending] = useActionState<AccountFormState | undefined, FormData>(
    isEdit ? updateAccount : createAccount,
    undefined,
  );

  // Reset on open (React 19 pattern)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setType(account?.type ?? "checking");
      setCurrency(account?.currency ?? "BRL");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Conta atualizada." : "Conta cadastrada.");
      onOpenChange(false);
    }
  }, [state, onOpenChange, isEdit]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar" : "Nova conta"}
          title={isEdit ? "Atualizar conta." : "Adicionar uma conta."}
          description={
            isEdit
              ? "Mude apelido, instituição ou tipo."
              : "Cartão, conta corrente, poupança, corretora ou dinheiro vivo — qualquer lugar onde o dinheiro mora."
          }
        />

        <form action={action} className="space-y-5">
          {isEdit ? <input type="hidden" name="id" value={account.id} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Instituição" htmlFor="institution" required>
              <Input
                id="institution"
                name="institution"
                defaultValue={account?.institution ?? ""}
                placeholder="Itaú, Nubank, XP…"
                autoFocus
              />
              {state?.fieldErrors?.institution ? (
                <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.institution}</p>
              ) : null}
            </Field>
            <Field label="Apelido" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                defaultValue={account?.name ?? ""}
                placeholder="Conta corrente, Cartão dia a dia…"
              />
              {state?.fieldErrors?.name ? (
                <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.name}</p>
              ) : null}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" htmlFor="type" required>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)} name="type">
                <SelectTrigger id="type">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                      <span className="ml-2 text-faint-foreground text-[11.5px]">{t.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Moeda" htmlFor="currency" required>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
                name="currency"
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Moeda" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {!isEdit ? (
            <Field
              label="Saldo inicial"
              htmlFor="initialBalance"
              hint="Para contas com saldo: o que tem agora. Para cartão: zero (a fatura nasce com os lançamentos)."
            >
              <MoneyInput name="initialBalance" id="initialBalance" />
            </Field>
          ) : null}

          {/* Identificação Receita Federal — usada na declaração IR */}
          <details className="rounded-[8px] border border-border overflow-hidden">
            <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] text-foreground hover:bg-surface-muted font-medium">
              Identificação Receita (IRPF) ▼
            </summary>
            <div className="p-3 space-y-3 border-t border-border bg-bone-100 dark:bg-ink-800">
              <Field label="CNPJ da instituição" htmlFor="cnpj" hint="Pra Bens e Direitos no IR">
                <input
                  id="cnpj"
                  name="cnpj"
                  defaultValue={account?.cnpj ?? ""}
                  placeholder="00.000.000/0001-00"
                  className="font-mono w-full h-9 px-3 rounded-[6px] border border-border-strong bg-surface text-[13px]"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Agência" htmlFor="agency">
                  <input
                    id="agency"
                    name="agency"
                    defaultValue={account?.agency ?? ""}
                    placeholder="1234"
                    className="font-mono w-full h-9 px-3 rounded-[6px] border border-border-strong bg-surface text-[13px]"
                  />
                </Field>
                <Field label="Conta" htmlFor="accountNumber">
                  <input
                    id="accountNumber"
                    name="accountNumber"
                    defaultValue={account?.account_number ?? ""}
                    placeholder="56789-0"
                    className="font-mono w-full h-9 px-3 rounded-[6px] border border-border-strong bg-surface text-[13px]"
                  />
                </Field>
              </div>
            </div>
          </details>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar conta"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
