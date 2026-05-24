import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";
import { IRSettingsForm } from "@/components/ir/settings-form";
import { DependentsManager } from "@/components/ir/dependents-manager";
import { DeductiblesManager } from "@/components/ir/deductibles-manager";
import { OtherIncomesManager } from "@/components/ir/other-incomes-manager";
import { AccountantSection } from "@/components/ir/accountant-section";
import { FontesPagadorasManager } from "@/components/ir/fontes-pagadoras-manager";
import { AutoDeductiblesImport } from "@/components/ir/auto-deductibles-import";
import { findDeductibleCandidates } from "@/services/ir/auto-deductibles";

export const dynamic = "force-dynamic";

export default async function IRConfigPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year)) return <div>Ano inválido</div>;

  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [
    { data: settings },
    { data: dependents },
    { data: pays },
    { data: others },
    { data: invites },
    { data: accesses },
    { data: audit },
    { data: fontes },
  ] = await Promise.all([
    supabase.from("ir_settings").select("*").maybeSingle(),
    supabase.from("ir_dependents").select("*").order("created_at"),
    supabase
      .from("ir_deductible_payments")
      .select("*")
      .eq("year", year)
      .order("payment_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("ir_other_incomes")
      .select("*")
      .eq("year", year)
      .order("created_at"),
    supabase
      .from("accountant_invites")
      .select("*")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("accountant_household_access")
      .select("*, accountant:accountant_profiles(full_name, email, crc_number, crc_state)")
      .is("revoked_at", null)
      .order("granted_at", { ascending: false }),
    supabase
      .from("accountant_audit_log")
      .select("*, accountant:accountant_profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("fontes_pagadoras")
      .select("*")
      .order("type")
      .order("name"),
  ]);

  const candidates = await findDeductibleCandidates(year, ctx.household.id);

  return (
    <>
      <Link
        href={`/ir/${year}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar para IRPF/{year + 1}
      </Link>

      <PageHeader
        eyebrow={`IRPF/${year + 1} · configurações`}
        title={
          <>
            Configurar <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">declaração</em>
          </>
        }
        subtitle="Titular, dependentes, pagamentos dedutíveis e outras rendas manuais que não estão no app."
      />

      <Panel className="mb-5">
        <PanelHeader title="Titular da declaração" />
        <IRSettingsForm settings={settings ?? null} />
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Fontes pagadoras"
          meta="Empresas/pessoas que te pagam — usado pra classificar rendimentos corretamente no IR"
        />
        <FontesPagadorasManager fontes={fontes ?? []} />
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Dependentes"
          meta={`${(dependents ?? []).length} cadastrado${(dependents ?? []).length === 1 ? "" : "s"}`}
        />
        <DependentsManager dependents={dependents ?? []} />
      </Panel>

      <div className="mb-5">
        <AutoDeductiblesImport year={year} candidates={candidates} />
      </div>

      <Panel className="mb-5">
        <PanelHeader
          title={`Pagamentos dedutíveis · ${year}`}
          meta="Saúde, educação, INSS, PGBL, pensão, doações"
        />
        <DeductiblesManager year={year} payments={pays ?? []} />
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title={`Outras rendas · ${year}`}
          meta="Coisas que NÃO estão no app (salário CLT externo, freelance, etc)"
        />
        <OtherIncomesManager year={year} incomes={others ?? []} />
      </Panel>

      <Panel className="mb-5">
        <PanelHeader
          title="Compartilhar com contador"
          meta="Acesso temporário, somente-leitura, totalmente auditado"
        />
        <AccountantSection
          year={year}
          invites={invites ?? []}
          accesses={(accesses ?? []) as never}
          audit={(audit ?? []) as never}
        />
      </Panel>
    </>
  );
}
