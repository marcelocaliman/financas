"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { PillGroup, type PillOption } from "@/components/ui/pill-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createRecurringRule,
  updateRecurringRule,
  type RecurrenceFormState,
} from "@/services/recurrences.actions";
import type {
  Currency,
  RecurrenceFrequency,
  TransactionKind,
  Tables,
} from "@/types/database";

type RecurrenceRule = Tables<"recurring_rules">;
type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

const KIND_OPTIONS: PillOption<TransactionKind>[] = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transferência" },
];

const FREQUENCY_OPTIONS: PillOption<RecurrenceFrequency>[] = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

const WEEKDAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
];

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function RecurrenceSheet({
  open,
  onOpenChange,
  rule,
  accounts,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rule?: RecurrenceRule | null;
  accounts: AccountLite[];
  categories: CategoryLite[];
}) {
  const isEdit = !!rule;

  const [kind, setKind] = useState<TransactionKind>(rule?.kind ?? "expense");
  const [currency, setCurrency] = useState<Currency>(rule?.currency ?? "BRL");
  const [accountId, setAccountId] = useState<string>(rule?.account_id ?? accounts[0]?.id ?? "");
  const [fromAccountId, setFromAccountId] = useState<string>(
    rule?.from_account_id ?? accounts[0]?.id ?? "",
  );
  const [toAccountId, setToAccountId] = useState<string>(
    rule?.to_account_id ?? accounts[1]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState<string>(rule?.category_id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<string>(rule?.payment_method ?? "");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency ?? "monthly");
  const [intervalCount, setIntervalCount] = useState<string>(
    String(rule?.interval_count ?? 1),
  );
  const [dayOfMonth, setDayOfMonth] = useState<string>(
    rule?.day_of_month ? String(rule.day_of_month) : "",
  );
  const [dayOfWeek, setDayOfWeek] = useState<string>(
    rule?.day_of_week != null ? String(rule.day_of_week) : "",
  );
  const [startDate, setStartDate] = useState(rule?.start_date ?? todayISO());
  const [endDate, setEndDate] = useState(rule?.end_date ?? "");

  const [state, action, pending] = useActionState<RecurrenceFormState | undefined, FormData>(
    isEdit ? updateRecurringRule : createRecurringRule,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setKind(rule?.kind ?? "expense");
      setCurrency(rule?.currency ?? "BRL");
      setAccountId(rule?.account_id ?? accounts[0]?.id ?? "");
      setFromAccountId(rule?.from_account_id ?? accounts[0]?.id ?? "");
      setToAccountId(rule?.to_account_id ?? accounts[1]?.id ?? "");
      setCategoryId(rule?.category_id ?? "");
      setPaymentMethod(rule?.payment_method ?? "");
      setFrequency(rule?.frequency ?? "monthly");
      setIntervalCount(String(rule?.interval_count ?? 1));
      setDayOfMonth(rule?.day_of_month ? String(rule.day_of_month) : "");
      setDayOfWeek(rule?.day_of_week != null ? String(rule.day_of_week) : "");
      setStartDate(rule?.start_date ?? todayISO());
      setEndDate(rule?.end_date ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Recorrência atualizada." : "Recorrência criada.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  const filteredCategories = categories.filter((c) =>
    kind === "income" ? c.kind === "income" : kind === "expense" ? c.kind === "expense" : false,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar recorrência" : "Nova recorrência"}
          title={isEdit ? "Atualizar recorrência." : "Criar uma recorrência."}
          description={
            kind === "transfer"
              ? "Transferência entre contas em ciclo fixo (salário→poupança, aporte mensal…)."
              : kind === "income"
                ? "Receitas que entram em data fixa (salário, aluguel recebido, dividendos…)."
                : "Despesas que repetem (aluguel, assinaturas, mensalidades…)."
          }
        />

        <form action={action} className="space-y-5">
          {isEdit ? <input type="hidden" name="id" value={rule.id} /> : null}

          <PillGroup
            options={KIND_OPTIONS}
            value={kind}
            onChange={setKind}
            name="kind"
          />

          <div className="grid grid-cols-[1fr_92px] gap-2 items-end">
            <Field htmlFor="amount" label="Valor">
              <MoneyInput
                name="amount"
                id="amount"
                defaultValue={Number(rule?.amount ?? 0)}
                size="lg"
                autoFocus={!isEdit}
              />
              {state?.fieldErrors?.amount ? (
                <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.amount}</p>
              ) : null}
            </Field>
            <Field htmlFor="currency" label="Moeda">
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
                name="currency"
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ BRL</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="USD">US$ USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field htmlFor="description" label="Descrição" required>
            <Input
              id="description"
              name="description"
              defaultValue={rule?.description ?? ""}
              placeholder={
                kind === "expense"
                  ? "Aluguel, Netflix, Spotify…"
                  : kind === "income"
                    ? "Salário, dividendos…"
                    : "Transferência mensal pra poupança"
              }
            />
            {state?.fieldErrors?.description ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.description}</p>
            ) : null}
          </Field>

          {kind === "transfer" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="De" htmlFor="fromAccountId" required>
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
                        {a.name} · {a.institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Para" htmlFor="toAccountId" required>
                <Select
                  value={toAccountId}
                  onValueChange={setToAccountId}
                  name="toAccountId"
                >
                  <SelectTrigger id="toAccountId">
                    <SelectValue placeholder="Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Conta" htmlFor="accountId" required>
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
              <Field label="Categoria" htmlFor="categoryId" hint="Opcional">
                <Select value={categoryId} onValueChange={setCategoryId} name="categoryId">
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
          )}

          {kind !== "transfer" ? (
            <Field label="Forma de pagamento" htmlFor="paymentMethod" hint="Opcional">
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

          <div className="pt-3 border-t border-border">
            <Field label="Frequência" required>
              <PillGroup
                options={FREQUENCY_OPTIONS}
                value={frequency}
                onChange={setFrequency}
                name="frequency"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`A cada ${intervalCount}`}
              htmlFor="intervalCount"
              hint={
                frequency === "daily"
                  ? "dia(s)"
                  : frequency === "weekly"
                    ? "semana(s)"
                    : frequency === "monthly"
                      ? "mês(es)"
                      : "ano(s)"
              }
            >
              <Input
                id="intervalCount"
                name="intervalCount"
                type="number"
                min={1}
                max={365}
                value={intervalCount}
                onChange={(e) => setIntervalCount(e.target.value)}
              />
            </Field>

            {frequency === "weekly" ? (
              <Field label="Dia da semana" htmlFor="dayOfWeek" hint="Opcional">
                <Select value={dayOfWeek} onValueChange={setDayOfWeek} name="dayOfWeek">
                  <SelectTrigger id="dayOfWeek">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : frequency === "monthly" ? (
              <Field label="Dia do mês" htmlFor="dayOfMonth" hint="1-31; vazio = dia do início">
                <Input
                  id="dayOfMonth"
                  name="dayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  placeholder="—"
                />
              </Field>
            ) : (
              <div />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início" htmlFor="startDate" required>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Fim" htmlFor="endDate" hint="Opcional — vazio = sem fim">
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Notas" htmlFor="notes" hint="Opcional — só pra você">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={rule?.notes ?? ""}
              placeholder="Vencimento todo dia 5, débito automático…"
            />
          </Field>

          {state?.error ? <p className="text-[12.5px] text-rust-600">{state.error}</p> : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Criar recorrência"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
