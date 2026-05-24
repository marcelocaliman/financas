-- ============================================================================
-- Finanças — Tabelas de gestão de plataforma (admin)
-- ============================================================================
-- 3 tabelas novas pro superadmin operar a plataforma:
--   1. feature_flags  — liga/desliga features globalmente, com gating por tier
--   2. announcements  — banners globais (manutenção, novidade, alerta)
--   3. system_settings — kv genérico (modo manutenção, config interna, etc)
--
-- Todas com RLS: só platform_admin escreve; leitura limitada conforme tabela.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FEATURE FLAGS
-- ----------------------------------------------------------------------------
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  -- 0..100: % dos households elegíveis (futuro: gradual rollout)
  rollout_pct int not null default 100 check (rollout_pct >= 0 and rollout_pct <= 100),
  -- Restringe a tiers específicos. Array vazio = todos os tiers
  enabled_for_tiers text[] not null default array[]::text[],
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.feature_flags is
  'Feature flags do app. Use isFeatureEnabled(key) no código pra gating. '
  'rollout_pct + enabled_for_tiers permitem rollout gradual / por plano.';

alter table public.feature_flags enable row level security;

-- Leitura: authenticated qualquer (apps precisam saber o que está ligado)
create policy "feature_flags: read"
  on public.feature_flags for select to authenticated
  using (true);

-- Escrita: só platform_admin
create policy "feature_flags: write admin only"
  on public.feature_flags for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Seed inicial — algumas flags de exemplo (default OFF)
insert into public.feature_flags (key, enabled, description) values
  ('investments_ai_insights', false, 'Insights gerados por IA na página de investimentos'),
  ('reports_export_pdf', false, 'Exportar relatórios anuais em PDF'),
  ('mobile_push_notifications', false, 'Push notifications (mobile app futuro)'),
  ('financial_planner_chat', false, 'Chat com IA planejadora financeira'),
  ('open_banking_sync', false, 'Conexão automática com bancos (Pluggy/GoCardless)'),
  ('multi_currency_advanced', true, 'Conversão multi-moeda com cotação live (já ON)')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2. ANNOUNCEMENTS — banner global pros usuários
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  -- Vigência (NULL = imediato / sem fim)
  starts_at timestamptz default now(),
  ends_at timestamptz,
  -- Quem viu já não vê de novo (se dismissible)
  dismissible boolean not null default true,
  -- Link opcional
  link_url text,
  link_label text,
  -- Restringe a tier específico (NULL = todos)
  target_tier text check (target_tier is null or target_tier in ('free', 'pro', 'family', 'lifetime')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.announcements is
  'Anúncios globais (manutenção programada, novidade, alerta). '
  'Renderizados como banner no app quando ativos (starts_at <= now <= ends_at).';

create index if not exists announcements_active_idx
  on public.announcements(starts_at, ends_at);

alter table public.announcements enable row level security;

-- Leitura: authenticated qualquer (precisa ver os anúncios)
create policy "announcements: read"
  on public.announcements for select to authenticated
  using (true);

-- Escrita: só platform_admin
create policy "announcements: write admin only"
  on public.announcements for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Tabela de dispensa (quem dispensou o quê)
create table if not exists public.announcement_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.announcement_dismissals enable row level security;

create policy "announcement_dismissals: own"
  on public.announcement_dismissals for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. SYSTEM SETTINGS — kv genérico
-- ----------------------------------------------------------------------------
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.system_settings is
  'KV de configurações de plataforma (modo manutenção, limites, etc). '
  'Lido server-side em código quando necessário.';

alter table public.system_settings enable row level security;

-- Leitura admin only (config interna pode ser sensível)
create policy "system_settings: admin read"
  on public.system_settings for select to authenticated
  using (public.is_platform_admin());

create policy "system_settings: admin write"
  on public.system_settings for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Seed inicial
insert into public.system_settings (key, value, description) values
  ('maintenance_mode', 'false'::jsonb, 'Quando true, app bloqueia acesso e mostra página de manutenção'),
  ('signup_enabled', 'true'::jsonb, 'Quando false, novos cadastros são bloqueados'),
  ('default_trial_days', '14'::jsonb, 'Dias de trial padrão pra novos households (quando ativar billing)'),
  ('platform_name', '"Finanças"'::jsonb, 'Nome exibido em emails, política, termos')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Functions admin — agregações temporais pra charts
-- ----------------------------------------------------------------------------

-- Crescimento de households por dia nos últimos N dias
create or replace function public.admin_household_growth(p_days int default 30)
returns table (date date, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  with series as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date::date,
      '1 day'::interval
    )::date as d
  )
  select
    series.d as date,
    coalesce(count(h.id), 0) as count
  from series
  left join households h on h.created_at::date = series.d
  group by series.d
  order by series.d;
$$;

revoke all on function public.admin_household_growth(int) from public;
grant execute on function public.admin_household_growth(int) to authenticated;

-- Crescimento de usuários por dia nos últimos N dias
create or replace function public.admin_user_growth(p_days int default 30)
returns table (date date, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  with series as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date::date,
      '1 day'::interval
    )::date as d
  )
  select
    series.d as date,
    coalesce(count(u.id), 0) as count
  from series
  left join users u on u.created_at::date = series.d
  group by series.d
  order by series.d;
$$;

revoke all on function public.admin_user_growth(int) from public;
grant execute on function public.admin_user_growth(int) to authenticated;

-- Volume de ações admin por dia nos últimos N dias
create or replace function public.admin_action_volume(p_days int default 30)
returns table (date date, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  with series as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date::date,
      '1 day'::interval
    )::date as d
  )
  select
    series.d as date,
    coalesce(count(a.id), 0) as count
  from series
  left join admin_audit_log a on a.created_at::date = series.d
  group by series.d
  order by series.d;
$$;

revoke all on function public.admin_action_volume(int) from public;
grant execute on function public.admin_action_volume(int) to authenticated;
