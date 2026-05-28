"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTransaction, type TxFormState } from "@/services/transactions.actions";
import type { Transaction } from "@/services/transactions";
import type { Tables } from "@/types/database";
import { ReceiptUploader } from "./receipt-uploader";

type AccountLite = { id: string; name: string; institution: string };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };
type DebtLite = { id: string; description: string };
type FonteLite = Pick<
  Tables<"fontes_pagadoras">,
  "id" | "name" | "type" | "cnpj" | "cpf"
>;

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
  debts = [],
  fontes = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: Transaction;
  accounts: AccountLite[];
  categories: CategoryLite[];
  debts?: DebtLite[];
  fontes?: FonteLite[];
}) {
  const isTransfer = transaction.kind === "transfer";

  const [accountId, setAccountId] = useState(transaction.account_id);
  const [categoryId, setCategoryId] = useState<string>(transaction.category_id ?? "");
  const [debtId, setDebtId] = useState<string>(
    (transaction as { debt_id?: string | null }).debt_id ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(transaction.payment_method ?? "");
  const [date, setDate] = useState<string>(transaction.date);
  const [isHistoricalIrOnly, setIsHistoricalIrOnly] = useState<boolean>(
    transaction.is_historical_ir_only ?? false,
  );
  const [excludeFromIr, setExcludeFromIr] = useState<boolean>(
    transaction.exclude_from_ir ?? false,
  );
  const [fontePagadoraId, setFontePagadoraId] = useState<string>(
    transaction.fonte_pagadora_id ?? "",
  );
  const [irrfAmount, setIrrfAmount] = useState<number>(
    Number(transaction.irrf_amount ?? 0),
  );
  const [inssAmount, setInssAmount] = useState<number>(
    Number(transaction.inss_amount ?? 0),
  );
  const [showIR, setShowIR] = useState<boolean>(
    !!(transaction.fonte_pagadora_id || transaction.irrf_amount || transaction.inss_amount),
  );

  const [state, action, pending] = useActionState<TxFormState | undefined, FormData>(
    updateTransaction,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAccountId(transaction.account_id);
      setCategoryId(transaction.category_id ?? "");
      setDebtId((transaction as { debt_id?: string | null }).debt_id ?? "");
      setPaymentMethod(transaction.payment_method ?? "");
      setDate(transaction.date);
      setIsHistoricalIrOnly(transaction.is_historical_ir_only ?? false);
      setExcludeFromIr(transaction.exclude_from_ir ?? false);
      setFontePagadoraId(transaction.fonte_pagadora_id ?? "");
      setIrrfAmount(Number(transaction.irrf_amount ?? 0));
      setInssAmount(Number(transaction.inss_amount ?? 0));
      setShowIR(
        !!(transaction.fonte_pagadora_id || transaction.irrf_amount || transaction.inss_amount),
      );
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success("Lançamento atualizado.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const filteredCategories = categories.filter((c) =>
    transaction.kind === "income"
      ? c.kind === "income"
      : transaction.kind === "expense"
        ? c.kind === "expense"
        : false,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          eyebrow="Editar"
          title={
            isTransfer ? (
              <>Editar transferência.</>
            ) : transaction.kind === "income" ? (
              <>Editar receita.</>
            ) : (
              <>Editar despesa.</>
            )
          }
          description={
            isTransfer
              ? "Transferências são pares espelhados. Aqui você ajusta descrição e data dessa linha; para alterar valor ou contas, exclua e refaça."
              : "Mude o que precisar e salve."
          }
        />

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={transaction.id} />
          <input type="hidden" name="kind" value={transaction.kind} />

          <Field htmlFor="amount" label="Valor">
            <MoneyInput
              name="amount"
              id="amount"
              defaultValue={Number(transaction.amount)}
              disabled={isTransfer}
            />
            {isTransfer ? (
              <p className="text-[11.5px] text-faint-foreground mt-1">
                Para alterar o valor da transferência, exclua o par e refaça.
              </p>
            ) : null}
          </Field>

          <Field htmlFor="tx-description" label="Descrição">
            <Input
              id="tx-description"
              name="description"
              defaultValue={transaction.description}
            />
          </Field>

          {!isTransfer ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Conta" htmlFor="accountId">
                <Select value={accountId} onValueChange={setAccountId} name="accountId">
                  <SelectTrigger id="accountId">
                    <SelectValue placeholder="Conta" />
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
              <Field label="Categoria" htmlFor="categoryId">
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
          ) : (
            <input type="hidden" name="accountId" value={accountId} />
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
            {!isTransfer ? (
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

          {/* Vincula a dívida — só pra expense quando há dívidas */}
          {transaction.kind === "expense" && debts.length > 0 ? (
            <Field
              label="Vincular a dívida"
              htmlFor="debtId-edit"
              hint="Reduz o saldo da dívida automaticamente"
            >
              <input type="hidden" name="debtId" value={debtId === "__none" ? "" : debtId} />
              <Select
                value={debtId || "__none"}
                onValueChange={(v) => setDebtId(v === "__none" ? "" : v)}
              >
                <SelectTrigger id="debtId-edit">
                  <SelectValue placeholder="— Não vincula" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Não vincula</SelectItem>
                  {debts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      ↓ {d.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {/* Seção IR — apenas pra receitas com fontes configuradas */}
          {transaction.kind === "income" && fontes.length > 0 ? (
            <div className="rounded-[8px] border border-border bg-bone-100 dark:bg-ink-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowIR((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[12.5px] text-foreground hover:bg-surface-muted"
              >
                <span className="font-medium">
                  IR · fonte pagadora + IRRF/INSS retidos
                </span>
                {showIR ? (
                  <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.7} />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.7} />
                )}
              </button>
              {showIR ? (
                <div className="p-3 space-y-3 border-t border-border">
                  <input type="hidden" name="fontePagadoraId" value={fontePagadoraId} />
                  <input type="hidden" name="irrfAmount" value={irrfAmount} />
                  <input type="hidden" name="inssAmount" value={inssAmount} />
                  <Field label="Fonte pagadora" htmlFor="fonte-edit" hint="Só empresas que pagam VOCÊ (salário, aluguel, dividendos). Médicos e planos de saúde não entram aqui.">
                    <Select value={fontePagadoraId} onValueChange={setFontePagadoraId}>
                      <SelectTrigger id="fonte-edit">
                        <SelectValue placeholder="— escolher" />
                      </SelectTrigger>
                      <SelectContent>
                        {fontes.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name} · {f.cnpj ?? f.cpf ?? f.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="IRRF retido" htmlFor="irrf-input-edit">
                      <MoneyInput
                        name="irrf-input-edit"
                        defaultValue={irrfAmount}
                        onValueChange={setIrrfAmount}
                      />
                    </Field>
                    <Field label="INSS" htmlFor="inss-input-edit">
                      <MoneyInput
                        name="inss-input-edit"
                        defaultValue={inssAmount}
                        onValueChange={setInssAmount}
                      />
                    </Field>
                  </div>
                  <p className="text-[11px] text-faint-foreground">
                    Esses valores vão direto pro quadro &quot;Rendimentos Tributáveis Recebidos de PJ&quot; no IRPF.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {transaction.kind === "income" ? (
            <label
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-bone-100 dark:bg-ink-800 cursor-pointer border border-border"
              htmlFor="excludeFromIr"
            >
              <input
                type="checkbox"
                id="excludeFromIr"
                name="excludeFromIr"
                value="1"
                checked={excludeFromIr}
                onChange={(e) => setExcludeFromIr(e.target.checked)}
                className="mt-0.5 accent-navy-700"
              />
              <div className="text-[12.5px] leading-relaxed">
                <span className="font-medium text-foreground">
                  Não declarar no IRPF
                </span>
                <span className="block text-faint-foreground text-[11.5px] mt-0.5">
                  Receita fica no app pra controle pessoal mas é ignorada nos
                  relatórios e no arquivo .DEC. Use pra presentes, reembolsos,
                  transferências entre contas próprias, etc.
                </span>
              </div>
            </label>
          ) : null}

          {!isTransfer ? (
            <label
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-bone-100 dark:bg-ink-800 cursor-pointer border border-border"
              htmlFor="isHistoricalIrOnly"
            >
              <input
                type="checkbox"
                id="isHistoricalIrOnly"
                name="isHistoricalIrOnly"
                value="1"
                checked={isHistoricalIrOnly}
                onChange={(e) => setIsHistoricalIrOnly(e.target.checked)}
                className="mt-0.5 accent-navy-700"
              />
              <div className="text-[12.5px] leading-relaxed">
                <span className="font-medium text-foreground">
                  Histórica — só pra declaração IR
                </span>
                <span className="block text-faint-foreground text-[11.5px] mt-0.5">
                  Marca este lançamento como já ocorrido na vida real. Aparece nos
                  relatórios do IR mas <b>não</b> mexe no saldo nem entra em
                  gráficos/sobra mensal.
                </span>
              </div>
            </label>
          ) : null}

          {/* Comprovante (PDF/foto) */}
          {!isTransfer ? (
            <ReceiptUploader
              transactionId={transaction.id}
              initialPath={transaction.receipt_storage_path}
              initialMime={transaction.receipt_mime_type}
              initialSize={transaction.receipt_size_bytes}
            />
          ) : null}

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
