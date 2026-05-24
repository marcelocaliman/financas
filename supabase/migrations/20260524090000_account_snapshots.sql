-- ============================================================================
-- Finanças — Snapshots de conta em datas específicas (31/12 etc.)
-- ============================================================================
-- Pra IRPF, a Receita exige "Situação em 31/12 do ano-base". Hoje o app
-- usa current_balance (que reflete agora, não 31/12 do ano que passou).
--
-- Esta tabela armazena o saldo de cada conta em datas específicas.
-- Populada via cron no 1º dia útil de janeiro de cada ano, ou manualmente
-- pelo titular via UI ao "fechar declaração".
-- ============================================================================

set search_path = public;

create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  /** Data do snapshot (geralmente 31/12 de algum ano) */
  snapshot_date date not null,
  balance numeric(14, 2) not null,
  currency text not null default 'BRL' check (currency in ('BRL', 'EUR', 'USD')),
  source text not null default 'manual' check (source in ('manual', 'cron', 'imported')),
  notes text,
  created_at timestamptz not null default now(),
  unique (account_id, snapshot_date)
);

create index account_snapshots_household_date_idx
  on public.account_snapshots(household_id, snapshot_date desc);

alter table public.account_snapshots enable row level security;

create policy "account_snapshots: household members"
  on public.account_snapshots for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "account_snapshots: accountant read"
  on public.account_snapshots for select to authenticated
  using (public.is_accountant_with_access(household_id));


-- ============================================================================
-- investment_snapshots — mesmo conceito pra ativos
-- ============================================================================
create table public.investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  snapshot_date date not null,
  balance numeric(14, 2) not null,
  /** Quantidade no snapshot (pra renda variável) */
  quantity numeric(18, 8),
  currency text not null default 'BRL' check (currency in ('BRL', 'EUR', 'USD')),
  source text not null default 'manual' check (source in ('manual', 'cron', 'imported')),
  notes text,
  created_at timestamptz not null default now(),
  unique (investment_id, snapshot_date)
);

create index investment_snapshots_household_date_idx
  on public.investment_snapshots(household_id, snapshot_date desc);

alter table public.investment_snapshots enable row level security;

create policy "investment_snapshots: household members"
  on public.investment_snapshots for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "investment_snapshots: accountant read"
  on public.investment_snapshots for select to authenticated
  using (public.is_accountant_with_access(household_id));


-- ============================================================================
-- HELPER: snapshot a tabela inteira pra uma data (chamado no "fechar declaração")
-- ============================================================================
create or replace function public.snapshot_accounts_and_investments(
  p_household_id uuid,
  p_date date
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_snapshots (household_id, account_id, snapshot_date, balance, currency, source)
  select
    a.household_id, a.id, p_date, a.current_balance, a.currency, 'manual'
  from public.accounts a
  where a.household_id = p_household_id
    and a.is_active = true
  on conflict (account_id, snapshot_date) do update
    set balance = excluded.balance, source = excluded.source;

  insert into public.investment_snapshots (household_id, investment_id, snapshot_date, balance, quantity, currency, source)
  select
    i.household_id, i.id, p_date, i.current_balance, i.quantity, i.currency, 'manual'
  from public.investments i
  where i.household_id = p_household_id
    and i.is_active = true
  on conflict (investment_id, snapshot_date) do update
    set balance = excluded.balance, quantity = excluded.quantity, source = excluded.source;
end;
$$;

revoke all on function public.snapshot_accounts_and_investments(uuid, date) from public;
grant execute on function public.snapshot_accounts_and_investments(uuid, date) to authenticated;


-- ============================================================================
-- HARDENING: refresh_day_trade_flags com guard de household
-- ============================================================================
-- Antes: qualquer authenticated podia rodar pra qualquer household.
-- Agora: verifica que o caller pertence ao household OU é contador.
create or replace function public.refresh_day_trade_flags(p_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
  v_my_household uuid;
  v_is_accountant boolean;
begin
  -- Guard: o caller precisa pertencer ao household OU ser contador com acesso
  select household_id into v_my_household from public.users where id = auth.uid();
  v_is_accountant := public.is_accountant_with_access(p_household_id);

  if v_my_household != p_household_id and not v_is_accountant then
    raise exception 'Acesso negado ao household %', p_household_id;
  end if;

  -- Day trades = buy + sell mesmo dia no mesmo ativo
  with day_trades as (
    select investment_id, date
      from public.investment_movements
      where household_id = p_household_id
        and kind in ('buy', 'sell')
      group by investment_id, date
      having count(distinct kind) = 2
  )
  update public.investment_movements im
    set is_day_trade = true
    where (im.investment_id, im.date) in (select investment_id, date from day_trades)
      and im.kind = 'sell'
      and im.is_day_trade = false;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
