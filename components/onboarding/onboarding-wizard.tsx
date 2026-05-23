"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from "@/components/goals/goal-icons";
import { runOnboarding, type OnboardingPayload } from "@/services/onboarding.actions";
import { cn } from "@/lib/utils/cn";
import type { GoalType, Tables } from "@/types/database";

type Account = Tables<"accounts">;
type Category = Tables<"categories">;

/**
 * Wizard de 4 passos:
 *  1. Contas — quais bancos/corretoras você usa
 *  2. Renda — salário(s) recorrente(s)
 *  3. Despesas fixas — aluguel, internet, etc
 *  4. Meta (opcional)
 *
 * Cada passo coleta dados em estado local. No último click executa
 * runOnboarding em uma transação só (atomicamente).
 */

// Presets pré-prontos pra o usuário escolher rápido
const PRESET_ACCOUNTS: Array<{ name: string; institution: string; type: Account["type"] }> = [
  { name: "Conta Corrente", institution: "Itaú", type: "checking" },
  { name: "Conta Corrente", institution: "Nubank", type: "checking" },
  { name: "Conta Corrente", institution: "Bradesco", type: "checking" },
  { name: "Conta Corrente", institution: "Santander", type: "checking" },
  { name: "Conta Corrente", institution: "Banco do Brasil", type: "checking" },
  { name: "Conta Corrente", institution: "Inter", type: "checking" },
  { name: "Conta Corrente", institution: "C6 Bank", type: "checking" },
  { name: "Conta Corrente", institution: "Caixa", type: "checking" },
  { name: "Cartão de crédito", institution: "Nubank", type: "credit_card" },
  { name: "Cartão de crédito", institution: "Itaú", type: "credit_card" },
  { name: "Investimentos", institution: "XP", type: "investment" },
  { name: "Investimentos", institution: "BTG", type: "investment" },
  { name: "Investimentos", institution: "Rico", type: "investment" },
  { name: "Investimentos", institution: "Avenue", type: "investment" },
  { name: "Dinheiro vivo", institution: "Carteira", type: "cash" },
];

const PRESET_EXPENSES: Array<{
  description: string;
  amount: number;
  day: number;
  categoryHint: string;
}> = [
  { description: "Aluguel / Condomínio", amount: 0, day: 5, categoryHint: "moradia" },
  { description: "Internet", amount: 110, day: 10, categoryHint: "moradia" },
  { description: "Luz", amount: 180, day: 15, categoryHint: "moradia" },
  { description: "Plano de saúde", amount: 600, day: 5, categoryHint: "saude" },
  { description: "Mercado / Compras mensais", amount: 1200, day: 1, categoryHint: "mercado" },
  { description: "Celular", amount: 80, day: 10, categoryHint: "moradia" },
];

export function OnboardingWizard({
  existingAccounts,
  existingCategories,
}: {
  existingAccounts: Account[];
  existingCategories: Category[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  // Estado por step
  const [accountsToCreate, setAccountsToCreate] = useState<
    Array<{ name: string; institution: string; type: Account["type"]; initialBalance: number }>
  >([]);
  const [incomes, setIncomes] = useState<
    Array<{ description: string; amount: number; day: number; accountIdx: number }>
  >([
    { description: "Salário", amount: 0, day: 5, accountIdx: 0 },
  ]);
  const [expenses, setExpenses] = useState<
    Array<{ description: string; amount: number; day: number; accountIdx: number; categoryHint: string }>
  >([]);
  const [goal, setGoal] = useState<{
    enabled: boolean;
    type: GoalType;
    name: string;
    targetAmount: number;
    currency: "BRL" | "EUR" | "USD";
    targetDate: string;
  }>({
    enabled: false,
    type: "emergencia",
    name: "Reserva de emergência",
    targetAmount: 0,
    currency: "BRL",
    targetDate: "",
  });

  const allAccountOptions = [
    ...existingAccounts.map((a) => ({
      name: a.name,
      institution: a.institution,
      type: a.type,
      isExisting: true as const,
      id: a.id,
    })),
    ...accountsToCreate.map((a, idx) => ({ ...a, isExisting: false as const, id: `new-${idx}` })),
  ];

  const handleFinish = () => {
    const payload: OnboardingPayload = {
      accounts: accountsToCreate,
      incomes: incomes
        .filter((i) => i.amount > 0 && i.description.trim().length > 0)
        .map((i) => ({
          description: i.description.trim(),
          amount: i.amount,
          day: i.day,
          accountRef: refOfIdx(i.accountIdx, existingAccounts.length),
        })),
      expenses: expenses
        .filter((e) => e.amount > 0 && e.description.trim().length > 0)
        .map((e) => ({
          description: e.description.trim(),
          amount: e.amount,
          day: e.day,
          accountRef: refOfIdx(e.accountIdx, existingAccounts.length),
          categoryHint: e.categoryHint,
        })),
      goal: goal.enabled && goal.targetAmount > 0
        ? {
            type: goal.type,
            name: goal.name.trim(),
            targetAmount: goal.targetAmount,
            currency: goal.currency,
            targetDate: goal.targetDate || undefined,
          }
        : undefined,
    };

    startTransition(async () => {
      const r = await runOnboarding(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Tudo pronto. Bem-vindo ao seu painel.");
      router.push("/dashboard");
      router.refresh();
    });
  };

  const steps = [
    { label: "Contas", done: step > 0 || existingAccounts.length + accountsToCreate.length > 0 },
    { label: "Renda", done: step > 1 || incomes.some((i) => i.amount > 0) },
    { label: "Despesas", done: step > 2 || expenses.some((e) => e.amount > 0) },
    { label: "Meta", done: step > 3 },
  ];

  return (
    <div>
      {/* Stepper visual */}
      <ol className="flex items-center gap-2 mb-7">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full grid place-items-center text-[12px] font-mono font-medium transition-colors",
                step === i
                  ? "bg-navy-700 text-white"
                  : s.done
                    ? "bg-olive-600 text-white"
                    : "bg-surface-muted text-faint-foreground",
              )}
            >
              {s.done && step !== i ? <Check className="w-3.5 h-3.5" strokeWidth={2.2} /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[13px]",
                step === i ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span className="text-faint-foreground mx-1">/</span>
            ) : null}
          </li>
        ))}
      </ol>

      {/* Conteúdo por step */}
      {step === 0 ? (
        <StepAccounts
          existingAccounts={existingAccounts}
          accountsToCreate={accountsToCreate}
          setAccountsToCreate={setAccountsToCreate}
        />
      ) : step === 1 ? (
        <StepIncomes incomes={incomes} setIncomes={setIncomes} accounts={allAccountOptions} />
      ) : step === 2 ? (
        <StepExpenses
          expenses={expenses}
          setExpenses={setExpenses}
          accounts={allAccountOptions}
          existingCategories={existingCategories}
        />
      ) : (
        <StepGoal goal={goal} setGoal={setGoal} />
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
          Voltar
        </Button>
        {step < 3 ? (
          <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
            Próximo
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
          </Button>
        ) : (
          <Button variant="primary" onClick={handleFinish} disabled={pending}>
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
            {pending ? "Configurando…" : "Concluir e ir pro painel"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Referência ao slot do account no payload — "existing-<id>" ou "new-<idx>" */
function refOfIdx(idx: number, existingCount: number): string {
  if (idx < existingCount) return `existing-${idx}`;
  return `new-${idx - existingCount}`;
}

/* ---------------------------- STEPS --------------------------- */

function StepAccounts({
  existingAccounts,
  accountsToCreate,
  setAccountsToCreate,
}: {
  existingAccounts: Account[];
  accountsToCreate: Array<{
    name: string;
    institution: string;
    type: Account["type"];
    initialBalance: number;
  }>;
  setAccountsToCreate: React.Dispatch<
    React.SetStateAction<
      Array<{
        name: string;
        institution: string;
        type: Account["type"];
        initialBalance: number;
      }>
    >
  >;
}) {
  const [showPicker, setShowPicker] = useState(true);

  const addFromPreset = (p: (typeof PRESET_ACCOUNTS)[number]) => {
    setAccountsToCreate((arr) => [...arr, { ...p, initialBalance: 0 }]);
  };
  const addCustom = () => {
    setAccountsToCreate((arr) => [
      ...arr,
      { name: "", institution: "", type: "checking", initialBalance: 0 },
    ]);
  };
  const removeAt = (i: number) => {
    setAccountsToCreate((arr) => arr.filter((_, idx) => idx !== i));
  };
  const updateAt = (i: number, patch: Partial<(typeof accountsToCreate)[number]>) => {
    setAccountsToCreate((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Quais contas você usa?
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Conta corrente, cartão de crédito, corretora — todos os endereços onde
        seu dinheiro mora. Pode adicionar mais depois em <code>/contas</code>.
      </p>

      {existingAccounts.length > 0 ? (
        <div className="mb-5 rounded-[8px] bg-surface-muted px-4 py-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-2">
            Já cadastradas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {existingAccounts.map((a) => (
              <Badge key={a.id} tone="navy">
                {a.name} · {a.institution}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {showPicker && accountsToCreate.length < 5 ? (
        <div className="mb-5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-2">
            Adição rápida — clique nos seus bancos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_ACCOUNTS.map((p) => (
              <button
                key={`${p.name}-${p.institution}`}
                type="button"
                onClick={() => addFromPreset(p)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[7px] border border-border-strong bg-surface text-[12px] text-foreground hover:bg-surface-muted transition-colors"
              >
                + {p.institution}
                <span className="text-faint-foreground text-[10.5px]">
                  · {labelForType(p.type)}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={addCustom}>
              + outra conta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPicker(false)}>
              esconder presets
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowPicker(true)} className="mb-4">
          + adicionar mais
        </Button>
      )}

      {accountsToCreate.length === 0 ? (
        <p className="text-[12.5px] text-faint-foreground italic">
          Nenhuma conta selecionada ainda — clique nos seus bancos acima.
        </p>
      ) : (
        <ul className="space-y-2">
          {accountsToCreate.map((a, i) => (
            <li
              key={i}
              className="rounded-[8px] border border-border bg-surface p-3 grid grid-cols-[1fr_1fr_120px_140px_auto] gap-2 items-center"
            >
              <Input
                placeholder="Nome"
                value={a.name}
                onChange={(e) => updateAt(i, { name: e.target.value })}
              />
              <Input
                placeholder="Instituição"
                value={a.institution}
                onChange={(e) => updateAt(i, { institution: e.target.value })}
              />
              <Select
                value={a.type}
                onValueChange={(v) => updateAt(i, { type: v as Account["type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="credit_card">Cartão</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
              <MoneyInput
                name={`balance-${i}`}
                defaultValue={a.initialBalance}
                onValueChange={(v) => updateAt(i, { initialBalance: v })}
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-faint-foreground hover:text-rust-600 text-[12px]"
                aria-label="Remover"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepIncomes({
  incomes,
  setIncomes,
  accounts,
}: {
  incomes: Array<{ description: string; amount: number; day: number; accountIdx: number }>;
  setIncomes: React.Dispatch<
    React.SetStateAction<
      Array<{ description: string; amount: number; day: number; accountIdx: number }>
    >
  >;
  accounts: Array<{ name: string; institution: string; type: Account["type"]; id: string }>;
}) {
  const addRow = () => {
    setIncomes((arr) => [
      ...arr,
      { description: "Outra renda", amount: 0, day: 5, accountIdx: 0 },
    ]);
  };
  const removeAt = (i: number) => {
    setIncomes((arr) => arr.filter((_, idx) => idx !== i));
  };
  const updateAt = (
    i: number,
    patch: Partial<(typeof incomes)[number]>,
  ) => {
    setIncomes((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  if (accounts.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic">
        Adicione pelo menos uma conta no passo anterior pra cadastrar rendas.
      </p>
    );
  }

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Sua renda mensal
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Salário, freelance, aluguel recebido. Cada um vira uma recorrência —
        cai sozinho todo mês no dia que vc informar.
      </p>

      <ul className="space-y-2">
        {incomes.map((i, idx) => (
          <li
            key={idx}
            className="rounded-[8px] border border-border bg-surface p-3 grid grid-cols-[1.5fr_1fr_70px_1.5fr_auto] gap-2 items-center"
          >
            <Input
              placeholder="Salário Marcelo"
              value={i.description}
              onChange={(e) => updateAt(idx, { description: e.target.value })}
            />
            <MoneyInput
              name={`income-${idx}`}
              defaultValue={i.amount}
              onValueChange={(v) => updateAt(idx, { amount: v })}
            />
            <Input
              type="number"
              min={1}
              max={31}
              value={i.day}
              onChange={(e) =>
                updateAt(idx, { day: Math.max(1, Math.min(31, Number(e.target.value))) })
              }
              title="Dia do mês"
            />
            <Select
              value={String(i.accountIdx)}
              onValueChange={(v) => updateAt(idx, { accountIdx: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a, ai) => (
                  <SelectItem key={a.id} value={String(ai)}>
                    {a.name} · {a.institution}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="text-faint-foreground hover:text-rust-600 text-[12px]"
              aria-label="Remover"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" onClick={addRow} className="mt-3">
        + outra renda
      </Button>
    </div>
  );
}

function StepExpenses({
  expenses,
  setExpenses,
  accounts,
  existingCategories,
}: {
  expenses: Array<{
    description: string;
    amount: number;
    day: number;
    accountIdx: number;
    categoryHint: string;
  }>;
  setExpenses: React.Dispatch<
    React.SetStateAction<
      Array<{
        description: string;
        amount: number;
        day: number;
        accountIdx: number;
        categoryHint: string;
      }>
    >
  >;
  accounts: Array<{ name: string; institution: string; type: Account["type"]; id: string }>;
  existingCategories: Category[];
}) {
  void existingCategories;

  const addPreset = (p: (typeof PRESET_EXPENSES)[number]) => {
    setExpenses((arr) => [...arr, { ...p, accountIdx: 0 }]);
  };
  const addCustom = () => {
    setExpenses((arr) => [
      ...arr,
      { description: "", amount: 0, day: 10, accountIdx: 0, categoryHint: "moradia" },
    ]);
  };
  const removeAt = (i: number) => {
    setExpenses((arr) => arr.filter((_, idx) => idx !== i));
  };
  const updateAt = (
    i: number,
    patch: Partial<(typeof expenses)[number]>,
  ) => {
    setExpenses((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  if (accounts.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic">
        Adicione pelo menos uma conta no passo anterior.
      </p>
    );
  }

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Despesas fixas do mês
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Aluguel, internet, mercado, plano de saúde. As que repetem todo mês.
        Pode pular e fazer depois em <code>/recorrentes</code>.
      </p>

      <div className="mb-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-2">
          Sugestões comuns
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_EXPENSES.map((p) => (
            <button
              key={p.description}
              type="button"
              onClick={() => addPreset(p)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[7px] border border-border-strong bg-surface text-[12px] text-foreground hover:bg-surface-muted transition-colors"
            >
              + {p.description}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={addCustom}>
            + outra
          </Button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <p className="text-[12.5px] text-faint-foreground italic">
          Sem despesas selecionadas. Pode pular ou clicar nas sugestões.
        </p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e, idx) => (
            <li
              key={idx}
              className="rounded-[8px] border border-border bg-surface p-3 grid grid-cols-[1.5fr_1fr_70px_1.5fr_auto] gap-2 items-center"
            >
              <Input
                placeholder="Descrição"
                value={e.description}
                onChange={(ev) => updateAt(idx, { description: ev.target.value })}
              />
              <MoneyInput
                name={`exp-${idx}`}
                defaultValue={e.amount}
                onValueChange={(v) => updateAt(idx, { amount: v })}
              />
              <Input
                type="number"
                min={1}
                max={31}
                value={e.day}
                onChange={(ev) =>
                  updateAt(idx, { day: Math.max(1, Math.min(31, Number(ev.target.value))) })
                }
                title="Dia do mês"
              />
              <Select
                value={String(e.accountIdx)}
                onValueChange={(v) => updateAt(idx, { accountIdx: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a, ai) => (
                    <SelectItem key={a.id} value={String(ai)}>
                      {a.name} · {a.institution}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="text-faint-foreground hover:text-rust-600 text-[12px]"
                aria-label="Remover"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepGoal({
  goal,
  setGoal,
}: {
  goal: {
    enabled: boolean;
    type: GoalType;
    name: string;
    targetAmount: number;
    currency: "BRL" | "EUR" | "USD";
    targetDate: string;
  };
  setGoal: React.Dispatch<React.SetStateAction<typeof goal>>;
}) {
  const GOAL_TYPES_ORDER: GoalType[] = [
    "emergencia",
    "casa",
    "veiculo",
    "viagem",
    "aposentadoria",
    "educacao",
    "projeto",
    "outro",
  ];

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Uma meta pra começar?
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Opcional. Você pode definir agora ou em <code>/metas</code>. Reserva de
        emergência é o ponto de partida clássico — 6 meses de despesa fixa.
      </p>

      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={goal.enabled}
          onChange={(e) => setGoal({ ...goal, enabled: e.target.checked })}
          className="accent-navy-700"
        />
        <span className="text-[13px] text-foreground">Quero definir uma meta agora</span>
      </label>

      {goal.enabled ? (
        <div className="space-y-4 rounded-[10px] border border-border bg-surface-muted/40 p-4">
          <Field label="Tipo" htmlFor="onb-goal-type">
            <Select
              value={goal.type}
              onValueChange={(v) => setGoal({ ...goal, type: v as GoalType })}
            >
              <SelectTrigger id="onb-goal-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {GOAL_TYPE_ICONS[t]} {GOAL_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Nome" htmlFor="onb-goal-name" required>
            <Input
              id="onb-goal-name"
              value={goal.name}
              onChange={(e) => setGoal({ ...goal, name: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-[1fr_100px_1fr] gap-3">
            <Field label="Valor" htmlFor="onb-goal-target" required>
              <MoneyInput
                name="onb-goal-target"
                currency={goal.currency}
                defaultValue={goal.targetAmount}
                onValueChange={(v) => setGoal({ ...goal, targetAmount: v })}
              />
            </Field>
            <Field label="Moeda" htmlFor="onb-goal-currency">
              <Select
                value={goal.currency}
                onValueChange={(v) => setGoal({ ...goal, currency: v as "BRL" | "EUR" | "USD" })}
              >
                <SelectTrigger id="onb-goal-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ BRL</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="USD">US$ USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data alvo" htmlFor="onb-goal-date" hint="Opcional">
              <Input
                id="onb-goal-date"
                type="date"
                value={goal.targetDate}
                onChange={(e) => setGoal({ ...goal, targetDate: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function labelForType(t: Account["type"]): string {
  if (t === "checking") return "corrente";
  if (t === "savings") return "poupança";
  if (t === "credit_card") return "cartão";
  if (t === "investment") return "corretora";
  return "dinheiro";
}
