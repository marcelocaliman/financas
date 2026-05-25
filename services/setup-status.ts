import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Avalia "saúde do setup" do household. Usado pelo banner do dashboard pra
 * sugerir os próximos passos de configuração depois do wizard.
 *
 * Cada item é independente — se está faltando, mostra dica + link direto.
 */

export type SetupCheck = {
  id: string;
  label: string;
  done: boolean;
  href: string;
  cta?: string;
};

export type SetupStatus = {
  total: number;
  done: number;
  pct: number;
  items: SetupCheck[];
};

export async function getSetupStatus(): Promise<SetupStatus> {
  const supabase = await createClient();
  const currentYear = new Date().getUTCFullYear();

  const [
    { count: accCount },
    { count: filerCount },
    { count: depCount },
    { count: fonteCount },
    { count: recurringCount },
    { count: investCount },
    { count: snapshotCount },
    { data: settings },
  ] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("ir_filers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("ir_dependents").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("fontes_pagadoras").select("id", { count: "exact", head: true }),
    supabase.from("recurring_rules").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("investments").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("ir_prior_year_balances").select("id", { count: "exact", head: true }).eq("year", currentYear - 1),
    supabase.from("ir_settings").select("*").maybeSingle(),
  ]);

  const items: SetupCheck[] = [
    {
      id: "accounts",
      label: "Cadastrar contas (com saldo atual)",
      done: (accCount ?? 0) > 0,
      href: "/contas",
      cta: "Cadastrar conta",
    },
    {
      id: "filer",
      label: "Cadastrar declarante (CPF + ocupação)",
      done: (filerCount ?? 0) > 0,
      href: `/ir/${currentYear}/configuracoes`,
      cta: "Configurar IR",
    },
    {
      id: "fontes",
      label: "Cadastrar fontes pagadoras (PJ, banco, plano de saúde)",
      done: (fonteCount ?? 0) > 0,
      href: `/ir/${currentYear}/configuracoes`,
      cta: "Cadastrar fontes",
    },
    {
      id: "recurring",
      label: "Cadastrar recorrências (salário, despesas fixas)",
      done: (recurringCount ?? 0) > 0,
      href: "/recorrentes",
      cta: "Cadastrar recorrências",
    },
    {
      id: "investments",
      label: "Cadastrar investimentos (Tesouro, ações, FIIs)",
      done: (investCount ?? 0) > 0,
      href: "/investimentos",
      cta: "Cadastrar investimentos",
    },
    {
      id: "snapshot",
      label: `Cadastrar saldos 31/12/${currentYear - 1} (declaração anterior)`,
      done: (snapshotCount ?? 0) > 0,
      href: `/ir/${currentYear - 1}/configuracoes`,
      cta: "Cadastrar saldos",
    },
    {
      id: "settings",
      label: "Configurar modelo IR (simples/completo/auto)",
      done: !!settings,
      href: `/ir/${currentYear}/configuracoes`,
      cta: "Configurar IR",
    },
    {
      id: "dependentes",
      label: "Cadastrar dependentes (opcional, se tiver filhos)",
      // Considera "done" se filer for solteiro ou se já cadastrou pelo menos 1
      done: (depCount ?? 0) > 0 || (filerCount ?? 0) === 1,
      href: `/ir/${currentYear}/configuracoes`,
      cta: "Cadastrar dependentes",
    },
  ];

  const done = items.filter((i) => i.done).length;
  return {
    total: items.length,
    done,
    pct: items.length > 0 ? done / items.length : 0,
    items,
  };
}
