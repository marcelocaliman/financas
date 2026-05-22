import { ArrowRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { NewRuleButton } from "@/components/redemptions/new-rule-button";
import { IntentActions } from "@/components/redemptions/intent-actions";
import { ProjectionPanel } from "@/components/redemptions/projection-panel";
import { RuleRowActions } from "@/components/redemptions/rule-row-actions";
import { LiveBalance } from "@/components/redemptions/live-balance";
import { listAccounts } from "@/services/accounts";
import { listInvestments, getLatestIndexer } from "@/services/investments";
import { getLivePortfolio } from "@/services/live-yield";
import {
  ensurePendingIntents,
  getNextPending,
  listPendingIntents,
  listRedemptionHistory,
  listYieldRules,
} from "@/services/redemptions";
import { formatDateShort, formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";

export const dynamic = "force-dynamic";

export default async function ResgatesPage() {
  // Garante que existam intents pendentes para os próximos 3 meses
  await ensurePendingIntents(3);

  const [rules, nextIntent, allPending, history, investments, accounts, selic, live] =
    await Promise.all([
      listYieldRules(),
      getNextPending(),
      listPendingIntents(),
      listRedemptionHistory(12),
      listInvestments(),
      listAccounts(),
      getLatestIndexer("selic"),
      getLivePortfolio(),
    ]);

  const liveByAssetId = new Map(live.byAsset.map((a) => [a.id, a]));
  const fromInvestmentId = nextIntent?.rule?.investment?.id ?? null;
  const fromLive = fromInvestmentId ? liveByAssetId.get(fromInvestmentId) : null;

  const destinations = accounts
    .filter((a) => a.type !== "investment" && a.type !== "credit_card")
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));
  const investmentLite = investments.map((i) => ({
    id: i.id,
    ticker: i.ticker,
    name: i.name,
  }));

  // ProjectionPanel agora usa TODO o saldo de RF (não apenas um ativo Selic),
  // alinhado com o jeito "viver da renda" — a carteira de RF inteira é a base.
  const projectionInitial = live.byClass.fixedIncome.balance;
  const projectionMonthly = nextIntent ? Number(nextIntent.suggested_amount) : 1500;
  const selicValue = selic?.value ?? 14.5;

  // Total mensal estimado de saques + projeção anual
  const monthlyRedemption = rules
    .filter((r) => r.is_active && r.mode !== "reinvest")
    .reduce((s, r) => s + Number(r.suggested_amount ?? 0), 0);
  const yearlyRedemption = monthlyRedemption * 12;
  const executedThisYear = history
    .filter(
      (h) =>
        h.status === "executed" &&
        h.due_date.slice(0, 4) === String(new Date().getUTCFullYear()),
    )
    .reduce((s, h) => s + Number(h.executed_amount ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Renda passiva · saques inteligentes"
        title={
          <>
            Tirar renda para <em className="not-italic font-display italic text-navy-700">viver.</em>
          </>
        }
        subtitle="Configure o saque de cada ativo. O app lembra você mês a mês — você decide o valor exato no momento."
        actions={
          <NewRuleButton investments={investmentLite} destinations={destinations} />
        }
      />

      {investments.length === 0 ? (
        <EmptyNoInvestments />
      ) : rules.length === 0 ? (
        <EmptyNoRules />
      ) : (
        <>
          {/* TIER 1 — KPIs macro */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Saque mensal estimado"
              value={monthlyRedemption}
              tone="positive"
              hint={`${rules.filter((r) => r.mode !== "reinvest" && r.is_active).length} regra${rules.filter((r) => r.mode !== "reinvest" && r.is_active).length === 1 ? "" : "s"} de saque`}
            />
            <KpiCard
              label="Projeção anual"
              value={yearlyRedemption}
              tone="muted"
              hint="se mantiver o ritmo atual"
            />
            <KpiCard
              label="Já sacado em 2026"
              value={executedThisYear}
              tone="neutral"
            />
            <KpiCard
              label="Saques pendentes"
              textValue={`${allPending.length}`}
              tone={allPending.length > 0 ? "negative" : "muted"}
              hint={
                allPending.length === 0
                  ? "tudo em dia"
                  : "aguardando confirmação"
              }
            />
          </div>

          {nextIntent ? <NextRemainder intent={nextIntent} /> : null}

          {/* Lista de todos os pending além do próximo */}
          {allPending.length > 1 ? (
            <Panel className="mb-6">
              <PanelHeader
                title="Próximos saques pendentes"
                meta={`${allPending.length - 1} ${allPending.length - 1 === 1 ? "depois do próximo" : "depois do próximo"}`}
              />
              <ul className="divide-y divide-border">
                {allPending.slice(1, 6).map((intent) => (
                  <li
                    key={intent.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className="font-mono text-[11.5px] text-muted-foreground tracking-[0.04em] inline-flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" strokeWidth={1.8} />
                        {formatDateShort(intent.due_date)}
                      </span>
                      <span className="text-[13.5px] text-foreground truncate">
                        {intent.rule?.investment?.ticker ?? "—"} →{" "}
                        {intent.rule?.destination?.name ?? "—"}
                      </span>
                    </div>
                    <span className="font-mono text-[13px] font-medium tabular-nums shrink-0">
                      <MoneyMask>{formatMoney(intent.suggested_amount)}</MoneyMask>
                    </span>
                  </li>
                ))}
              </ul>
              {allPending.length > 6 ? (
                <p className="text-[11.5px] font-mono text-faint-foreground mt-3">
                  + {allPending.length - 6} ainda mais distantes
                </p>
              ) : null}
            </Panel>
          ) : null}

          {nextIntent?.rule?.investment ? (
            <FlowDiagram
              fromName={nextIntent.rule.investment.name ?? "Ativo"}
              fromBalance={Number(nextIntent.rule.investment.current_balance ?? 0)}
              fromLiveDaily={fromLive?.dailyYield ?? 0}
              fromLivePerSecond={fromLive?.perSecond ?? 0}
              toName={
                nextIntent.rule.destination?.name ?? "Conta de destino"
              }
              toInstitution={nextIntent.rule.destination?.institution}
              monthlyAmount={Number(nextIntent.suggested_amount)}
            />
          ) : null}

          <Panel>
            <PanelHeader
              title="Regras ativas"
              meta={`${rules.length} regra${rules.length !== 1 ? "s" : ""}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <Th>Origem</Th>
                    <Th>Destino</Th>
                    <Th right>Modo</Th>
                    <Th right>Dia</Th>
                    <Th right>Sugerido</Th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-b-0 group hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors"
                    >
                      <td className="py-3 pr-3">
                        <div className="font-mono text-[13.5px] font-medium">
                          {r.investment?.ticker ?? "—"}
                        </div>
                        <div className="text-[11.5px] text-faint-foreground">
                          {r.investment?.name ?? ""}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-[13px]">
                        {r.destination?.name}
                        <span className="text-faint-foreground text-[11.5px] ml-1">
                          · {r.destination?.institution}
                        </span>
                      </td>
                      <td className="text-right">
                        <Badge tone={r.mode === "reinvest" ? "olive" : "navy"}>
                          {r.mode === "reinvest"
                            ? "Reinvestir"
                            : r.mode === "percentage"
                              ? `${Math.round(r.percentage ?? 0)}% renda`
                              : "Valor fixo"}
                        </Badge>
                      </td>
                      <td className="text-right font-mono text-[13px]">
                        dia {r.day_of_month}
                      </td>
                      <td className="text-right font-mono text-[13px] font-medium">
                        {r.mode === "reinvest" ? "—" : <MoneyMask>{formatMoney(r.suggested_amount ?? 0)}</MoneyMask>}
                      </td>
                      <td className="text-right pl-2">
                        <RuleRowActions
                          rule={r}
                          investments={investmentLite}
                          destinations={destinations}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {projectionInitial > 0 ? (
            <ProjectionPanel
              initialBalance={projectionInitial}
              selicAnnualPct={selicValue}
              initialMonthly={projectionMonthly}
            />
          ) : null}

          <div className="mt-7">
            <h2 className="font-display italic text-[18px] tracking-[-0.02em] mb-3 font-normal">
              Histórico de saques
            </h2>
            <Panel className="!px-0">
              {history.length === 0 ? (
                <div className="text-center py-10 text-[13.5px] text-muted-foreground italic">
                  Nenhum saque registrado ainda. Quando você confirmar o primeiro lembrete, ele
                  aparece aqui.
                </div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-border last:border-b-0">
                        <td className="py-3 pl-7 pr-3 w-[80px]">
                          <span className="font-mono text-[11.5px] text-muted-foreground">
                            {formatDateShort(h.due_date)}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-[14px]">
                            {h.rule?.investment?.ticker ?? "—"} → {h.rule?.destination?.name ?? "—"}
                          </div>
                          <div className="text-[11.5px] text-faint-foreground font-mono mt-0.5">
                            {h.status === "executed" ? "Saque executado" : "Mês pulado"}
                          </div>
                        </td>
                        <td className="py-3 pr-7 text-right font-mono text-[13.5px] font-medium">
                          {h.status === "executed" ? (
                            <MoneyMask>{formatMoney(h.executed_amount ?? 0)}</MoneyMask>
                          ) : (
                            <span className="text-faint-foreground">R$ 0,00</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground pb-3 font-medium ${right ? "text-right pl-3" : "text-left pr-3"}`}
    >
      {children}
    </th>
  );
}

function NextRemainder({
  intent,
}: {
  intent: Awaited<ReturnType<typeof getNextPending>>;
}) {
  if (!intent) return null;
  const days = Math.max(
    0,
    Math.ceil(
      (new Date(intent.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  return (
    <div className="rounded-[var(--radius-lg)] bg-navy-50 border border-navy-100 px-7 py-5 mb-6 flex items-start gap-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-navy-700" />
      <div className="w-9 h-9 rounded-[10px] bg-navy-100 text-navy-700 grid place-items-center shrink-0">
        <Clock className="w-4 h-4" strokeWidth={1.7} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground">
          {days === 0 ? (
            <>Saque <em className="italic">hoje</em></>
          ) : days === 1 ? (
            <>Saque <em className="italic">amanhã</em></>
          ) : (
            <>Próximo saque em <em className="italic">{days} dias</em></>
          )}
        </h3>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-1">
          {formatDateShort(intent.due_date)} · {intent.rule?.investment?.ticker} →{" "}
          {intent.rule?.destination?.name} · valor sugerido{" "}
          <b className="text-foreground"><MoneyMask>{formatMoney(intent.suggested_amount)}</MoneyMask></b>{" "}
          (ajustável no momento)
        </p>
        <div className="mt-3">
          <IntentActions
            intentId={intent.id}
            suggestedAmount={Number(intent.suggested_amount)}
            investmentName={intent.rule?.investment?.name ?? "Ativo"}
            destinationName={intent.rule?.destination?.name ?? "Destino"}
            dueLabel={formatDateShort(intent.due_date)}
          />
        </div>
      </div>
    </div>
  );
}

function FlowDiagram({
  fromName,
  fromBalance,
  fromLiveDaily,
  fromLivePerSecond,
  toName,
  toInstitution,
  monthlyAmount,
}: {
  fromName: string;
  fromBalance: number;
  fromLiveDaily: number;
  fromLivePerSecond: number;
  toName: string;
  toInstitution?: string;
  monthlyAmount: number;
}) {
  return (
    <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-7 items-center mb-7">
      <div
        className="rounded-[var(--radius-lg)] bg-surface border border-border px-7 py-6 border-l-[3px] !border-l-navy-800"
      >
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground mb-1.5 font-medium flex items-center gap-1.5">
          {fromLiveDaily > 0 ? (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
          ) : null}
          Origem
        </div>
        <div className="font-display text-[19px] tracking-[-0.015em] mb-3">{fromName}</div>
        <div className="font-mono text-[22px] tracking-[-0.02em] text-foreground">
          {fromLiveDaily > 0 ? (
            <LiveBalance
              baseBalance={fromBalance}
              dailyYield={fromLiveDaily}
              perSecond={fromLivePerSecond}
            />
          ) : (
            <MoneyMask>{formatMoney(fromBalance)}</MoneyMask>
          )}
        </div>
        <div className="text-[12.5px] text-muted-foreground mt-1">
          {fromLiveDaily > 0 ? "saldo respirando ao vivo" : "Saldo atual"}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 text-muted-foreground py-4">
        <ArrowRight className="w-7 h-7" strokeWidth={1.4} />
        <div className="font-mono text-[12px] text-olive-700 dark:text-olive-500 font-medium whitespace-nowrap">
          <MoneyMask>{formatMoney(monthlyAmount)}</MoneyMask>/mês
        </div>
      </div>
      <div className="rounded-[var(--radius-lg)] bg-surface border border-border px-7 py-6 border-l-[3px] !border-l-olive-600">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground mb-1.5 font-medium">
          Destino
        </div>
        <div className="font-display text-[19px] tracking-[-0.015em] mb-3">{toName}</div>
        {toInstitution ? (
          <div className="text-[12.5px] text-muted-foreground mt-1">{toInstitution}</div>
        ) : (
          <div className="text-[12.5px] text-muted-foreground mt-1">Conta corrente</div>
        )}
      </div>
    </div>
  );
}

function EmptyNoInvestments() {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[460px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Sem ativos
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2">
          Cadastre ativos primeiro.
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          Sem investimentos não há de onde sacar. Vai em <a className="text-navy-700" href="/investimentos">/investimentos</a> e
          adicione seu primeiro Tesouro, FII ou CDB.
        </p>
      </div>
    </Panel>
  );
}

function EmptyNoRules() {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[460px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Nenhuma regra ainda
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2">
          Configure o primeiro <em className="italic">saque mensal</em>.
        </h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          Escolha de qual ativo quer sacar, para onde vai o dinheiro, e em que dia. O app cuida do
          lembrete — você decide o valor na hora.
        </p>
      </div>
    </Panel>
  );
}
