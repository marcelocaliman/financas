import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { RecurrenceCard } from "@/components/recurrences/recurrence-card";
import { NewRecurrenceButton } from "@/components/recurrences/new-recurrence-button";
import { MaterializeNowButton } from "@/components/recurrences/materialize-now-button";
import {
  computeNextOccurrences,
  listRecurringRules,
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
            <NewRecurrenceButton accounts={accountsLite} categories={categoriesLite} />
          </div>
        }
      />

      {active.length === 0 && paused.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-4">
          {active.map((r) => (
            <RecurrenceCard
              key={r.id}
              rule={r}
              nextOccurrences={computeNextOccurrences(r, today, 3)}
              accounts={accountsLite}
              categories={categoriesLite}
            />
          ))}
          {paused.length > 0 ? (
            <>
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint-foreground mt-8 mb-3 font-medium">
                Pausadas
              </h2>
              {paused.map((r) => (
                <RecurrenceCard
                  key={r.id}
                  rule={r}
                  nextOccurrences={[]}
                  accounts={accountsLite}
                  categories={categoriesLite}
                />
              ))}
            </>
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
