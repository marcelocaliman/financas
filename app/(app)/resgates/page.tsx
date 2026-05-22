import { ArrowRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { NewRuleButton } from "@/components/redemptions/new-rule-button";
import { IntentActions } from "@/components/redemptions/intent-actions";
import { ProjectionPanel } from "@/components/redemptions/projection-panel";
import { listAccounts } from "@/services/accounts";
import { listInvestments, getLatestIndexer } from "@/services/investments";
import {
  ensurePendingIntents,
  getNextPending,
  listRedemptionHistory,
  listYieldRules,
} from "@/services/redemptions";
import { formatDateShort, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ResgatesPage() {
  // Garante que existam intents pendentes para os próximos 3 meses
  await ensurePendingIntents(3);

  const [rules, nextIntent, history, investments, accounts, selic] = await Promise.all([
    listYieldRules(),
    getNextPending(),
    listRedemptionHistory(12),
    listInvestments(),
    listAccounts(),
    getLatestIndexer("selic"),
  ]);

  const destinations = accounts
    .filter((a) => a.type !== "investment" && a.type !== "credit_card")
    .map((a) => ({ id: a.id, name: a.name, institution: a.institution }));
  const investmentLite = investments.map((i) => ({
    id: i.id,
    ticker: i.ticker,
    name: i.name,
  }));

  const activeSelic = investments.find((i) => i.indexer === "selic");
  const projectionInitial = activeSelic ? Number(activeSelic.current_balance) : 0;
  const projectionMonthly = nextIntent ? Number(nextIntent.suggested_amount) : 1500;
  const selicValue = selic?.value ?? 14.5;

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
          {nextIntent ? <NextRemainder intent={nextIntent} /> : null}

          {nextIntent?.rule?.investment ? (
            <FlowDiagram
              fromName={nextIntent.rule.investment.name ?? "Ativo"}
              fromBalance={Number(nextIntent.rule.investment.current_balance ?? 0)}
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
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-b-0">
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
                        {r.mode === "reinvest" ? "—" : formatMoney(r.suggested_amount ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {activeSelic ? (
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
                            formatMoney(h.executed_amount ?? 0)
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
          <b className="text-foreground">{formatMoney(intent.suggested_amount)}</b>{" "}
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
  toName,
  toInstitution,
  monthlyAmount,
}: {
  fromName: string;
  fromBalance: number;
  toName: string;
  toInstitution?: string;
  monthlyAmount: number;
}) {
  return (
    <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-7 items-center mb-7">
      <FlowCard
        eyebrow="Origem"
        name={fromName}
        balance={fromBalance}
        accent="navy"
        meta={`Saldo atual`}
      />
      <div className="flex flex-col items-center gap-2 text-muted-foreground py-4">
        <ArrowRight className="w-7 h-7" strokeWidth={1.4} />
        <div className="font-mono text-[12px] text-olive-700 font-medium whitespace-nowrap">
          {formatMoney(monthlyAmount)}/mês
        </div>
      </div>
      <FlowCard
        eyebrow="Destino"
        name={toName}
        balance={null}
        accent="olive"
        meta={toInstitution ? `${toInstitution}` : "Conta corrente"}
      />
    </div>
  );
}

function FlowCard({
  eyebrow,
  name,
  balance,
  accent,
  meta,
}: {
  eyebrow: string;
  name: string;
  balance: number | null;
  accent: "navy" | "olive";
  meta?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-surface border border-border px-7 py-6 border-l-[3px] ${
        accent === "navy" ? "!border-l-navy-800" : "!border-l-olive-600"
      }`}
    >
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground mb-1.5 font-medium">
        {eyebrow}
      </div>
      <div className="font-display text-[19px] tracking-[-0.015em] mb-3">{name}</div>
      {balance !== null ? (
        <div className="font-mono text-[22px] tracking-[-0.02em] text-foreground">
          {formatMoney(balance)}
        </div>
      ) : null}
      {meta ? (
        <div className="text-[12.5px] text-muted-foreground mt-1">{meta}</div>
      ) : null}
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
