-- ============================================================================
-- system_alerts — registro de falhas em jobs/actions de background
--
-- Substitui `console.error` em paths críticos onde o usuário NÃO veria o erro
-- (cron, auto-materialize, sync IR pós-liquidação). Registra ocorrência pra
-- diagnóstico posterior e — eventualmente — pra surfaceamento em UI.
--
-- Não é log de auditoria de ações do usuário (esse vive em admin_audit_log).
-- É log de "algo falhou e o usuário precisa saber em algum momento".
-- ============================================================================

set search_path = public;

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  -- Categoria curta (ex: "ir_sync_failed", "auto_materialize_error")
  kind text not null,
  -- Mensagem human-readable
  message text not null,
  -- Contexto extra (stack trace, input que disparou, etc.)
  context jsonb,
  -- Marcado quando o usuário/admin reconhece a falha
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists system_alerts_household_kind_idx
  on public.system_alerts (household_id, kind, created_at desc);

create index if not exists system_alerts_unacknowledged_idx
  on public.system_alerts (created_at desc)
  where acknowledged_at is null;

alter table public.system_alerts enable row level security;

-- Membro do household vê os alertas do seu próprio household
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='system_alerts'
      and policyname='system_alerts: read own household'
  ) then
    create policy "system_alerts: read own household"
      on public.system_alerts for select
      to authenticated
      using (household_id = current_household_id());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='system_alerts'
      and policyname='system_alerts: ack own household'
  ) then
    create policy "system_alerts: ack own household"
      on public.system_alerts for update
      to authenticated
      using (household_id = current_household_id())
      with check (household_id = current_household_id());
  end if;
end $$;

-- Service role pode inserir (server actions e crons)
grant select, update on public.system_alerts to authenticated;
grant insert, select, update on public.system_alerts to service_role;
