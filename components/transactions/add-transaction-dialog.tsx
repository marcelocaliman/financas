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
import type { Tables } from "@/types/database";
import { ChevronDown, ChevronUp } from "lucide-react";

type TxKind = "expense" | "income" | "transfer";
type Currency = "BRL" | "EUR" | "USD" | "GBP";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };
type FonteLite = Pick<Tables<"fontes_pagadoras">, "id" | "name" | "type" | "cnpj" | "cpf" | "default_irrf_rate" | "default_inss_rate">;
type DebtLite = { id: string; description: string; current_balance: number };

const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: "R$",
  EUR: "€",
  USD: "US$",
  GBP: "£",
};

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

type TripLite = { id: string; name: string; destination: string };

export function AddTransactionDialog({
  accounts,
  categories,
  fontes = [],
  debts = [],
  trips = [],
}: {
  accounts: AccountLite[];
  categories: CategoryLite[];
  fontes?: FonteLite[];
  debts?: DebtLite[];
  trips?: TripLite[];
}) {
  const { open, defaultKind, hide } = useQuickAdd();
  const [kind, setKind] = useState<TxKind>(defaultKind);
  const [accountId, setAccountId] = useState<string>("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [debtId, setDebtId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [showIR, setShowIR] = useState(false);
  const [fontePagadoraId, setFontePagadoraId] = useState<string>("");
  const [irrfAmount, setIrrfAmount] = useState<number>(0);
  const [inssAmount, setInssAmount] = useState<number>(0);
  const [isHistoricalIrOnly, setIsHistoricalIrOnly] = useState<boolean>(false);
  const [excludeFromIr, setExcludeFromIr] = useState<boolean>(false);
  const [tripId, setTripId] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  // Quando muda a conta, ajusta a moeda default da transação pra moeda dela.
  const accountCurrency = (accounts.find((a) => a.id === accountId)?.currency ?? "BRL") as Currency;
  const [prevAccountId, setPrevAccountId] = useState(accountId);
  if (accountId !== prevAccountId) {
    setPrevAccountId(accountId);
    setCurrency(accountCurrency);
  }

  // Transferência entre contas de moedas diferentes não é convertida pela RPC
  // create_transfer (debita e credita o mesmo número), então avisamos o usuário.
  const fromCurrency = accounts.find((a) => a.id === fromAccountId)?.currency;
  const toCurrency = accounts.find((a) => a.id === toAccountId)?.currency;
  const crossCurrencyTransfer =
    kind === "transfer" &&
    !!fromCurrency &&
    !!toCurrency &&
    fromCurrency !== toCurrency;

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
      setDebtId("");
      setPaymentMethod("");
      setShowIR(false);
      setFontePagadoraId("");
      setIrrfAmount(0);
      setInssAmount(0);
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
          description="Atalho: ⌘K abre, ⌘+Enter salva."
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

            <div className="grid grid-cols-[1fr_92px] gap-2 items-end">
              <Field htmlFor="amount" label="Valor">
                <MoneyInput name="amount" id="amount" autoFocus size="lg" />
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
                    <SelectItem value="BRL">{CURRENCY_LABELS.BRL} BRL</SelectItem>
                    <SelectItem value="EUR">{CURRENCY_LABELS.EUR} EUR</SelectItem>
                    <SelectItem value="USD">{CURRENCY_LABELS.USD} USD</SelectItem>
                    <SelectItem value="GBP">{CURRENCY_LABELS.GBP} GBP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {kind !== "transfer" && currency !== accountCurrency ? (
              <p className="text-[11.5px] text-muted-foreground -mt-3 font-mono">
                Conta em {accountCurrency} · vamos converter pra essa moeda automaticamente.
              </p>
            ) : null}

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
                {crossCurrencyTransfer ? (
                  <p className="text-[11.5px] text-gold-700 dark:text-gold-500 bg-gold-100/50 dark:bg-gold-700/15 border border-gold-600/30 rounded-[6px] px-2.5 py-2">
                    ⚠ As contas têm moedas diferentes ({fromCurrency} → {toCurrency}). A
                    transferência <b>não</b> aplica câmbio — o mesmo número será debitado
                    e creditado. Para conversão real, registre uma despesa na origem e uma
                    receita no destino.
                  </p>
                ) : null}
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

            {/* Vincular a dívida — só pra expense, quando há dívidas ativas */}
            {kind === "expense" && debts.length > 0 ? (
              <Field
                label="Vincular a dívida"
                htmlFor="debtId"
                hint="Reduz o saldo da dívida automaticamente quando paga"
              >
                {/* Submete string vazia quando "__none" — action trata como null */}
                <input type="hidden" name="debtId" value={debtId === "__none" ? "" : debtId} />
                <Select
                  value={debtId || "__none"}
                  onValueChange={(v) => setDebtId(v === "__none" ? "" : v)}
                >
                  <SelectTrigger id="debtId">
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
            {kind === "income" && fontes.length > 0 ? (
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
                    <Field label="Fonte pagadora" htmlFor="fonte" hint="Só empresas que pagam VOCÊ (salário, aluguel, dividendos). Médicos e planos de saúde não entram aqui.">
                      <Select
                        value={fontePagadoraId}
                        onValueChange={setFontePagadoraId}
                      >
                        <SelectTrigger id="fonte"><SelectValue placeholder="— escolher" /></SelectTrigger>
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
                      <Field label="IRRF retido" htmlFor="irrf-input">
                        <MoneyInput
                          name="irrf-input"
                          defaultValue={0}
                          onValueChange={setIrrfAmount}
                        />
                      </Field>
                      <Field label="INSS" htmlFor="inss-input">
                        <MoneyInput
                          name="inss-input"
                          defaultValue={0}
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

            {/* Vincular a viagem — apenas income/expense, pula transfer */}
            {kind !== "transfer" && trips.length > 0 ? (
              <Field label="Viagem (opcional)" htmlFor="tripId" hint="Vincula a tx ao orçamento da viagem">
                <input type="hidden" name="tripId" value={tripId} />
                <Select
                  value={tripId || "__none"}
                  onValueChange={(v) => setTripId(v === "__none" ? "" : v)}
                >
                  <SelectTrigger id="tripId">
                    <SelectValue placeholder="— Sem viagem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sem viagem</SelectItem>
                    {trips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        ✈ {t.name} — {t.destination}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {/* Não declarar no IRPF — só pra income (receitas isentas, presentes, reembolsos, etc.) */}
            {kind === "income" ? (
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

            {/* Histórica IR — só pra income/expense; pula em transfer */}
            {kind !== "transfer" ? (
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
                    Marca esta {kind === "income" ? "receita" : "despesa"} como já ocorrida na vida real
                    (saldo da conta já reflete). Aparece nos relatórios do IR mas{" "}
                    <b>não</b> mexe no saldo nem entra em gráficos/sobra mensal.
                  </span>
                </div>
              </label>
            ) : null}

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
