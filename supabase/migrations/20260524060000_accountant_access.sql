-- ============================================================================
-- Finanças — Acesso temporário pra contadores
-- ============================================================================
-- Permite ao usuário convidar um contador (CRC ativo) pra acessar APENAS as
-- páginas IR do seu household, em modo somente-leitura, por um período
-- definido. Audit log completo + revogação instantânea.
--
-- Modelo:
--  - accountant_profiles: identidade do contador (vive paralelo aos users
--    do app — NÃO tem household_id, pra não conflitar com bootstrap)
--  - accountant_invites: convites pendentes/aceitos enviados pelo titular
--  - accountant_household_access: vínculo ativo accountant ↔ household
--  - accountant_audit_log: cada view, export, etc.
--
-- RLS: tabelas IR já existentes ganham policy "contador read-only".
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1) accountant_profiles — identidade do contador
-- ============================================================================
create table public.accountant_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  crc_number text, -- CRC opcional pro MVP (ex.: "CRC-MG 123456")
  crc_state text check (crc_state is null or crc_state ~ '^[A-Z]{2}$'),
  phone text,
  accepted_dpa_at timestamptz not null,
  /** Hash dos termos aceitos (pra evidência se mudarem). */
  dpa_terms_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accountant_profiles_email_idx
  on public.accountant_profiles(lower(email));

alter table public.accountant_profiles enable row level security;

-- Contador vê só o próprio perfil
create policy "accountant_profiles: self read"
  on public.accountant_profiles for select to authenticated
  using (id = auth.uid());

create policy "accountant_profiles: self update"
  on public.accountant_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "accountant_profiles: self insert"
  on public.accountant_profiles for insert to authenticated
  with check (id = auth.uid());


-- ============================================================================
-- 2) accountant_invites — convites emitidos pelo titular
-- ============================================================================
create table public.accountant_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_by uuid not null references public.users(id),
  /** Email do contador convidado (normalizado lowercase) */
  email text not null,
  /** Token único pra autenticar o convite (32 chars random) */
  token text not null unique,
  /** Escopo do acesso. Por enquanto só "ir_readonly". */
  scope text not null default 'ir_readonly'
    check (scope in ('ir_readonly')),
  /** Anos IR liberados (ex.: [2024, 2025]). */
  years_allowed integer[] not null default '{}'::integer[],
  /** Quando o link expira (pra aceitação) */
  expires_at timestamptz not null,
  /** Quando o contador aceitou o convite */
  accepted_at timestamptz,
  /** Refere accountant_profile quando aceito */
  accepted_by uuid references public.accountant_profiles(id),
  /** Revogado pelo titular antes de aceitar */
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index accountant_invites_household_idx
  on public.accountant_invites(household_id);
create index accountant_invites_token_idx
  on public.accountant_invites(token);
create index accountant_invites_email_idx
  on public.accountant_invites(lower(email));

alter table public.accountant_invites enable row level security;

-- Titular do household vê/gerencia
create policy "accountant_invites: household members manage"
  on public.accountant_invites for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- 3) accountant_household_access — vínculo ativo
-- ============================================================================
create table public.accountant_household_access (
  id uuid primary key default gen_random_uuid(),
  accountant_id uuid not null references public.accountant_profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  invite_id uuid references public.accountant_invites(id) on delete set null,
  scope text not null default 'ir_readonly'
    check (scope in ('ir_readonly')),
  years_allowed integer[] not null default '{}'::integer[],
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  /** Última visita (atualizado em cada acesso) */
  last_accessed_at timestamptz,
  unique (accountant_id, household_id)
);

create index accountant_access_accountant_idx
  on public.accountant_household_access(accountant_id);
create index accountant_access_household_idx
  on public.accountant_household_access(household_id)
  where revoked_at is null;

alter table public.accountant_household_access enable row level security;

-- Titular vê todos os acessos do seu household
create policy "accountant_access: titular reads"
  on public.accountant_household_access for select to authenticated
  using (household_id = public.current_household_id());

-- Titular pode revogar (update) ou apagar
create policy "accountant_access: titular updates"
  on public.accountant_household_access for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "accountant_access: titular deletes"
  on public.accountant_household_access for delete to authenticated
  using (household_id = public.current_household_id());

-- Contador vê os próprios acessos
create policy "accountant_access: accountant self reads"
  on public.accountant_household_access for select to authenticated
  using (accountant_id = auth.uid());


-- ============================================================================
-- 4) accountant_audit_log — toda ação visível pro titular
-- ============================================================================
create table public.accountant_audit_log (
  id uuid primary key default gen_random_uuid(),
  accountant_id uuid not null references public.accountant_profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  /** view_dashboard | view_year | view_section | export_dec | export_txt | login */
  action text not null,
  /** Ano-base alvo (quando aplicável) */
  target_year integer,
  /** Detalhes adicionais (ex.: filename do export, seção) */
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index accountant_audit_household_idx
  on public.accountant_audit_log(household_id, created_at desc);
create index accountant_audit_accountant_idx
  on public.accountant_audit_log(accountant_id, created_at desc);

alter table public.accountant_audit_log enable row level security;

-- Titular vê o audit do seu household
create policy "accountant_audit: titular reads"
  on public.accountant_audit_log for select to authenticated
  using (household_id = public.current_household_id());

-- Contador vê o próprio audit
create policy "accountant_audit: accountant self reads"
  on public.accountant_audit_log for select to authenticated
  using (accountant_id = auth.uid());


-- ============================================================================
-- 5) HELPER — checa se o auth.uid atual é contador com acesso vigente
-- ============================================================================
create or replace function public.is_accountant_with_access(
  p_household_id uuid,
  p_year integer default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.accountant_household_access aha
      where aha.accountant_id = auth.uid()
        and aha.household_id = p_household_id
        and aha.revoked_at is null
        and aha.expires_at > now()
        and (p_year is null or p_year = any(aha.years_allowed))
  );
$$;

revoke all on function public.is_accountant_with_access(uuid, integer) from public;
grant execute on function public.is_accountant_with_access(uuid, integer) to authenticated;


-- ============================================================================
-- 6) RLS — políticas SELECT pra contador em todas as tabelas que ele lê
-- ============================================================================
-- Bens (acesso read-only)
create policy "accounts: accountant read"
  on public.accounts for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "investments: accountant read"
  on public.investments for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "investment_movements: accountant read"
  on public.investment_movements for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "investment_yields: accountant read"
  on public.investment_yields for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "physical_assets: accountant read"
  on public.physical_assets for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "transactions: accountant read"
  on public.transactions for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "categories: accountant read"
  on public.categories for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "households: accountant read"
  on public.households for select to authenticated
  using (public.is_accountant_with_access(id));

-- IR tables
create policy "ir_settings: accountant read"
  on public.ir_settings for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "ir_dependents: accountant read"
  on public.ir_dependents for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "ir_deductible_payments: accountant read"
  on public.ir_deductible_payments for select to authenticated
  using (public.is_accountant_with_access(household_id, year));

create policy "ir_other_incomes: accountant read"
  on public.ir_other_incomes for select to authenticated
  using (public.is_accountant_with_access(household_id, year));

create policy "ir_darfs: accountant read"
  on public.ir_darfs for select to authenticated
  using (public.is_accountant_with_access(household_id, year));

create policy "ir_loss_carryforward: accountant read"
  on public.ir_loss_carryforward for select to authenticated
  using (public.is_accountant_with_access(household_id));

create policy "ir_year_snapshots: accountant read"
  on public.ir_year_snapshots for select to authenticated
  using (public.is_accountant_with_access(household_id, year));


-- ============================================================================
-- 7) TRIGGER pra updated_at em accountant_profiles
-- ============================================================================
create trigger accountant_profiles_set_updated_at
  before update on public.accountant_profiles
  for each row execute function public.tg_set_updated_at();


-- ============================================================================
-- 8) Helper: marcar último acesso (chamado pela app server-side)
-- ============================================================================
create or replace function public.touch_accountant_access(p_household_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.accountant_household_access
    set last_accessed_at = now()
    where accountant_id = auth.uid()
      and household_id = p_household_id
      and revoked_at is null
      and expires_at > now();
$$;

revoke all on function public.touch_accountant_access(uuid) from public;
grant execute on function public.touch_accountant_access(uuid) to authenticated;
