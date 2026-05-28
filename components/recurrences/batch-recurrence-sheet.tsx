"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { createRecurringRulesBatch } from "@/services/recurrences.actions";
import type { Currency, RecurrenceFrequency, TransactionKind } from "@/types/database";
import { cn } from "@/lib/utils/cn";

type AccountLite = { id: string; name: string; institution: string; currency?: Currency };
type CategoryLite = { id: string; name: string; kind: "income" | "expense" | "transfer" };

type DraftRule = {
  uid: string;
  kind: TransactionKind;
  description: string;
  amount: number;
  currency: Currency;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string;
  paymentMethod: string;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfMonth: string;
  dayOfWeek: string;
  startDate: string;
};

const KIND_OPTIONS: PillOption<TransactionKind>[] = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transfer" },
];

const FREQUENCY_OPTIONS: PillOption<RecurrenceFrequency>[] = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

type Template = {
  label: string;
  emoji: string;
  kind: TransactionKind;
  defaultDay: number;
};

const TEMPLATES: Template[] = [
  { label: "Aluguel", emoji: "🏠", kind: "expense", defaultDay: 5 },
  { label: "Condomínio", emoji: "🏢", kind: "expense", defaultDay: 10 },
  { label: "Salário", emoji: "💼", kind: "income", defaultDay: 5 },
  { label: "Internet", emoji: "📡", kind: "expense", defaultDay: 10 },
  { label: "Energia", emoji: "💡", kind: "expense", defaultDay: 15 },
  { label: "Água", emoji: "💧", kind: "expense", defaultDay: 20 },
  { label: "Gás", emoji: "🔥", kind: "expense", defaultDay: 20 },
  { label: "Netflix", emoji: "🎬", kind: "expense", defaultDay: 15 },
  { label: "Spotify", emoji: "🎧", kind: "expense", defaultDay: 15 },
  { label: "Disney+", emoji: "🦄", kind: "expense", defaultDay: 15 },
  { label: "Plano de saúde", emoji: "❤️", kind: "expense", defaultDay: 5 },
  { label: "Escola", emoji: "📚", kind: "expense", defaultDay: 5 },
  { label: "Academia", emoji: "🏋️", kind: "expense", defaultDay: 10 },
  { label: "Celular", emoji: "📱", kind: "expense", defaultDay: 10 },
  { label: "Aporte mensal", emoji: "💰", kind: "transfer", defaultDay: 5 },
  { label: "Dividendos", emoji: "📈", kind: "income", defaultDay: 15 },
];

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function newDraft(opts: Partial<DraftRule> = {}, accounts: AccountLite[]): DraftRule {
  return {
    uid: crypto.randomUUID(),
    kind: "expense",
    description: "",
    amount: 0,
    currency: "BRL",
    accountId: accounts[0]?.id ?? "",
    fromAccountId: accounts[0]?.id ?? "",
    toAccountId: accounts[1]?.id ?? "",
    categoryId: "",
    paymentMethod: "",
    frequency: "monthly",
    intervalCount: 1,
    dayOfMonth: "",
    dayOfWeek: "",
    startDate: todayISO(),
    ...opts,
  };
}

export function BatchRecurrenceSheet({
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
  const [drafts, setDrafts] = useState<DraftRule[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDrafts([]);
  }

  function addTemplate(t: Template) {
    setDrafts((prev) => [
      ...prev,
      newDraft(
        {
          kind: t.kind,
          description: t.label,
          dayOfMonth: String(t.defaultDay),
          frequency: "monthly",
        },
        accounts,
      ),
    ]);
  }

  function addEmpty() {
    setDrafts((prev) => [...prev, newDraft({}, accounts)]);
  }

  function updateDraft(uid: string, patch: Partial<DraftRule>) {
    setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  }

  function removeDraft(uid: string) {
    setDrafts((prev) => prev.filter((d) => d.uid !== uid));
  }

  function validateAll(): { valid: boolean; firstError: string | null } {
    for (const d of drafts) {
      if (!d.description.trim()) return { valid: false, firstError: "Cada item precisa de descrição." };
      if (d.amount <= 0) return { valid: false, firstError: `"${d.description}": valor precisa ser positivo.` };
      if (d.kind === "transfer") {
        if (!d.fromAccountId || !d.toAccountId)
          return { valid: false, firstError: `"${d.description}": transferência precisa de origem e destino.` };
        if (d.fromAccountId === d.toAccountId)
          return { valid: false, firstError: `"${d.description}": origem e destino devem ser diferentes.` };
      } else {
        if (!d.accountId) return { valid: false, firstError: `"${d.description}": conta é obrigatória.` };
      }
      if (!d.startDate) return { valid: false, firstError: `"${d.description}": data de início obrigatória.` };
    }
    return { valid: true, firstError: null };
  }

  function handleSubmit() {
    if (drafts.length === 0) {
      toast.error("Adicione pelo menos uma recorrência.");
      return;
    }
    const { valid, firstError } = validateAll();
    if (!valid) {
      toast.error(firstError ?? "Verifique os campos.");
      return;
    }

    const payload = drafts.map((d) => ({
      kind: d.kind,
      amount: d.amount,
      currency: d.currency,
      description: d.description,
      accountId: d.kind === "transfer" ? undefined : d.accountId,
      categoryId: d.categoryId || undefined,
      paymentMethod: d.paymentMethod || undefined,
      fromAccountId: d.kind === "transfer" ? d.fromAccountId : undefined,
      toAccountId: d.kind === "transfer" ? d.toAccountId : undefined,
      frequency: d.frequency,
      intervalCount: d.intervalCount,
      dayOfMonth: d.dayOfMonth || undefined,
      dayOfWeek: d.dayOfWeek || undefined,
      startDate: d.startDate,
    }));

    startTransition(async () => {
      const r = await createRecurringRulesBatch(payload);
      if (r.errors && r.errors.length > 0) {
        toast.error(`Erros: ${r.errors.map((e) => e.error).join(", ")}`);
        return;
      }
      toast.success(`${r.created} recorrência${r.created === 1 ? "" : "s"} criada${r.created === 1 ? "" : "s"}.`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[min(720px,100vw)]">
        <SheetHeader
          eyebrow="Criação em lote"
          title="Várias recorrências de uma vez."
          description="Escolha modelos prontos pra adicionar rápido, ou crie do zero. Edite os campos antes de salvar tudo de uma vez."
        />

        {/* Templates */}
        <div className="mb-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
            Modelos rápidos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => addTemplate(t)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-border bg-surface text-[12.5px] hover:bg-surface-muted hover:border-border-strong transition-colors"
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linhas */}
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border px-6 py-10 text-center">
              <p className="text-[13px] text-muted-foreground">
                Nenhuma recorrência adicionada ainda. Use os modelos acima ou{" "}
                <button
                  type="button"
                  onClick={addEmpty}
                  className="text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 font-medium"
                >
                  comece do zero
                </button>
                .
              </p>
            </div>
          ) : (
            drafts.map((d, idx) => (
              <DraftRow
                key={d.uid}
                draft={d}
                index={idx}
                accounts={accounts}
                categories={categories}
                onChange={(patch) => updateDraft(d.uid, patch)}
                onRemove={() => removeDraft(d.uid)}
              />
            ))
          )}

          {drafts.length > 0 ? (
            <button
              type="button"
              onClick={addEmpty}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-[8px] border border-dashed border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
              Adicionar mais uma
            </button>
          ) : null}
        </div>

        {drafts.length > 0 ? (
          <div className="flex justify-between items-center gap-2 pt-5 mt-5 border-t border-border">
            <span className="text-[12.5px] text-muted-foreground">
              {drafts.length} recorrência{drafts.length === 1 ? "" : "s"} pronta{drafts.length === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={handleSubmit} disabled={pending}>
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
                {pending ? "Criando…" : `Criar ${drafts.length}`}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DraftRow({
  draft: d,
  index,
  accounts,
  categories,
  onChange,
  onRemove,
}: {
  draft: DraftRule;
  index: number;
  accounts: AccountLite[];
  categories: CategoryLite[];
  onChange: (patch: Partial<DraftRule>) => void;
  onRemove: () => void;
}) {
  const filteredCategories = categories.filter((c) =>
    d.kind === "income" ? c.kind === "income" : d.kind === "expense" ? c.kind === "expense" : false,
  );

  const isTransfer = d.kind === "transfer";

  return (
    <div className={cn("rounded-[10px] border border-border bg-surface p-4 space-y-3")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
          #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-[6px] text-faint-foreground hover:text-rust-600 hover:bg-rust-100/40 transition-colors"
          aria-label="Remover"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
        </button>
      </div>

      <PillGroup
        options={KIND_OPTIONS}
        value={d.kind}
        onChange={(v) => onChange({ kind: v })}
        size="sm"
      />

      <div className="grid grid-cols-[1fr_140px_88px] gap-2">
        <Field label="Descrição" htmlFor={`desc-${d.uid}`}>
          <Input
            id={`desc-${d.uid}`}
            value={d.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={d.kind === "income" ? "Salário…" : "Aluguel…"}
          />
        </Field>
        <Field label="Valor" htmlFor={`amt-${d.uid}`}>
          <MoneyInput
            id={`amt-${d.uid}`}
            name={`amt-${d.uid}`}
            defaultValue={d.amount}
            onValueChange={(v) => onChange({ amount: v })}
          />
        </Field>
        <Field label="Moeda">
          <Select value={d.currency} onValueChange={(v) => onChange({ currency: v as Currency })}>
            <SelectTrigger>
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

      {isTransfer ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="De">
            <Select
              value={d.fromAccountId}
              onValueChange={(v) => onChange({ fromAccountId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
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
          <Field label="Para">
            <Select
              value={d.toAccountId}
              onValueChange={(v) => onChange({ toAccountId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Destino" />
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
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Conta">
            <Select value={d.accountId} onValueChange={(v) => onChange({ accountId: v })}>
              <SelectTrigger>
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
          <Field label="Categoria" hint="Opcional">
            <Select
              value={d.categoryId}
              onValueChange={(v) => onChange({ categoryId: v })}
            >
              <SelectTrigger>
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

      <div className="grid grid-cols-[1fr_120px_140px] gap-2">
        <Field label="Frequência">
          <Select
            value={d.frequency}
            onValueChange={(v) => onChange({ frequency: v as RecurrenceFrequency })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {d.frequency === "monthly" ? (
          <Field label="Dia do mês" hint="1-31">
            <Input
              type="number"
              min={1}
              max={31}
              value={d.dayOfMonth}
              onChange={(e) => onChange({ dayOfMonth: e.target.value })}
              placeholder="—"
            />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Início">
          <Input
            type="date"
            value={d.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
