"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PillGroup, type PillOption } from "@/components/ui/pill-group";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransaction, type TxFormState } from "@/services/transactions.actions";
import { useQuickAdd } from "./quick-add-context";

type TxKind = "expense" | "income" | "transfer";

type AccountLite = { id: string; name: string; institution: string };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

const KIND_OPTIONS: PillOption<TxKind>[] = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transferência" },
];

function todayISO(): string {
  // Hoje em America/Sao_Paulo, formatado como YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export function AddTransactionDialog({
  accounts,
  categories,
}: {
  accounts: AccountLite[];
  categories: CategoryLite[];
}) {
  const { open, defaultKind, hide } = useQuickAdd();
  const [kind, setKind] = useState<TxKind>(defaultKind);
  const [accountId, setAccountId] = useState<string>("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<TxFormState | undefined, FormData>(
    createTransaction,
    undefined,
  );

  // Padrão React 19: ajustar estado em resposta a mudança de prop sem useEffect.
  // Resetamos campos ao abrir (open passa de false → true).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setKind(defaultKind);
      setDate(todayISO());
      setCategoryId("");
      setPaymentMethod("");
      let lastAccount: string | null = null;
      try {
        lastAccount = localStorage.getItem("financas:lastAccountId");
      } catch {}
      if (lastAccount && accounts.some((a) => a.id === lastAccount)) {
        setAccountId(lastAccount);
      } else if (accounts[0]) {
        setAccountId(accounts[0].id);
      }
      setFromAccountId(accounts[0]?.id ?? "");
      setToAccountId(accounts[1]?.id ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      try {
        if (accountId) localStorage.setItem("financas:lastAccountId", accountId);
      } catch {}
      toast.success(
        kind === "income"
          ? "Receita lançada."
          : kind === "expense"
            ? "Despesa lançada."
            : "Transferência registrada.",
      );
      hide();
    }
  }, [state, hide, kind, accountId]);

  const filteredCategories = categories.filter((c) =>
    kind === "income" ? c.kind === "income" : kind === "expense" ? c.kind === "expense" : false,
  );

  const noAccounts = accounts.length === 0;
  const oneAccount = accounts.length === 1;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : hide())}>
      <DialogContent>
        <DialogHeader
          eyebrow="Lançar"
          title={
            kind === "income"
              ? "Nova receita."
              : kind === "expense"
                ? "Nova despesa."
                : "Transferir entre contas."
          }
          description="Cmd+Enter pra salvar rápido."
        />

        {noAccounts ? (
          <div className="text-center py-6">
            <p className="text-[14px] text-muted-foreground">
              Cadastra uma conta primeiro para começar a lançar.
            </p>
          </div>
        ) : (
          <form ref={formRef} action={action} className="space-y-5">
            <PillGroup
              options={KIND_OPTIONS}
              value={kind}
              onChange={(v) => setKind(v)}
              name="kind"
            />

            <Field htmlFor="amount" label="Valor">
              <MoneyInput name="amount" id="amount" autoFocus />
              {state?.fieldErrors?.amount ? (
                <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.amount}</p>
              ) : null}
            </Field>

            {kind === "transfer" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="De" htmlFor="fromAccountId">
                    <Select
                      value={fromAccountId}
                      onValueChange={setFromAccountId}
                      name="fromAccountId"
                    >
                      <SelectTrigger id="fromAccountId">
                        <SelectValue placeholder="Origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}{" "}
                            <span className="text-faint-foreground ml-1">· {a.institution}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Para" htmlFor="toAccountId">
                    <Select value={toAccountId} onValueChange={setToAccountId} name="toAccountId">
                      <SelectTrigger id="toAccountId">
                        <SelectValue placeholder="Destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}{" "}
                            <span className="text-faint-foreground ml-1">· {a.institution}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {state?.fieldErrors?.toAccountId ? (
                      <p className="text-[11.5px] text-rust-600 mt-1">
                        {state.fieldErrors.toAccountId}
                      </p>
                    ) : null}
                  </Field>
                </div>
                <Field htmlFor="tx-description" label="Descrição" hint="Opcional — vamos compor automático com origem/destino se vazio.">
                  <Input
                    id="tx-description"
                    name="description"
                    placeholder="Transferência mensal"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field htmlFor="tx-description" label="Descrição">
                  <Input
                    id="tx-description"
                    name="description"
                    autoComplete="off"
                    placeholder={kind === "expense" ? "Mercado da semana" : "Salário, freelance…"}
                  />
                  {state?.fieldErrors?.description ? (
                    <p className="text-[11.5px] text-rust-600 mt-1">
                      {state.fieldErrors.description}
                    </p>
                  ) : null}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Conta" htmlFor="accountId">
                    <Select value={accountId} onValueChange={setAccountId} name="accountId">
                      <SelectTrigger id="accountId">
                        <SelectValue placeholder="Conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Categoria" htmlFor="categoryId">
                    <Select
                      value={categoryId}
                      onValueChange={setCategoryId}
                      name="categoryId"
                    >
                      <SelectTrigger id="categoryId">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" htmlFor="date">
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              {kind !== "transfer" ? (
                <Field label="Forma" htmlFor="paymentMethod">
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    name="paymentMethod"
                  >
                    <SelectTrigger id="paymentMethod">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="auto_debit">Débito automático</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>

            {state?.error ? (
              <p className="text-[12.5px] text-rust-600">{state.error}</p>
            ) : null}

            {oneAccount && kind === "transfer" ? (
              <p className="text-[12.5px] text-gold-700 bg-gold-100 px-3 py-2 rounded-[8px]">
                Você precisa de pelo menos duas contas para uma transferência.
              </p>
            ) : null}

            <DialogFooter>
              <Button variant="ghost" type="button" onClick={hide}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={pending || (kind === "transfer" && oneAccount)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    formRef.current?.requestSubmit();
                  }
                }}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
