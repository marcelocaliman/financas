-- ============================================================================
-- Finanças — Fase 3: investimentos, rendimentos e indexadores
-- ============================================================================

set search_path = public;


-- ============================================================================
-- indexer_history — Selic, CDI, IPCA dia a dia
-- ============================================================================
create table public.indexer_history (
  indexer text not null check (indexer in ('selic', 'cdi', 'ipca')),
  date date not null,
  value numeric(8, 4) not null, -- ex.: 14.5000 (% ao ano para Selic/CDI; 0.43 ao mês para IPCA)
  source text not null default 'bcb',
  created_at timestamptz not null default now(),
  primary key (indexer, date)
);

create index indexer_history_indexer_date_idx
  on public.indexer_history(indexer, date desc);

alter table public.indexer_history enable row level security;

-- Indexadores são públicos para usuários autenticados (não há household).
create policy "indexer: read for authenticated"
  on public.indexer_history for select to authenticated
  using (true);


-- ============================================================================
-- investments — ativos da carteira
-- ============================================================================
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  ticker text not null,
  name text not null,
  asset_type text not null check (asset_type in (
    'fii', 'fixed_income_public', 'fixed_income_private', 'stock', 'etf', 'crypto'
  )),
  indexer text check (indexer is null or indexer in ('selic', 'cdi', 'ipca', 'fixed', 'none')),
  indexer_multiplier numeric(6, 4), -- 1.0000 = 100% Selic, 1.1000 = 110% CDI
  fixed_rate numeric(8, 4), -- pra prefixados, % a.a.
  purchase_date date not null,
  initial_amount numeric(14, 2) not null,
  current_balance numeric(14, 2) not null default 0,
  tax_regime text not null default 'regressive'
    check (tax_regime in ('regressive', 'exempt')),
  is_active boolean not null default true,
  last_yield_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investments_household_id_idx on public.investments(household_id);
create index investments_household_active_idx on public.investments(household_id, is_active);

create trigger investments_set_updated_at
  before update on public.investments
  for each row execute function public.tg_set_updated_at();

alter table public.investments enable row level security;

create policy "investments: full access within household"
  on public.investments for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- investment_yields — histórico de rendimentos mensais por ativo
-- ============================================================================
create table public.investment_yields (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null, -- primeiro dia do mês
  gross_yield numeric(14, 2) not null,
  tax numeric(14, 2) not null default 0,
  net_yield numeric(14, 2) generated always as (gross_yield - tax) stored,
  source text not null default 'manual' check (source in ('manual', 'calculated', 'imported')),
  created_at timestamptz not null default now(),
  unique (investment_id, month)
);

create index investment_yields_household_month_idx
  on public.investment_yields(household_id, month desc);

alter table public.investment_yields enable row level security;

create policy "yields: full access within household"
  on public.investment_yields for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- HELPER: Selic anual → taxa diária (base 252 dias úteis)
-- ============================================================================
create or replace function public.selic_daily_rate(p_annual_pct numeric)
returns numeric
language sql
immutable
as $$
  select power(1 + p_annual_pct / 100.0, 1.0 / 252.0) - 1
$$;


-- ============================================================================
-- HELPER: aplica rendimento diário a um ativo indexado.
-- Lê a Selic do dia (ou última disponível) e aplica ao current_balance.
-- ============================================================================
create or replace function public.apply_daily_yield(p_investment_id uuid)
returns numeric -- novo current_balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.investments;
  v_rate numeric;
  v_daily numeric;
  v_new_balance numeric;
  v_indexer text;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found then raise exception 'investment not found'; end if;
  if not v_inv.is_active then return v_inv.current_balance; end if;
  if v_inv.indexer is null or v_inv.indexer not in ('selic', 'cdi') then
    return v_inv.current_balance;
  end if;

  v_indexer := v_inv.indexer;
  select value into v_rate from public.indexer_history
    where indexer = v_indexer order by date desc limit 1;
  if v_rate is null then return v_inv.current_balance; end if;

  v_daily := public.selic_daily_rate(v_rate * coalesce(v_inv.indexer_multiplier, 1.0));
  v_new_balance := round(v_inv.current_balance * (1 + v_daily), 2);

  update public.investments
    set current_balance = v_new_balance, last_yield_at = current_date
    where id = p_investment_id;

  return v_new_balance;
end;
$$;

revoke all on function public.apply_daily_yield(uuid) from public;
grant execute on function public.apply_daily_yield(uuid) to authenticated;


-- ============================================================================
-- Realtime publications
-- ============================================================================
alter publication supabase_realtime add table public.investments;
alter publication supabase_realtime add table public.investment_yields;
alter publication supabase_realtime add table public.indexer_history;
