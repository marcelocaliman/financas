import { Repeat, AlertCircle, Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { listSubscriptions } from "@/services/subscriptions";
import { formatDateShort, formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { SubscriptionRowActions } from "@/components/subscriptions/subscription-row-actions";

export const dynamic = "force-dynamic";

export default async function AssinaturasPage() {
  const subs = await listSubscriptions();
  const monthlyTotal = subs.reduce((s, x) => s + x.monthlyInDisplay, 0);
  const yearlyTotal = monthlyTotal * 12;
  const dailyAverage = yearlyTotal / 365;

  // Próximas cobranças nos próximos 30 dias
  const upcoming = subs
    .filter((s) => s.daysUntilNextCharge != null && s.daysUntilNextCharge <= 30)
    .sort((a, b) => (a.daysUntilNextCharge ?? 0) - (b.daysUntilNextCharge ?? 0));

  return (
    <>
      <PageHeader
        eyebrow={`${subs.length} ${subs.length === 1 ? "assinatura" : "assinaturas"} ativas`}
        title={
          <>
            Suas <em className="not-italic font-display italic text-navy-700">assinaturas.</em>
          </>
        }
        subtitle="Streamings, academia, plano de software — o gotejamento silencioso. Cada uma parece pouco; o total anual nem tanto."
      />

      {subs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
            <KpiCard
              label="Total mensal"
              value={monthlyTotal}
              tone="negative"
              hint="soma de todas as assinaturas"
            />
            <KpiCard
              label="Total anual"
              value={yearlyTotal}
              tone="negative"
              hint="quanto vc paga em 12 meses"
            />
            <KpiCard
              label="Por dia"
              value={dailyAverage}
              tone="muted"
              hint="custo médio diário"
            />
            <KpiCard
              label="Assinaturas"
              textValue={`${subs.length}`}
              tone="neutral"
              hint={
                subs.length >= 10
                  ? "considere uma revisão"
                  : subs.length >= 5
                    ? "no patamar normal"
                    : "enxuto"
              }
            />
          </div>

          {/* Próximas cobranças */}
          {upcoming.length > 0 ? (
            <Panel className="mb-7">
              <PanelHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-navy-700" strokeWidth={1.7} />
                    Próximas cobranças
                  </span>
                }
                meta={`${upcoming.length} nos próximos 30 dias`}
              />
              <ul className="space-y-2">
                {upcoming.slice(0, 8).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="font-mono text-[11px] text-faint-foreground tracking-[0.04em] inline-flex items-center gap-1 shrink-0 w-[80px]">
                        <Calendar className="w-3 h-3" strokeWidth={1.7} />
                        {s.nextChargeDate ? formatDateShort(s.nextChargeDate) : "—"}
                      </span>
                      <span className="text-[13.5px] text-foreground truncate">
                        {s.description}
                      </span>
                      {s.daysUntilNextCharge != null && s.daysUntilNextCharge <= 3 ? (
                        <Badge tone="gold">
                          {s.daysUntilNextCharge === 0
                            ? "hoje"
                            : s.daysUntilNextCharge === 1
                              ? "amanhã"
                              : `em ${s.daysUntilNextCharge}d`}
                        </Badge>
                      ) : null}
                    </div>
                    <Money
                      value={s.monthlyInDisplay}
                      className="font-mono text-[13px] font-medium tabular-nums shrink-0 inline-flex !flex-row !items-baseline"
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {/* Lista completa */}
          <Panel className="!px-0">
            <div className="px-7 pt-1">
              <PanelHeader
                title="Todas as assinaturas"
                meta="ordenadas pelo custo mensal"
              />
            </div>
            <div className="overflow-x-auto px-7">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <Th>Assinatura</Th>
                    <Th right>Mensal</Th>
                    <Th right>Anual</Th>
                    <Th right>Próxima</Th>
                    <Th right>% do total</Th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const sharePct = monthlyTotal > 0 ? (s.monthlyInDisplay / monthlyTotal) * 100 : 0;
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-border last:border-b-0 group hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors"
                      >
                        <td className="py-3.5 pr-4">
                          <div className="font-medium text-[13.5px] text-foreground">
                            {s.description}
                          </div>
                          <div className="font-mono text-[10.5px] text-faint-foreground tracking-[0.04em] mt-0.5">
                            {s.account?.name ?? "—"}
                            {s.category ? ` · ${s.category.name}` : ""}
                            {" · "}
                            {freqLabel(s.frequency, s.interval_count, s.day_of_month)}
                          </div>
                        </td>
                        <td className="text-right font-mono text-[13px] tabular-nums">
                          <MoneyMask>{formatMoney(s.monthlyInDisplay)}</MoneyMask>
                        </td>
                        <td className="text-right font-mono text-[12px] text-muted-foreground tabular-nums">
                          <MoneyMask>{formatMoney(s.yearlyInDisplay)}</MoneyMask>
                        </td>
                        <td className="text-right font-mono text-[11.5px] text-muted-foreground">
                          {s.nextChargeDate ? formatDateShort(s.nextChargeDate) : "—"}
                        </td>
                        <td className="text-right font-mono text-[11.5px] text-faint-foreground tabular-nums">
                          {sharePct.toFixed(1).replace(".", ",")}%
                        </td>
                        <td className="text-right pl-2">
                          <SubscriptionRowActions ruleId={s.id} description={s.description} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Verdict */}
          {monthlyTotal > 0 ? (
            <Panel className="mt-6 !p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gold-700 dark:text-gold-500 shrink-0 mt-0.5" strokeWidth={1.7} />
                <div className="text-[13px] leading-relaxed">
                  Em <b>10 anos</b> esse gasto soma{" "}
                  <b className="text-rust-600 font-mono">
                    <MoneyMask>{formatMoney(yearlyTotal * 10)}</MoneyMask>
                  </b>{" "}
                  (sem contar reajustes). Investido no Tesouro Selic na taxa atual,
                  esse mesmo dinheiro renderia ~
                  <b className="text-olive-700 dark:text-olive-500 font-mono">
                    <MoneyMask>{formatMoney(yearlyTotal * 10 * 1.5)}</MoneyMask>
                  </b>
                  . Vale a pena revisar quais ainda valem o preço.
                </div>
              </div>
            </Panel>
          ) : null}
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

function freqLabel(
  freq: string,
  interval: number,
  dayOfMonth: number | null,
): string {
  if (freq === "monthly")
    return `mensal${dayOfMonth ? ` · dia ${dayOfMonth}` : ""}`;
  if (freq === "yearly") return "anual";
  if (freq === "weekly") return "semanal";
  if (freq === "daily") return "diário";
  return `${freq} × ${interval}`;
}

function EmptyState() {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[480px]">
        <Repeat className="w-8 h-8 text-faint-foreground mx-auto mb-3" strokeWidth={1.4} />
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Nenhuma assinatura detectada
        </div>
        <h2 className="font-display text-[24px] tracking-[-0.02em] mt-2">
          Vc não tem assinaturas mapeadas.
        </h2>
        <p className="text-[13.5px] text-muted-foreground mt-2.5 leading-relaxed">
          A app classifica automaticamente regras recorrentes com keywords
          conhecidas (Netflix, Spotify, gym, Adobe…). Pra uma regra existente
          virar assinatura, vá em <a className="text-navy-700" href="/recorrentes">/recorrentes</a>{" "}
          e use o botão de marcar como assinatura.
        </p>
      </div>
    </Panel>
  );
}
