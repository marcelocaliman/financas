import { CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getCurrentUserContext } from "@/services/auth";
import { getComparisonCurrency, getDisplayCurrency } from "@/services/currency";
import { getCronStatuses, formatAge, type CronStatus } from "@/services/cron-status";
import { listHouseholdMembers, listActiveInvites } from "@/services/household";
import { signOut } from "../_actions/sign-out";
import {
  ComparisonCurrencyForm,
  DisplayCurrencyForm,
  HouseholdNameForm,
  ProfileNameForm,
} from "./profile-forms";
import { ResetDataSection } from "./reset-data-section";
import { HouseholdInvitesSection } from "./household-invites-section";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;
  const [displayCurrency, comparisonCurrency, cronStatuses, members, invites] =
    await Promise.all([
      getDisplayCurrency(),
      getComparisonCurrency(),
      getCronStatuses(),
      listHouseholdMembers(),
      listActiveInvites(),
    ]);
  const comparisonValue = comparisonCurrency ?? "off";
  const staleCount = cronStatuses.filter((c) => c.status !== "ok").length;
  const isAdmin = ctx.profile.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow="Bastidores"
        title={<>Configurações</>}
        subtitle="Conta, lar, parceiras, preferências e a saúde dos dados externos."
      />

      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Sua conta" meta={`E-mail: ${ctx.email ?? "—"}`} />
          <ProfileNameForm defaultValue={ctx.profile.display_name} />
          <div className="text-[11.5px] text-faint-foreground font-mono tracking-[0.04em] mt-5 pt-4 border-t border-border">
            ID: {ctx.authId} · Papel: {ctx.profile.role}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Moeda de exibição"
            meta="Como totais aparecem na home, contas e investimentos"
          />
          <DisplayCurrencyForm defaultValue={displayCurrency} />
          <div className="mt-6 pt-5 border-t border-border">
            <ComparisonCurrencyForm defaultValue={comparisonValue} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Tema" meta="Claro, escuro, ou seguir o sistema" />
          <ThemeToggle />
        </Panel>

        <Panel>
          <PanelHeader
            title="Seu lar"
            meta={`${members.length} ${members.length === 1 ? "membro" : "membros"} · papel: ${ctx.profile.role}`}
          />
          <HouseholdNameForm defaultValue={ctx.household.name} />

          {members.length > 1 ? (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
                Membros
              </div>
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="text-foreground">{m.display_name}</span>
                    <span className="font-mono text-[11px] text-faint-foreground uppercase tracking-[0.1em]">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 pt-5 border-t border-border">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2.5">
              Convidar parceira(o)
            </div>
            <HouseholdInvitesSection
              invites={invites}
              isAdmin={isAdmin}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Saúde dos dados externos"
            meta={
              staleCount === 0
                ? "tudo atualizado"
                : `${staleCount} fonte${staleCount === 1 ? "" : "s"} desatualizada${staleCount === 1 ? "" : "s"}`
            }
          />
          <ul className="divide-y divide-border">
            {cronStatuses.map((s) => (
              <CronStatusRow key={s.name} status={s} />
            ))}
          </ul>
          <p className="text-[11.5px] text-faint-foreground mt-4 leading-relaxed">
            Indexadores e taxas de câmbio atualizam todo dia útil pela manhã.
            Cotações de FII/ações são puxadas sob demanda quando você abre
            /investimentos.
          </p>
        </Panel>

        <Panel>
          <PanelHeader
            title="Refazer onboarding"
            meta="Adicionar contas, rendas e despesas em lote pelo wizard"
          />
          <a
            href="/welcome?force=1"
            className="inline-flex items-center justify-center h-9 px-3.5 rounded-[8px] border border-border-strong bg-transparent text-foreground hover:bg-surface-muted text-[13px] font-medium transition-colors"
          >
            Abrir wizard
          </a>
        </Panel>

        <Panel>
          <PanelHeader title="Sair" meta="Encerra a sessão neste dispositivo" />
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Encerrar sessão
            </Button>
          </form>
        </Panel>

        <Panel className="border-rust-600/30">
          <PanelHeader
            title={<span className="text-rust-600">Zona perigosa</span>}
            meta="Apaga todos os dados desse lar (irreversível)"
          />
          <ResetDataSection />
        </Panel>
      </div>
    </>
  );
}

function CronStatusRow({ status }: { status: CronStatus }) {
  const icon =
    status.status === "ok" ? (
      <CheckCircle2 className="w-4 h-4 text-olive-700 dark:text-olive-500" strokeWidth={1.7} />
    ) : status.status === "stale" ? (
      <AlertCircle className="w-4 h-4 text-gold-700 dark:text-gold-500" strokeWidth={1.7} />
    ) : (
      <MinusCircle className="w-4 h-4 text-rust-600" strokeWidth={1.7} />
    );
  const ageLabel =
    status.status === "missing"
      ? "sem dados"
      : `há ${formatAge(status.ageHours)}`;
  const ageClass =
    status.status === "ok"
      ? "text-muted-foreground"
      : status.status === "stale"
        ? "text-gold-700 dark:text-gold-500"
        : "text-rust-600";

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-foreground">{status.name}</div>
          <div className="font-mono text-[11px] text-faint-foreground tracking-[0.04em] mt-0.5 truncate">
            {status.description}
          </div>
        </div>
      </div>
      <div className={`font-mono text-[12px] tracking-[0.04em] shrink-0 ${ageClass}`}>
        {ageLabel}
      </div>
    </li>
  );
}
