import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { QuickAddTrigger } from "@/components/transactions/quick-add-trigger";
import { DashboardHero } from "@/components/dashboard/hero";
import { TopCategoriesPanel } from "@/components/dashboard/top-categories";
import { LatestTransactionsPanel } from "@/components/dashboard/latest-transactions";
import { getCurrentUserContext } from "@/services/auth";
import { listAccounts, getAccountsTotals } from "@/services/accounts";
import {
  getCategoryBreakdown,
  getMonthlySummary,
  listTransactions,
  monthRange,
} from "@/services/transactions";
import { formatDateFull, formatTime, getGreeting } from "@/lib/utils/format";
import { monthProgress, projectMonthEnd } from "@/lib/financial/projection";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const firstName = ctx.profile.display_name.split(" ")[0];
  const now = new Date();
  const greeting = getGreeting(now);

  const [summary, accounts, breakdown, latest, totals] = await Promise.all([
    getMonthlySummary(),
    listAccounts(),
    getCategoryBreakdown(undefined, "expense"),
    listTransactions({ pageSize: 6 }),
    getAccountsTotals(),
  ]);

  const hasAccounts = accounts.length > 0;
  const hasAnyData = hasAccounts && (latest.total > 0 || summary.income > 0 || summary.expense > 0);

  const { label: monthLabel } = monthRange();
  const { daysElapsed, daysInMonth, ratio } = monthProgress(now);
  const projection = projectMonthEnd(summary.income, summary.expense, daysElapsed, daysInMonth);
  const expenseVsIncome = summary.income > 0 ? summary.expense / summary.income : summary.expense > 0 ? 2 : 0;

  return (
    <>
      <PageHeader
        eyebrow={`${formatDateFull(now)} · ${formatTime(now)}`}
        title={
          <>
            {greeting}, <em className="not-italic font-display italic text-navy-700">{firstName}.</em>
          </>
        }
        subtitle={
          hasAnyData
            ? "O mês está caminhando — abaixo, o pulso real."
            : "Vamos preparar o terreno em três passos curtos: contas, primeira transação e estamos no ar."
        }
        actions={
          <>
            <Button variant="secondary" disabled>
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.7} />
              {monthLabel.split(" ")[0]}
            </Button>
            <QuickAddTrigger />
          </>
        }
      />

      {!hasAnyData ? (
        <OnboardingWelcome
          firstName={firstName}
          accountsCount={accounts.length}
          transactionsCount={latest.total}
        />
      ) : (
        <>
          <DashboardHero
            projectedNet={projection.projectedNet}
            monthLabel={monthLabel}
            netConfidence={projection.confidence}
            income={summary.income}
            expense={summary.expense}
            patrimonio={totals.total}
            monthRatio={ratio}
            expenseRatio={expenseVsIncome}
          />

          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 mb-8">
            <TopCategoriesPanel rows={breakdown} monthLabel={monthLabel} />
            <CoveragePlaceholder />
          </div>

          <LatestTransactionsPanel rows={latest.rows} />
        </>
      )}
    </>
  );
}

function CoveragePlaceholder() {
  return (
    <Panel className="!p-7 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 w-40 h-40"
        style={{ background: "radial-gradient(circle, rgba(176,123,50,0.07), transparent 70%)" }}
      />
      <div className="relative z-10">
        <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-navy-700 mb-2.5 font-medium">
          Renda do patrimônio
        </div>
        <div className="font-mono text-[32px] tracking-[-0.025em] text-navy-950 leading-none">
          —
        </div>
        <p className="text-[13px] text-muted-foreground mt-2">
          Ativos chegam na Fase 3.
        </p>
        <p className="text-[12.5px] text-faint-foreground mt-4 leading-relaxed">
          Aqui vai ficar a renda média líquida dos últimos 12 meses, com a
          cobertura das despesas fixas e quanto falta pra 100%.
        </p>
      </div>
    </Panel>
  );
}

function OnboardingWelcome({
  firstName,
  accountsCount,
  transactionsCount,
}: {
  firstName: string;
  accountsCount: number;
  transactionsCount: number;
}) {
  const step1Done = accountsCount > 0;
  const step2Done = transactionsCount > 0;
  return (
    <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
      <div className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-10 sm:p-12 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px]"
          style={{ background: "radial-gradient(circle, rgba(176,123,50,0.16), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 w-[340px] h-[340px]"
          style={{ background: "radial-gradient(circle, rgba(96,126,168,0.13), transparent 70%)" }}
        />

        <div className="relative z-10 max-w-[520px]">
          <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 mb-3 font-medium">
            Primeiros passos
          </div>
          <h2 className="font-display text-[34px] leading-[1.1] tracking-[-0.025em] font-light">
            Bem-vindo, <em className="font-display italic">{firstName}</em>.
            <br />
            Vamos colocar o terreno em pé.
          </h2>
          <p className="text-navy-300 text-[14px] mt-5 leading-relaxed">
            Antes do hero respirar com dados de verdade, o app precisa saber{" "}
            <span className="text-white">onde</span> o dinheiro mora e{" "}
            <span className="text-white">como</span> ele se move.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            {!step1Done ? (
              <a
                href="/contas"
                className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-white text-ink-950 px-5 py-3 text-[13.5px] font-medium hover:bg-bone-100 transition-colors"
              >
                Cadastrar primeira conta →
              </a>
            ) : (
              <QuickAddTrigger label="Lançar primeira transação" size="lg" />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <StepCard
          n={1}
          done={step1Done}
          title="Cadastrar contas"
          text="Itaú, Nubank, XP, dinheiro vivo — onde o dinheiro entra e sai. Sem nada disso, o resto não funciona."
        />
        <StepCard
          n={2}
          done={step2Done}
          title="Primeira transação"
          text="Receita ou despesa, tanto faz. Só pra ver o app respirando com dados de verdade."
        />
        <StepCard
          n={3}
          done={false}
          title="Convidar parceira"
          text="Mesmo lar, dois acessos. (Chegando — fase 2.)"
        />
      </div>
    </section>
  );
}

function StepCard({
  n,
  title,
  text,
  done,
}: {
  n: number;
  title: string;
  text: string;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-border bg-surface p-6 transition-opacity ${done ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 grid place-items-center w-9 h-9 rounded-full font-mono text-[12px] font-medium ${
            done ? "bg-olive-100 text-olive-700" : "bg-ink-950 text-white"
          }`}
        >
          {done ? "✓" : n.toString().padStart(2, "0")}
        </div>
        <div>
          <h3 className="font-display text-[17px] font-medium tracking-[-0.01em]">{title}</h3>
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
