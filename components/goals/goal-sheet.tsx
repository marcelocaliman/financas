"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PillGroup } from "@/components/ui/pill-group";
import {
  createGoal,
  updateGoal,
  type GoalFormState,
} from "@/services/goals.actions";
import type { Goal, EnrichedGoal } from "@/services/goals";
import type { Currency, GoalAllocationMode, GoalSourceType, GoalType } from "@/types/database";
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS, GOAL_TYPE_DESCRIPTIONS } from "./goal-icons";

type AccountLite = { id: string; name: string; institution: string };
type InvestmentLite = { id: string; ticker: string; name: string };

const CURRENCIES: { value: Currency; label: string; hint: string }[] = [
  { value: "BRL", label: "R$ · Real", hint: "Brasil" },
  { value: "EUR", label: "€ · Euro", hint: "Itália, Espanha, França…" },
  { value: "USD", label: "US$ · Dólar", hint: "Estados Unidos" },
];

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

const ALLOCATION_MODES: { value: GoalAllocationMode; label: string; hint: string }[] = [
  { value: "manual", label: "Manual", hint: "Você decide quando aportar" },
  { value: "fixed_amount", label: "R$ fixo/mês", hint: "Valor mensal definido" },
  { value: "percentage", label: "% da sobra", hint: "Fração da sobra média" },
  { value: "waterfall", label: "Cascata", hint: "O que sobrar das prioritárias" },
];

type SourceDraft = {
  id: string; // ID local pra controle de UI (não persiste)
  sourceType: GoalSourceType;
  sourceId?: string;
  allocatedAmount?: number;
  allocatedPct?: number;
  notes?: string;
};

export function GoalSheet({
  open,
  onOpenChange,
  goal,
  accounts,
  investments = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goal?: (Goal | EnrichedGoal) | null;
  accounts: AccountLite[];
  investments?: InvestmentLite[];
}) {
  const isEdit = !!goal;
  const enriched = goal && "sources" in goal ? (goal as EnrichedGoal) : null;

  const [linkedAccount, setLinkedAccount] = useState(goal?.linked_account_id ?? "");
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? "BRL");
  const [goalType, setGoalType] = useState<GoalType>(goal?.goal_type ?? "outro");
  const [allocationMode, setAllocationMode] = useState<GoalAllocationMode>(
    goal?.allocation_mode ?? "manual",
  );
  const [allocationValue, setAllocationValue] = useState<number>(
    Number(goal?.allocation_value ?? 0),
  );
  const [contributionDay, setContributionDay] = useState<string>(
    goal?.contribution_day ? String(goal.contribution_day) : "",
  );
  const [priority, setPriority] = useState<string>(
    goal?.priority ? String(goal.priority) : "100",
  );
  const [sources, setSources] = useState<SourceDraft[]>(() =>
    enriched
      ? enriched.sources.map((s) => ({
          id: s.id,
          sourceType: s.source_type,
          sourceId: s.source_id ?? undefined,
          allocatedAmount: s.allocated_amount != null ? Number(s.allocated_amount) : undefined,
          allocatedPct: s.allocated_pct != null ? Number(s.allocated_pct) : undefined,
          notes: s.notes ?? undefined,
        }))
      : [],
  );

  const [state, action, pending] = useActionState<GoalFormState | undefined, FormData>(
    isEdit ? updateGoal : createGoal,
    undefined,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLinkedAccount(goal?.linked_account_id ?? "");
      setCurrency(goal?.currency ?? "BRL");
      setGoalType(goal?.goal_type ?? "outro");
      setAllocationMode(goal?.allocation_mode ?? "manual");
      setAllocationValue(Number(goal?.allocation_value ?? 0));
      setContributionDay(goal?.contribution_day ? String(goal.contribution_day) : "");
      setPriority(goal?.priority ? String(goal.priority) : "100");
      setSources(
        enriched
          ? enriched.sources.map((s) => ({
              id: s.id,
              sourceType: s.source_type,
              sourceId: s.source_id ?? undefined,
              allocatedAmount: s.allocated_amount != null ? Number(s.allocated_amount) : undefined,
              allocatedPct: s.allocated_pct != null ? Number(s.allocated_pct) : undefined,
              notes: s.notes ?? undefined,
            }))
          : [],
      );
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Meta atualizada." : "Meta criada.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  const addSource = (type: GoalSourceType) => {
    setSources((s) => [
      ...s,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sourceType: type,
        // Defaults sensatos pra satisfazer a CHECK constraint
        // (allocated_amount OR allocated_pct deve estar preenchido):
        //   account/investment → 100% do saldo da fonte (mais comum)
        //   manual → R$ 0 (user vai editar)
        ...(type === "manual"
          ? { allocatedAmount: 0 }
          : { allocatedPct: 1 }),
      },
    ]);
  };

  const removeSource = (id: string) => {
    setSources((s) => s.filter((x) => x.id !== id));
  };

  const updateSource = (id: string, patch: Partial<SourceDraft>) => {
    setSources((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const sourcesJson = JSON.stringify(
    sources.map((s) => ({
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      allocatedAmount: s.allocatedAmount,
      allocatedPct: s.allocatedPct,
      notes: s.notes,
    })),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[min(560px,calc(100vw-32px))] !sm:max-w-none">
        <SheetHeader
          eyebrow={isEdit ? "Editar meta" : "Nova meta"}
          title={isEdit ? "Editar meta." : "Adicionar uma meta."}
          description="Defina objetivo, vincule fontes de onde vem o valor já acumulado, e configure como ela recebe aporte mensal."
        />

        <form action={action} className="space-y-5">
          {isEdit ? <input type="hidden" name="id" value={goal.id} /> : null}
          <input type="hidden" name="sourcesJson" value={sourcesJson} />

          {/* TIPO */}
          <Field label="Tipo" htmlFor="goalType" hint={GOAL_TYPE_DESCRIPTIONS[goalType]}>
            <Select
              value={goalType}
              onValueChange={(v) => setGoalType(v as GoalType)}
              name="goalType"
            >
              <SelectTrigger id="goalType">
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

          <Field label="Nome" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={goal?.name ?? ""}
              placeholder="Casa na Itália, reserva de emergência, viagem ao Japão…"
              autoFocus
            />
            {state?.fieldErrors?.name ? (
              <p className="text-[11.5px] text-rust-600 mt-1">{state.fieldErrors.name}</p>
            ) : null}
          </Field>

          <Field label="Descrição (opcional)" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={goal?.description ?? ""}
            />
          </Field>

          {/* MOEDA */}
          <Field label="Moeda" htmlFor="currency">
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as Currency)}
              name="currency"
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                    <span className="text-faint-foreground ml-1.5 text-[11.5px]">· {c.hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* VALORES */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor da meta" htmlFor="targetAmount" required>
              <MoneyInput
                name="targetAmount"
                id="targetAmount"
                currency={currency}
                defaultValue={Number(goal?.target_amount ?? 0)}
              />
            </Field>
            <Field
              label="Snapshot manual"
              htmlFor="currentAmount"
              hint={sources.length > 0 ? "Soma com as fontes" : "Quanto já tem agora"}
            >
              <MoneyInput
                name="currentAmount"
                id="currentAmount"
                currency={currency}
                defaultValue={Number(goal?.current_amount ?? 0)}
              />
            </Field>
          </div>

          {/* DATA + CONTA LINKADA (legado) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data desejada" htmlFor="targetDate" hint="Opcional">
              <Input
                id="targetDate"
                name="targetDate"
                type="date"
                defaultValue={goal?.target_date ?? ""}
              />
            </Field>
            <Field label="Conta principal" htmlFor="linkedAccountId" hint="Referência rápida">
              <Select
                value={linkedAccount}
                onValueChange={setLinkedAccount}
                name="linkedAccountId"
              >
                <SelectTrigger id="linkedAccountId">
                  <SelectValue placeholder="—" />
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

          {/* ============ FONTES VINCULADAS ============ */}
          <div className="rounded-[10px] border border-border bg-surface-muted/40 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground font-medium">
                  Fontes vinculadas
                </h4>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                  De onde vem o &quot;já tenho&quot;. Conta/investimento real ou snapshot manual.
                  O valor atualiza sozinho conforme essas fontes crescem.
                </p>
              </div>
            </div>

            {sources.length === 0 ? (
              <p className="text-[12px] text-faint-foreground italic my-3">
                Nenhuma fonte ainda. Use os botões abaixo pra vincular.
              </p>
            ) : (
              <ul className="space-y-3 my-3">
                {sources.map((s, idx) => (
                  <li
                    key={s.id}
                    className="rounded-[8px] bg-surface border border-border p-3 relative"
                  >
                    <button
                      type="button"
                      onClick={() => removeSource(s.id)}
                      className="absolute top-2 right-2 text-faint-foreground hover:text-rust-600 transition-colors"
                      aria-label="Remover fonte"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </button>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-2">
                      Fonte #{idx + 1} · {labelOfSourceType(s.sourceType)}
                    </div>

                    {s.sourceType === "account" ? (
                      <Select
                        value={s.sourceId ?? ""}
                        onValueChange={(v) => updateSource(s.id, { sourceId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha a conta…" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} · {a.institution}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : s.sourceType === "investment" ? (
                      <Select
                        value={s.sourceId ?? ""}
                        onValueChange={(v) => updateSource(s.id, { sourceId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha o ativo…" />
                        </SelectTrigger>
                        <SelectContent>
                          {investments.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.ticker} · {inv.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="text"
                        placeholder="Descrição (ex: dinheiro guardado em espécie)"
                        value={s.notes ?? ""}
                        onChange={(e) => updateSource(s.id, { notes: e.target.value })}
                      />
                    )}

                    {/* Modo de alocação da fonte: valor fixo OU % */}
                    {s.sourceType !== "manual" ? (
                      <div className="mt-2">
                        <PillGroup
                          options={[
                            { value: "amount", label: "R$ fixo" },
                            { value: "pct", label: "% do saldo" },
                          ]}
                          value={s.allocatedPct != null ? "pct" : "amount"}
                          onChange={(v) => {
                            if (v === "pct") {
                              updateSource(s.id, {
                                allocatedAmount: undefined,
                                allocatedPct: 1,
                              });
                            } else {
                              updateSource(s.id, {
                                allocatedPct: undefined,
                                allocatedAmount: s.allocatedAmount ?? 0,
                              });
                            }
                          }}
                        />
                      </div>
                    ) : null}

                    <div className="mt-2">
                      {s.allocatedPct != null ? (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          placeholder="Porcentagem (ex: 100 = saldo inteiro)"
                          value={Math.round((s.allocatedPct ?? 0) * 100)}
                          onChange={(e) =>
                            updateSource(s.id, {
                              allocatedPct: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                            })
                          }
                        />
                      ) : (
                        <MoneyInput
                          name={`src-amount-${s.id}`}
                          currency={currency}
                          defaultValue={s.allocatedAmount ?? 0}
                          onValueChange={(v) => updateSource(s.id, { allocatedAmount: v })}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSource("account")}
              >
                <Plus className="w-3 h-3" strokeWidth={2} /> Conta
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSource("investment")}
              >
                <Plus className="w-3 h-3" strokeWidth={2} /> Investimento
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSource("manual")}
              >
                <Plus className="w-3 h-3" strokeWidth={2} /> Manual
              </Button>
            </div>
          </div>

          {/* ============ PLANO DE APORTE ============ */}
          <div className="rounded-[10px] border border-border bg-surface-muted/40 p-4">
            <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground font-medium mb-2">
              Aporte mensal
            </h4>
            <Field label="Modo" htmlFor="allocationMode" hint="Como essa meta recebe da sua sobra">
              <Select
                value={allocationMode}
                onValueChange={(v) => setAllocationMode(v as GoalAllocationMode)}
                name="allocationMode"
              >
                <SelectTrigger id="allocationMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOCATION_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                      <span className="text-faint-foreground ml-1.5 text-[11.5px]">· {m.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {allocationMode === "fixed_amount" ? (
              <div className="mt-3">
                <Field label={`R$ por mês (${currency})`} htmlFor="allocationValue">
                  <MoneyInput
                    name="allocationValue"
                    id="allocationValue"
                    currency={currency}
                    defaultValue={allocationValue}
                    onValueChange={setAllocationValue}
                  />
                </Field>
              </div>
            ) : allocationMode === "percentage" ? (
              <div className="mt-3">
                <Field label="% da sobra mensal" htmlFor="allocationValue">
                  <Input
                    id="allocationValue"
                    name="allocationValue"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(allocationValue * 100)}
                    onChange={(e) => setAllocationValue(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
                  />
                </Field>
              </div>
            ) : (
              <input type="hidden" name="allocationValue" value="" />
            )}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Prioridade" htmlFor="priority" hint="1 = topo (waterfall)">
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  min={1}
                  max={999}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </Field>
              <Field label="Dia do aporte" htmlFor="contributionDay" hint="Opcional · 1–31">
                <Input
                  id="contributionDay"
                  name="contributionDay"
                  type="number"
                  min={1}
                  max={31}
                  value={contributionDay}
                  onChange={(e) => setContributionDay(e.target.value)}
                  placeholder="Ex: 5"
                />
              </Field>
            </div>
          </div>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar meta" : "Criar meta"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function labelOfSourceType(t: GoalSourceType): string {
  if (t === "account") return "Conta";
  if (t === "investment") return "Investimento";
  return "Manual";
}
