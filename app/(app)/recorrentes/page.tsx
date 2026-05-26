import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { RecurrenceRow } from "@/components/recurrences/recurrence-row";
import { RecurrenceSection } from "@/components/recurrences/recurrence-section";
import { NewRecurrenceButton } from "@/components/recurrences/new-recurrence-button";
import { BatchRecurrenceButton } from "@/components/recurrences/batch-recurrence-button";
import { PauseAllButton } from "@/components/recurrences/pause-all-button";
import { RecurrenceKeyboardNav } from "@/components/recurrences/keyboard-nav";
import {
  computeNextOccurrences,
  listRecurringRules,
  toMonthlyEquivalent,
  type RecurrenceRule,
} from "@/services/recurrences";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function aggregateMonthly(rules: RecurrenceRule[]): number {
  return rules.reduce(
    (sum, r) => sum + toMonthlyEquivalent(Number(r.amount), r.frequency, r.interval_count),
    0,
  );
}

export default async function RecorrentesPage() {
  const supabase = await createClient();
  const [rules, accounts, categories, { data: fontes }] = await Promise.all([
    listRecurringRules({ includeInactive: true }),
    listAccounts(),
    listCategories(),
    supabase
      .from("fontes_pagadoras")
      .select("id, type, name, cnpj, cpf")
      .eq("is_active", true)
      .order("name"),
  ]);
  const fontesList = fontes ?? [];

  const accountsLite = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    currency: a.currency,
    type: a.type,
  }));
  const categoriesLite = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));

  const active = rules.filter((r) => r.is_active);
  const paused = rules.filter((r) => !r.is_active);

  const incomes = active.filter((r) => r.kind === "income");
  const expenses = active.filter((r) => r.kind === "expense");
  const transfers = active.filter((r) => r.kind === "transfer");

  const today = todayISO();

  // Resumo macro
  const monthlyIncome = aggregateMonthly(incomes);
  const monthlyExpense = aggregateMonthly(expenses);
  const monthlyNet = monthlyIncome - monthlyExpense;

  // Distribuição pelo dia do mês (calendar heatmap simples)
  const calendarBuckets = new Map<number, { kind: "in" | "out" | "mix"; count: number }>();
  for (const r of active) {
    const day = r.day_of_month ?? null;
    if (!day) continue;
    const prev = calendarBuckets.get(day);
    const incomingKind = r.kind === "income" ? "in" : r.kind === "expense" ? "out" : "mix";
    if (!prev) {
      calendarBuckets.set(day, { kind: incomingKind, count: 1 });
    } else {
      calendarBuckets.set(day, {
        kind: prev.kind === incomingKind ? prev.kind : "mix",
        count: prev.count + 1,
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`Cotidiano · ${active.length} ativa${active.length !== 1 ? "s" : ""}`}
        title={
          <>
            Lançamentos <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">recorrentes</em>
          </>
        }
        subtitle="Aluguel, salário, assinaturas, aporte mensal — defina uma vez e o app cria as transações nas datas certas."
        actions={
          <div className="flex gap-2">
            <PauseAllButton
              activeIds={active.map((r) => r.id)}
              pausedIds={paused.map((r) => r.id)}
            />
            <BatchRecurrenceButton accounts={accountsLite} categories={categoriesLite} />
            <NewRecurrenceButton accounts={accountsLite} categories={categoriesLite} fontes={fontesList} />
          </div>
        }
      />

      {rules.length === 0 ? (
        <Empty />
      ) : (
        <>
          {/* TIER 1 — Resumo macro */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Entrada mensal"
              value={monthlyIncome}
              tone="positive"
              hint={`${incomes.length} receita${incomes.length === 1 ? "" : "s"} no piloto`}
            />
            <KpiCard
              label="Saída mensal"
              value={monthlyExpense}
              tone="negative"
              hint={`${expenses.length} despesa${expenses.length === 1 ? "" : "s"} no piloto`}
            />
            <KpiCard
              label="Sobra automática"
              value={monthlyNet}
              tone={monthlyNet >= 0 ? "positive" : "negative"}
              hint="apenas recorrências ativas"
            />
            <KpiCard
              label="Transferências"
              value={aggregateMonthly(transfers)}
              tone="muted"
              hint={`${transfers.length} no piloto`}
            />
          </div>

          {/* TIER 2 — Calendário simples */}
          {calendarBuckets.size > 0 ? (
            <Panel className="mb-6">
              <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
                Calendário do mês
              </div>
              <p className="text-[12.5px] text-muted-foreground mb-4">
                Quando cada recorrência cai. Verde = entrada, vermelho = saída, navy = transferência.
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1.5">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const bucket = calendarBuckets.get(day);
                  return (
                    <div
                      key={day}
                      className={
                        "aspect-square rounded-[6px] border flex flex-col items-center justify-center text-[11px] font-mono " +
                        (bucket
                          ? bucket.kind === "in"
                            ? "border-olive-600/40 bg-olive-600/10 text-olive-700 dark:text-olive-500"
                            : bucket.kind === "out"
                              ? "border-rust-600/40 bg-rust-600/10 text-rust-600"
                              : "border-navy-700/40 bg-navy-700/10 text-navy-700 dark:text-navy-300"
                          : "border-border text-faint-foreground")
                      }
                      title={bucket ? `${bucket.count} recorrência${bucket.count === 1 ? "" : "s"} dia ${day}` : `Dia ${day}`}
                    >
                      <span className="text-[10px] leading-none">{day}</span>
                      {bucket ? (
                        <span className="text-[9px] mt-0.5 opacity-80 leading-none">
                          ×{bucket.count}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          <div className="space-y-3">
            <RecurrenceSection
              keyboardId="receitas"
              label="Receitas"
              ruleIds={incomes.map((r) => r.id)}
              monthlyTotal={aggregateMonthly(incomes)}
              tone="income"
              emoji="↙"
            >
              {incomes.map((r) => (
                <RecurrenceRow
                  key={r.id}
                  rule={r}
                  nextOccurrences={computeNextOccurrences(r, today, 3)}
                  accounts={accountsLite}
                  categories={categoriesLite}
                  fontes={fontesList}
                />
              ))}
            </RecurrenceSection>

            <RecurrenceSection
              keyboardId="despesas"
              label="Despesas"
              ruleIds={expenses.map((r) => r.id)}
              monthlyTotal={aggregateMonthly(expenses)}
              tone="expense"
              emoji="↗"
            >
              {expenses.map((r) => (
                <RecurrenceRow
                  key={r.id}
                  rule={r}
                  nextOccurrences={computeNextOccurrences(r, today, 3)}
                  accounts={accountsLite}
                  categories={categoriesLite}
                  fontes={fontesList}
                />
              ))}
            </RecurrenceSection>

            <RecurrenceSection
              keyboardId="transferencias"
              label="Transferências"
              ruleIds={transfers.map((r) => r.id)}
              monthlyTotal={aggregateMonthly(transfers)}
              tone="transfer"
              emoji="↔"
            >
              {transfers.map((r) => (
                <RecurrenceRow
                  key={r.id}
                  rule={r}
                  nextOccurrences={computeNextOccurrences(r, today, 3)}
                  accounts={accountsLite}
                  categories={categoriesLite}
                  fontes={fontesList}
                />
              ))}
            </RecurrenceSection>

            {paused.length > 0 ? (
              <RecurrenceSection
                keyboardId="pausadas"
                label="Pausadas"
                ruleIds={paused.map((r) => r.id)}
                monthlyTotal={0}
                tone="neutral"
                defaultOpen={false}
                bulkMode="resume"
              >
                {paused.map((r) => (
                  <RecurrenceRow
                    key={r.id}
                    rule={r}
                    nextOccurrences={[]}
                    accounts={accountsLite}
                    categories={categoriesLite}
                    fontes={fontesList}
                  />
                ))}
              </RecurrenceSection>
            ) : null}
          </div>

          <RecurrenceKeyboardNav
            available={{
              receitas: incomes.length > 0,
              despesas: expenses.length > 0,
              transferencias: transfers.length > 0,
              pausadas: paused.length > 0,
            }}
          />
        </>
      )}
    </>
  );
}

function Empty() {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[480px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Nenhuma recorrência ainda
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2">
          Coloque tudo que repete <em className="italic">no piloto automático</em>.
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          Salário todo dia 5, aluguel todo dia 10, Netflix dia 15, aporte mensal — você
          define o ritmo e o app gera os lançamentos nas datas certas. Sem precisar lembrar.
        </p>
      </div>
    </Panel>
  );
}
