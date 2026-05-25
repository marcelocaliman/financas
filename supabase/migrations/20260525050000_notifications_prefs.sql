-- ============================================================================
-- Finanças — Preferências de notificação por household
--
-- Habilita ou desabilita cada tipo de notificação. Default: tudo ON pra
-- novos usuários. Estado salvo por household (não por usuário individual
-- porque o app é multi-user mas opera no modelo household).
-- ============================================================================

set search_path = public;

create table if not exists public.notification_preferences (
  household_id uuid primary key references public.households(id) on delete cascade,
  -- Notificações ativas (true = enviar email)
  darf_due_soon boolean not null default true,
  ir_retroactive_gaps boolean not null default true,
  recurring_upcoming boolean not null default false, -- noisy, default off
  monthly_recap boolean not null default true,
  -- Quando a última de cada tipo foi enviada (pra evitar spam)
  darf_due_soon_last_sent timestamptz,
  ir_retroactive_gaps_last_sent timestamptz,
  monthly_recap_last_sent timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Preferências de notificação por household + carimbo da última envio de cada tipo (evita spam).';

alter table public.notification_preferences enable row level security;

create policy "notification_prefs: read own household"
  on public.notification_preferences for select
  to authenticated
  using (household_id = current_household_id());

create policy "notification_prefs: update own household"
  on public.notification_preferences for update
  to authenticated
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "notification_prefs: insert own household"
  on public.notification_preferences for insert
  to authenticated
  with check (household_id = current_household_id());

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.tg_set_updated_at();
