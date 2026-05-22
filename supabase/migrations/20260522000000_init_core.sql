-- ============================================================================
-- Finanças — migration inicial
-- Núcleo: households, users, accounts, categories, transactions
-- RLS em toda tabela transacional desde o dia 1.
-- ============================================================================

set search_path = public;

-- Extensions (idempotente)
create extension if not exists "pgcrypto";


-- ============================================================================
-- HELPERS
-- ============================================================================

-- Atualiza updated_at automaticamente
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- household_id do usuário atual.
-- SECURITY DEFINER para não recorrer ao RLS de users (evita recursão).
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.users where id = auth.uid()
$$;

revoke all on function public.current_household_id() from public;
grant execute on function public.current_household_id() to authenticated;


-- ============================================================================
-- HOUSEHOLDS
-- ============================================================================
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;

create policy "household: members can read"
  on public.households for select to authenticated
  using (id = public.current_household_id());

create policy "household: admin can update"
  on public.households for update to authenticated
  using (id = public.current_household_id())
  with check (id = public.current_household_id());


-- ============================================================================
-- USERS (perfil, atrelado a auth.users)
-- ============================================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create index users_household_id_idx on public.users(household_id);

alter table public.users enable row level security;

create policy "users: see household members"
  on public.users for select to authenticated
  using (household_id = public.current_household_id());

create policy "users: edit self"
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================================
-- ACCOUNTS (contas, cartões, custódias)
-- ============================================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  institution text not null,
  type text not null check (type in ('checking', 'savings', 'credit_card', 'investment', 'cash')),
  name text not null,
  color text,
  current_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_household_id_idx on public.accounts(household_id);
create index accounts_household_active_idx on public.accounts(household_id, is_active);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.tg_set_updated_at();

alter table public.accounts enable row level security;

create policy "accounts: full access within household"
  on public.accounts for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- CATEGORIES
-- ============================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  parent_id uuid references public.categories(id) on delete set null,
  rules jsonb not null default '[]'::jsonb,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index categories_household_id_idx on public.categories(household_id);
create index categories_household_kind_idx on public.categories(household_id, kind) where is_archived = false;

alter table public.categories enable row level security;

create policy "categories: full access within household"
  on public.categories for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- TRANSACTIONS — coração do app
-- ============================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount numeric(14, 2) not null check (amount >= 0),
  description text not null,
  payment_method text check (
    payment_method is null
    or payment_method in ('credit', 'debit', 'pix', 'cash', 'auto_debit', 'transfer')
  ),
  date date not null,
  created_by uuid not null references public.users(id) on delete restrict,
  category_source text not null default 'manual' check (category_source in ('manual', 'rule', 'ai')),
  category_confidence numeric(3, 2) check (category_confidence is null or (category_confidence >= 0 and category_confidence <= 1)),
  transfer_pair_id uuid,
  is_recurring boolean not null default false,
  recurring_rule_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_household_date_idx on public.transactions(household_id, date desc);
create index transactions_account_date_idx on public.transactions(account_id, date desc);
create index transactions_category_idx on public.transactions(category_id) where category_id is not null;
create index transactions_transfer_pair_idx on public.transactions(transfer_pair_id) where transfer_pair_id is not null;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.tg_set_updated_at();

alter table public.transactions enable row level security;

create policy "transactions: full access within household"
  on public.transactions for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- SEED de categorias padrão (15 que cobrem 95% dos casos)
-- ============================================================================
create or replace function public.seed_default_categories(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (household_id, name, icon, kind, sort_order) values
    -- Receitas
    (p_household_id, 'Salário',          'briefcase',  'income',  10),
    (p_household_id, 'Renda passiva',    'sparkles',   'income',  20),
    (p_household_id, 'Outras receitas',  'plus-circle','income',  30),
    -- Despesas essenciais
    (p_household_id, 'Mercado',          'shopping-cart', 'expense', 110),
    (p_household_id, 'Moradia',          'home',          'expense', 120),
    (p_household_id, 'Contas',           'receipt',       'expense', 130),
    (p_household_id, 'Transporte',       'car',           'expense', 140),
    (p_household_id, 'Saúde',            'heart-pulse',   'expense', 150),
    (p_household_id, 'Educação',         'book-open',     'expense', 160),
    -- Despesas variáveis
    (p_household_id, 'Delivery',         'utensils',      'expense', 210),
    (p_household_id, 'Restaurantes',     'forks',         'expense', 220),
    (p_household_id, 'Lazer',            'music',         'expense', 230),
    (p_household_id, 'Cuidado pessoal',  'scissors',      'expense', 240),
    (p_household_id, 'Assinaturas',      'rotate-ccw',    'expense', 250),
    (p_household_id, 'Outros gastos',    'circle',        'expense', 990);
end;
$$;

revoke all on function public.seed_default_categories(uuid) from public;
grant execute on function public.seed_default_categories(uuid) to authenticated;


-- ============================================================================
-- BOOTSTRAP — cria household + perfil + seed atomicamente
-- Chamada uma única vez após cadastro (pelo client logo após signup).
-- ============================================================================
create or replace function public.bootstrap_household(
  p_household_name text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'must be authenticated';
  end if;

  -- Já existe perfil pra esse usuário? Retorna o household existente.
  select household_id into v_household_id from public.users where id = v_user_id;
  if found then
    return v_household_id;
  end if;

  insert into public.households (name)
  values (coalesce(nullif(trim(p_household_name), ''), 'Nosso lar'))
  returning id into v_household_id;

  insert into public.users (id, household_id, display_name, role)
  values (v_user_id, v_household_id, coalesce(nullif(trim(p_display_name), ''), 'Sem nome'), 'admin');

  perform public.seed_default_categories(v_household_id);

  return v_household_id;
end;
$$;

revoke all on function public.bootstrap_household(text, text) from public;
grant execute on function public.bootstrap_household(text, text) to authenticated;


-- ============================================================================
-- REALTIME — habilitar publicação para transactions e accounts
-- (Esposa lança no celular, meu app atualiza — Fase 2, mas habilitamos já.)
-- ============================================================================
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.accounts;
