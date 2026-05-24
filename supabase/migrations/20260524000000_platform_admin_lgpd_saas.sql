-- ============================================================================
-- Finanças — Platform admin + LGPD + SaaS-ready
-- ============================================================================
-- Migration "fundação SaaS". Não afeta RLS existente (zero risco de regressão):
-- queries admin usam SERVICE_ROLE com guard TypeScript via is_platform_admin().
--
-- Estrutura em 4 blocos:
--   1. PLATFORM ADMINS: tabela + helper function
--   2. AUDIT LOG: rastreio de ações admin (LGPD + segurança)
--   3. LGPD: consentimentos + solicitações de export/delete
--   4. SAAS-READY: colunas em households pra subscription/billing
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PLATFORM ADMINS
-- ----------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  notes text
);

comment on table public.platform_admins is
  'Superadmins do sistema. Escopo GLOBAL (não atrelado a household). '
  'Acessam todos os dados via service-role client + guard isPlatformAdmin().';
comment on column public.platform_admins.granted_by is
  'Quem promoveu (audit). NULL pra seed inicial do criador do sistema.';

-- Helper SQL: bool se um user é platform admin
create or replace function public.is_platform_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = uid);
$$;

revoke all on function public.is_platform_admin(uuid) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;

-- RLS na tabela: só platform admin enxerga
alter table public.platform_admins enable row level security;

create policy "platform_admins: superadmin only"
  on public.platform_admins for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- 2. AUDIT LOG
-- ----------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete set null,
  action text not null,
  target_household_id uuid references public.households(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Histórico imutável de ações de platform admin (LGPD + governance). '
  'Preserva quem, o quê, quando, IP/UA, contexto JSON.';

create index if not exists admin_audit_log_admin_idx
  on public.admin_audit_log(admin_user_id, created_at desc);
create index if not exists admin_audit_log_household_idx
  on public.admin_audit_log(target_household_id, created_at desc);
create index if not exists admin_audit_log_action_idx
  on public.admin_audit_log(action);

alter table public.admin_audit_log enable row level security;

-- Só platform admin lê
create policy "admin_audit_log: superadmin read"
  on public.admin_audit_log for select to authenticated
  using (public.is_platform_admin());

-- Inserts vêm via service-role (nunca authenticated direto)
-- Sem update/delete (imutável). Service role bypassa RLS então não precisa policy.

-- ----------------------------------------------------------------------------
-- 3. LGPD: consentimentos
-- ----------------------------------------------------------------------------
-- Rastreia quando o usuário aceitou termos/política. Quando vc atualizar
-- a versão (ex: "v2"), basta pedir novo aceite — fica histórico.
create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in (
    'terms_of_service',
    'privacy_policy',
    'data_processing',
    'marketing_emails',
    'analytics_cookies'
  )),
  version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);

comment on table public.user_consents is
  'Rastreio LGPD de consentimentos (art. 8º): tipo, versão, quando, IP. '
  'Histórico imutável — revogação cria nova linha com granted=false.';

create index if not exists user_consents_user_type_idx
  on public.user_consents(user_id, consent_type, granted_at desc);

alter table public.user_consents enable row level security;

-- Usuário lê os próprios consentimentos
create policy "user_consents: own read"
  on public.user_consents for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Usuário grava os próprios consentimentos
create policy "user_consents: own insert"
  on public.user_consents for insert to authenticated
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3.2 LGPD: data access requests (export / delete)
-- ----------------------------------------------------------------------------
-- Usuário solicita exportar todos os seus dados (LGPD art. 18 V) ou
-- apagar permanentemente (art. 18 VI). Tem prazo legal pra atender (até 15d).
create table if not exists public.data_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'delete', 'rectify')),
  status text not null default 'pending' check (status in (
    'pending', 'in_progress', 'completed', 'rejected'
  )),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Pra export: URL do arquivo gerado (storage signed url)
  -- Pra delete: timestamp do hard-delete
  -- Pra rectify: descrição do que foi corrigido
  result_payload jsonb,
  -- Notas internas do admin sobre o atendimento
  admin_notes text,
  -- Quem atendeu (admin)
  handled_by uuid references auth.users(id) on delete set null
);

comment on table public.data_access_requests is
  'Solicitações LGPD do titular de dados (art. 18): export, delete, rectify. '
  'Prazo legal pra atender: até 15 dias.';

create index if not exists data_access_requests_user_idx
  on public.data_access_requests(user_id, requested_at desc);
create index if not exists data_access_requests_status_idx
  on public.data_access_requests(status, requested_at);

alter table public.data_access_requests enable row level security;

-- Usuário vê os próprios pedidos
create policy "data_access_requests: own read"
  on public.data_access_requests for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Usuário cria os próprios pedidos
create policy "data_access_requests: own insert"
  on public.data_access_requests for insert to authenticated
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. SAAS-READY: colunas em households
-- ----------------------------------------------------------------------------
alter table public.households
  add column if not exists subscription_tier text default 'free'
    check (subscription_tier in ('free', 'pro', 'family', 'lifetime')),
  add column if not exists subscription_status text default 'active'
    check (subscription_status in (
      'active', 'trialing', 'past_due', 'cancelled', 'suspended'
    )),
  add column if not exists subscription_started_at timestamptz default now(),
  add column if not exists subscription_renews_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz;

comment on column public.households.subscription_tier is
  'free | pro | family | lifetime. Inicial todos free até validar modelo.';
comment on column public.households.subscription_status is
  'active | trialing | past_due | cancelled | suspended.';
comment on column public.households.created_by is
  'Usuário criador (= owner). Não pode ser demovido por outro admin do mesmo '
  'household. Pode transferir ownership.';

-- Backfill created_by pra households existentes — pega o primeiro user (admin)
do $$
begin
  update public.households h
  set created_by = (
    select u.id from public.users u
    where u.household_id = h.id
    order by u.created_at asc limit 1
  )
  where h.created_by is null;
end $$;

-- ----------------------------------------------------------------------------
-- 5. SOFT-DELETE em users (LGPD: pseudonimização antes do hard-delete)
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_reason text;

comment on column public.users.is_active is
  'Soft-delete: usuário pode ser desativado antes do hard-delete. '
  'Mantém auditoria histórica intacta sem expor dados.';

-- ----------------------------------------------------------------------------
-- 6. Trigger: ao criar household, setar created_by automaticamente
-- ----------------------------------------------------------------------------
-- (Já é setado via app, mas garantia defensiva.)
-- Não criamos trigger porque created_by precisa vir do contexto da request,
-- e a app é quem sabe. Apenas garantimos NOT NULL futuro via app code.

-- ----------------------------------------------------------------------------
-- 7. Helper: contagem rápida usada na dashboard admin
-- ----------------------------------------------------------------------------
create or replace function public.admin_platform_stats()
returns table (
  total_households bigint,
  total_users bigint,
  active_subscriptions bigint,
  trialing bigint,
  suspended bigint,
  pending_data_requests bigint,
  new_households_7d bigint,
  new_users_7d bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from households),
    (select count(*) from users where is_active = true),
    (select count(*) from households where subscription_status = 'active'),
    (select count(*) from households where subscription_status = 'trialing'),
    (select count(*) from households where subscription_status = 'suspended'),
    (select count(*) from data_access_requests where status = 'pending'),
    (select count(*) from households where created_at > now() - interval '7 days'),
    (select count(*) from users where created_at > now() - interval '7 days');
$$;

revoke all on function public.admin_platform_stats() from public;
grant execute on function public.admin_platform_stats() to authenticated;

-- A função tem security definer — mas vamos garantir que só admin chama via app.
-- (RLS-equivalente via guard TypeScript.)
