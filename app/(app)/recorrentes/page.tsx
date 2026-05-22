import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { RecurrenceRow } from "@/components/recurrences/recurrence-row";
import { RecurrenceSection } from "@/components/recurrences/recurrence-section";
import { NewRecurrenceButton } from "@/components/recurrences/new-recurrence-button";
import { BatchRecurrenceButton } from "@/components/recurrences/batch-recurrence-button";
import { MaterializeNowButton } from "@/components/recurrences/materialize-now-button";
import {
  computeNextOccurrences,
  listRecurringRules,
  toMonthlyEquivalent,
  type RecurrenceRule,
} from "@/services/recurrences";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";

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
  const [rules, accounts, categories] = await Promise.all([
    listRecurringRules({ includeInactive: true }),
    listAccounts(),
    listCategories(),
  ]);

  const accountsLite = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    currency: a.currency,
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

  return (
    <>
      <PageHeader
        eyebrow={`Cotidiano · ${active.length} ativa${active.length !== 1 ? "s" : ""}`}
        title={
          <>
            Lançamentos <em className="not-italic font-display italic text-navy-700">recorrentes</em>
          </>
        }
        subtitle="Aluguel, salário, assinaturas, aporte mensal — defina uma vez e o app cria as transações nas datas certas."
        actions={
          <div className="flex gap-2">
            <MaterializeNowButton />
            <BatchRecurrenceButton accounts={accountsLite} categories={categoriesLite} />
            <NewRecurrenceButton accounts={accountsLite} categories={categoriesLite} />
          </div>
        }
      />

      {rules.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-3">
          <RecurrenceSection
            label="Receitas"
            count={incomes.length}
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
              />
            ))}
          </RecurrenceSection>

          <RecurrenceSection
            label="Despesas"
            count={expenses.length}
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
              />
            ))}
          </RecurrenceSection>

          <RecurrenceSection
            label="Transferências"
            count={transfers.length}
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
              />
            ))}
          </RecurrenceSection>

          {paused.length > 0 ? (
            <RecurrenceSection
              label="Pausadas"
              count={paused.length}
              monthlyTotal={0}
              tone="neutral"
              defaultOpen={false}
            >
              {paused.map((r) => (
                <RecurrenceRow
                  key={r.id}
                  rule={r}
                  nextOccurrences={[]}
                  accounts={accountsLite}
                  categories={categoriesLite}
                />
              ))}
            </RecurrenceSection>
          ) : null}
        </div>
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
