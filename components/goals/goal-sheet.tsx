"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
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
import { CURRENCY_SYMBOLS } from "@/lib/financial/currency";
import { computeFinancing, getFinancingDefaults } from "@/lib/financial/mortgage";
import { formatMoney } from "@/lib/utils/format";
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
  { value: "fixed_amount", label: "Valor fixo/mês", hint: "Valor mensal definido" },
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
  const [trackingStartsAt, setTrackingStartsAt] = useState<string>(
    goal?.tracking_starts_at ?? "",
  );
  const [priority, setPriority] = useState<string>(
    goal?.priority ? String(goal.priority) : "100",
  );
  // Financiamento (opcional) — quando ON, target_amount é recalculado
  // automaticamente como propertyPrice × (downPct + closingPct).
  // Defaults dependem da moeda: BRL→Caixa SBPE (SAC, 5% custos),
  // EUR→Itália (Price, 10% custos), USD→genérico (Price, 4% custos).
  const initialDefaults = getFinancingDefaults(goal?.currency ?? "BRL");
  const [isFinanced, setIsFinanced] = useState<boolean>(
    goal?.property_price != null,
  );
  const [propertyPrice, setPropertyPrice] = useState<number>(
    Number(goal?.property_price ?? 0),
  );
  const [downPct, setDownPct] = useState<number>(
    Number(goal?.property_down_pct ?? initialDefaults.downPct),
  );
  const [closingPct, setClosingPct] = useState<number>(
    Number(goal?.property_closing_pct ?? initialDefaults.closingPct),
  );
  const [loanTermMonths, setLoanTermMonths] = useState<string>(
    goal?.loan_term_months
      ? String(goal.loan_term_months)
      : String(initialDefaults.loanTermMonths),
  );
  const [loanAnnualRatePct, setLoanAnnualRatePct] = useState<string>(
    goal?.loan_annual_rate_pct
      ? String(goal.loan_annual_rate_pct)
      : String(initialDefaults.loanAnnualRatePct),
  );
  const [loanSystem, setLoanSystem] = useState<"sac" | "price">(
    (goal?.loan_system as "sac" | "price") ?? initialDefaults.loanSystem,
  );
  // Progressive disclosure: a config de aporte mensal (modo, prioridade, dia,
  // waterfall) tem defaults sensatos — fica escondida até o usuário pedir.
  // Abre automático ao editar uma meta que já tem aporte configurado.
  const [showContribution, setShowContribution] = useState<boolean>(
    !!(goal?.allocation_mode && goal.allocation_mode !== "manual") ||
      !!goal?.contribution_day ||
      Number(goal?.allocation_value ?? 0) > 0,
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
      setTrackingStartsAt(goal?.tracking_starts_at ?? "");
      setPriority(goal?.priority ? String(goal.priority) : "100");
      const d = getFinancingDefaults(goal?.currency ?? "BRL");
      setIsFinanced(goal?.property_price != null);
      setPropertyPrice(Number(goal?.property_price ?? 0));
      setDownPct(Number(goal?.property_down_pct ?? d.downPct));
      setClosingPct(Number(goal?.property_closing_pct ?? d.closingPct));
      setLoanTermMonths(
        goal?.loan_term_months ? String(goal.loan_term_months) : String(d.loanTermMonths),
      );
      setLoanAnnualRatePct(
        goal?.loan_annual_rate_pct
          ? String(goal.loan_annual_rate_pct)
          : String(d.loanAnnualRatePct),
      );
      setLoanSystem((goal?.loan_system as "sac" | "price") ?? d.loanSystem);
      setShowContribution(
        !!(goal?.allocation_mode && goal.allocation_mode !== "manual") ||
          !!goal?.contribution_day ||
          Number(goal?.allocation_value ?? 0) > 0,
      );
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

  // Quando o usuário troca a moeda da meta, aplica os defaults regionais
  // (BR/IT/US) — mas APENAS se o financiamento ainda não foi ligado, pra
  // não sobrescrever valores que o usuário já customizou.
  useEffect(() => {
    if (isFinanced) return;
    const d = getFinancingDefaults(currency);
    setDownPct(d.downPct);
    setClosingPct(d.closingPct);
    setLoanTermMonths(String(d.loanTermMonths));
    setLoanAnnualRatePct(String(d.loanAnnualRatePct));
    setLoanSystem(d.loanSystem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  // Breakdown do financiamento (calculado em real-time quando isFinanced=true)
  const financing = isFinanced
    ? computeFinancing({
        propertyPrice,
        downPct,
        closingPct,
        loanTermMonths: Number(loanTermMonths) || 360,
        loanAnnualRatePct: Number(loanAnnualRatePct) || 0,
        loanSystem,
      })
    : null;

  // Quando financiamento ON, o target_amount é o que precisa poupar (entrada + custos).
  // O input de "Valor da meta" fica disabled e exibe esse valor calculado.
  // Ao DESLIGAR o financiamento de uma meta que era financiada, não herda o
  // totalToSave antigo salvo em target_amount (senão o "Valor da meta" ficaria
  // com o valor do financiamento anterior sem o usuário perceber) — zera pra
  // ele definir um alvo real. Meta nunca-financiada preserva o target.
  const wasFinanced = goal?.property_price != null;
  const effectiveTargetAmount =
    isFinanced && financing
      ? financing.totalToSave
      : wasFinanced
        ? 0
        : Number(goal?.target_amount ?? 0);

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

          {/* VALOR DA META + DATA */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor da meta"
              htmlFor="targetAmount"
              required
              hint={
                isFinanced
                  ? "Calculado automaticamente (entrada + custos) na seção Financiamento"
                  : undefined
              }
            >
              <MoneyInput
                // Remount quando muda entre normal/financiado pra refletir o effectiveTargetAmount
                key={`tgt-${isFinanced ? "fin" : "nor"}-${effectiveTargetAmount}`}
                name="targetAmount"
                id="targetAmount"
                currency={currency}
                defaultValue={effectiveTargetAmount}
                disabled={isFinanced}
              />
            </Field>
            <Field label="Data desejada" htmlFor="targetDate" hint="Opcional">
              <Input
                id="targetDate"
                name="targetDate"
                type="date"
                defaultValue={goal?.target_date ?? ""}
              />
            </Field>
          </div>

          {/* Conta principal (referência rápida, opcional) + currentAmount hidden
              quando há fontes vinculadas (preserva o valor antigo no banco
              sem mostrar no UI — fontes já cobrem o conceito). */}
          <Field label="Conta principal" htmlFor="linkedAccountId" hint="Referência rápida · opcional">
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
          {sources.length > 0 ? (
            <input
              type="hidden"
              name="currentAmount"
              value={Number(goal?.current_amount ?? 0)}
            />
          ) : null}

          {/* ============ FINANCIAMENTO (opcional, só pra type=casa) ============ */}
          {goalType === "casa" ? (
            <div className="rounded-[10px] border border-border bg-surface-muted/40 p-4">
              <label className="flex items-center justify-between cursor-pointer mb-1">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground font-medium">
                    Vai financiar?
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                    {currency === "EUR"
                      ? "Defaults aplicados pra Itália (mutuo casa · tasso fisso, ~3.5% a.a., 20 anos)."
                      : currency === "USD"
                        ? "Defaults aplicados pra EUA (fixed-rate mortgage, ~7% a.a., 30 anos)."
                        : "Defaults aplicados pra Brasil (Caixa SBPE · SAC, ~11.5% a.a., 30 anos)."}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isFinanced}
                  onChange={(e) => setIsFinanced(e.target.checked)}
                  className="w-4 h-4 accent-navy-700"
                />
              </label>

              {isFinanced && financing ? (
                <div className="mt-4 space-y-3">
                  <Field label={`Preço do imóvel (${CURRENCY_SYMBOLS[currency]})`} htmlFor="propertyPrice" required>
                    <MoneyInput
                      name="propertyPrice"
                      id="propertyPrice"
                      currency={currency}
                      defaultValue={propertyPrice}
                      onValueChange={setPropertyPrice}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Entrada (%)" htmlFor="propertyDownPctInput" hint={`${formatMoney(financing.downPayment, currency)}`}>
                      <Input
                        id="propertyDownPctInput"
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={Math.round(downPct * 100)}
                        onChange={(e) => setDownPct(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
                      />
                      <input type="hidden" name="propertyDownPct" value={downPct} />
                    </Field>
                    <Field
                      label={
                        currency === "EUR"
                          ? "Notaio + impostas (%)"
                          : currency === "USD"
                            ? "Closing costs (%)"
                            : "Custos cartório/ITBI (%)"
                      }
                      htmlFor="propertyClosingPctInput"
                      hint={`${formatMoney(financing.closingCosts, currency)}`}
                    >
                      <Input
                        id="propertyClosingPctInput"
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={Number((closingPct * 100).toFixed(2))}
                        onChange={(e) => setClosingPct(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
                      />
                      <input type="hidden" name="propertyClosingPct" value={closingPct} />
                    </Field>
                  </div>

                  {/* Destaque do total a poupar */}
                  <div className="rounded-[8px] border border-olive-600/30 bg-olive-50 dark:bg-olive-700/10 px-4 py-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-olive-700 dark:text-olive-500 font-medium">
                      A poupar (entrada + custos)
                    </div>
                    <div className="font-mono text-[18px] tabular-nums text-foreground mt-0.5">
                      {formatMoney(financing.totalToSave, currency)}
                      <span className="text-faint-foreground text-[11px] ml-2">vira o target da meta</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prazo (meses)" htmlFor="loanTermMonths" hint={`${Math.round(Number(loanTermMonths) / 12)} anos · ex: 240, 360`}>
                      <Input
                        id="loanTermMonths"
                        name="loanTermMonths"
                        type="number"
                        min={1}
                        max={600}
                        step="any"
                        value={loanTermMonths}
                        onChange={(e) => setLoanTermMonths(e.target.value)}
                      />
                    </Field>
                    <Field label="Juros (% a.a.)" htmlFor="loanAnnualRatePct" hint="Nominal anual">
                      <Input
                        id="loanAnnualRatePct"
                        name="loanAnnualRatePct"
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={loanAnnualRatePct}
                        onChange={(e) => setLoanAnnualRatePct(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field
                    label={
                      currency === "EUR"
                        ? "Tipo de tasso"
                        : currency === "USD"
                          ? "Mortgage type"
                          : "Sistema de amortização"
                    }
                    htmlFor="loanSystem"
                    hint={
                      currency === "EUR"
                        ? "Itália: tasso fisso = parcela igual todo mês (padrão mutuo casa)"
                        : currency === "USD"
                          ? "USA: fixed-rate mortgage = parcela igual todo mês (padrão)"
                          : "Brasil habitacional: SAC é o padrão da Caixa"
                    }
                  >
                    <Select
                      value={loanSystem}
                      onValueChange={(v) => setLoanSystem(v as "sac" | "price")}
                      name="loanSystem"
                    >
                      <SelectTrigger id="loanSystem">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Labels e ordem dependem da moeda — termo regional vem primeiro */}
                        {currency === "BRL" ? (
                          <>
                            <SelectItem value="sac">
                              SAC <span className="text-faint-foreground ml-1.5 text-[11.5px]">· parcela decrescente</span>
                            </SelectItem>
                            <SelectItem value="price">
                              Tabela Price <span className="text-faint-foreground ml-1.5 text-[11.5px]">· parcela constante</span>
                            </SelectItem>
                          </>
                        ) : currency === "EUR" ? (
                          <>
                            <SelectItem value="price">
                              Tasso fisso <span className="text-faint-foreground ml-1.5 text-[11.5px]">· parcela constante (rata costante)</span>
                            </SelectItem>
                            <SelectItem value="sac">
                              Quota capitale costante <span className="text-faint-foreground ml-1.5 text-[11.5px]">· parcela decrescente (raro na Itália)</span>
                            </SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="price">
                              Fixed-rate <span className="text-faint-foreground ml-1.5 text-[11.5px]">· equal monthly payments</span>
                            </SelectItem>
                            <SelectItem value="sac">
                              Constant amortization <span className="text-faint-foreground ml-1.5 text-[11.5px]">· decreasing payments (rare in US)</span>
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Resumo do financiamento */}
                  <div className="rounded-[8px] border border-border bg-surface px-4 py-3 text-[12.5px] font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor financiado</span>
                      <span className="text-foreground tabular-nums">{formatMoney(financing.loanAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {loanSystem === "sac" ? "Primeira parcela (maior)" : "Parcela mensal"}
                      </span>
                      <span className="text-rust-600 font-medium tabular-nums">
                        {formatMoney(financing.firstPayment, currency)}
                      </span>
                    </div>
                    {loanSystem === "sac" ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última parcela (menor)</span>
                        <span className="text-foreground tabular-nums">{formatMoney(financing.lastPayment, currency)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between pt-1 border-t border-border">
                      <span className="text-muted-foreground">Juros totais</span>
                      <span className="text-rust-600 tabular-nums">
                        {formatMoney(financing.totalInterest, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo total (preço + juros)</span>
                      <span className="text-foreground font-medium tabular-nums">{formatMoney(financing.totalCost, currency)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ============ SEÇÃO 1: QUANTO JÁ TENHO ============ */}
          <div className="rounded-[10px] border border-border bg-surface-muted/40 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground font-medium">
                  Quanto já tenho
                </h4>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                  Vincule contas/investimentos reais (o valor cresce sozinho) ou
                  registre um saldo guardado sem vinculação.
                </p>
              </div>
            </div>

            {sources.length === 0 ? (
              <div className="my-3">
                <Field
                  label="Saldo já guardado"
                  htmlFor="currentAmount"
                  hint="Sem fonte vinculada · vc atualiza manualmente conforme aporta"
                >
                  <MoneyInput
                    name="currentAmount"
                    id="currentAmount"
                    currency={currency}
                    defaultValue={Number(goal?.current_amount ?? 0)}
                  />
                </Field>
              </div>
            ) : (
              <ul className="space-y-3 my-3">
                {sources.map((s, idx) => (
                  <li
                    key={s.id}
                    className="rounded-[8px] bg-surface border border-border p-3 relative"
                  >
                    <Tooltip content="Remover fonte vinculada">
                      <button
                        type="button"
                        onClick={() => removeSource(s.id)}
                        className="absolute top-2 right-2 text-faint-foreground hover:text-rust-600 transition-colors"
                        aria-label="Remover fonte"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                      </button>
                    </Tooltip>
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
                            { value: "amount", label: "Valor fixo" },
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
                          step="any"
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

          {/* ============ SEÇÃO 2: QUANTO VOU APORTAR (opcional) ============ */}
          <button
            type="button"
            onClick={() => setShowContribution((v) => !v)}
            className="w-full flex items-center justify-between py-2 text-[12.5px] text-muted-foreground hover:text-foreground border-t border-border"
          >
            <span>Configurar aporte mensal · modo, prioridade, dia <span className="text-faint-foreground">(opcional)</span></span>
            {showContribution ? (
              <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.7} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.7} />
            )}
          </button>
          <div className={showContribution ? "" : "hidden"}>
          <div className="rounded-[10px] border border-border bg-surface-muted/40 p-4">
            <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground font-medium mb-2">
              Quanto vou aportar
            </h4>
            <p className="text-[11.5px] text-muted-foreground mb-3 leading-relaxed">
              Define a contribuição mensal. Drives o waterfall (quando aplicável) e
              pré-preenche os lembretes de aporte.
            </p>
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
                <Field
                  label={`${CURRENCY_SYMBOLS[currency]} por mês`}
                  htmlFor="allocationValue"
                  hint="Drives o waterfall + pré-preenche o lembrete mensal"
                >
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
                <Field
                  label="% da sobra mensal"
                  htmlFor="allocationValue"
                  hint="Drives o waterfall (valor variável por mês)"
                >
                  <Input
                    id="allocationValue"
                    name="allocationValue"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={Math.round(allocationValue * 100)}
                    onChange={(e) => setAllocationValue(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
                  />
                </Field>
              </div>
            ) : (
              // Modos manual e waterfall: campo opcional só pra prefill dos lembretes
              <div className="mt-3">
                <Field
                  label={`Valor sugerido por mês (${CURRENCY_SYMBOLS[currency]})`}
                  htmlFor="allocationValue"
                  hint="Opcional · só pré-preenche o lembrete mensal. Não afeta o waterfall."
                >
                  <MoneyInput
                    name="allocationValue"
                    id="allocationValue"
                    currency={currency}
                    defaultValue={allocationValue}
                    onValueChange={setAllocationValue}
                  />
                </Field>
              </div>
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

            {/* Tracking start — só faz sentido quando há dia de aporte definido */}
            {contributionDay ? (
              <div className="mt-3">
                <Field
                  label="Lembretes a partir de"
                  htmlFor="trackingStartsAt"
                  hint="Opcional · default = data de criação da meta. Use pra pausar/retomar ou cadastrar metas backdatadas."
                >
                  <Input
                    id="trackingStartsAt"
                    name="trackingStartsAt"
                    type="date"
                    value={trackingStartsAt}
                    onChange={(e) => setTrackingStartsAt(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </div>
          </div>
          {/* ── fim aporte mensal ── */}

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
