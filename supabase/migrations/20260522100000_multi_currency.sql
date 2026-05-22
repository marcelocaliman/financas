-- ============================================================================
-- Finanças — Multi-moeda (BRL ↔ EUR)
-- ============================================================================
-- Adiciona campo `currency` em todas as entidades monetárias.
-- Transações ganham amount_account para o caso "gasto em moeda diferente
-- da conta" (ex.: cartão BRL gasta em EUR no exterior).
-- Nova tabela currency_rates espelha o padrão quote_snapshots (cache compartilhado).
-- users.preferences JSONB armazena display_currency.
-- ============================================================================

set search_path = public;

-- ============================================================================
-- USERS: preferences JSONB
-- ============================================================================
alter table public.users
  add column preferences jsonb not null default '{}'::jsonb;

-- Helper que devolve a display_currency do usuário (default BRL)
create or replace function public.user_display_currency()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(preferences ->> 'display_currency', 'BRL')
    from public.users where id = auth.uid()
$$;

revoke all on function public.user_display_currency() from public;
grant execute on function public.user_display_currency() to authenticated;


-- ============================================================================
-- CURRENCY_RATES
-- ============================================================================
create table public.currency_rates (
  base text not null check (base in ('BRL', 'EUR', 'USD')),
  quote text not null check (quote in ('BRL', 'EUR', 'USD')),
  date date not null,
  rate numeric(14, 8) not null,
  source text not null default 'frankfurter',
  created_at timestamptz not null default now(),
  primary key (base, quote, date)
);

create index currency_rates_pair_date_idx
  on public.currency_rates(base, quote, date desc);

alter table public.currency_rates enable row level security;

create policy "currency_rates: read for authenticated"
  on public.currency_rates for select to authenticated
  using (true);

-- escrita só via service role (cron route)


-- ============================================================================
-- ACCOUNTS: currency
-- ============================================================================
alter table public.accounts
  add column currency text not null default 'BRL'
  check (currency in ('BRL', 'EUR', 'USD'));


-- ============================================================================
-- TRANSACTIONS: currency + amount_account
--
--   currency       = moeda da transação (o que foi efetivamente gasto/recebido)
--   amount         = valor NA moeda da transação (ex.: 85 em EUR)
--   amount_account = valor convertido pra moeda da conta, usado pelo balance
--                    trigger (default = amount quando moedas coincidem)
-- ============================================================================
alter table public.transactions
  add column currency text not null default 'BRL'
  check (currency in ('BRL', 'EUR', 'USD'));

alter table public.transactions
  add column amount_account numeric(14, 2);

-- Default: amount_account = amount quando não preenchido
update public.transactions set amount_account = amount where amount_account is null;
alter table public.transactions alter column amount_account set not null;
alter table public.transactions alter column amount_account set default 0;
alter table public.transactions
  add constraint transactions_amount_account_check check (amount_account >= 0);


-- Atualiza trigger de balance para usar amount_account em vez de amount
create or replace function public.transaction_balance_delta(
  p_kind text,
  p_direction text,
  p_amount numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_kind = 'income'   then p_amount
    when p_kind = 'expense'  then -p_amount
    when p_kind = 'transfer' and p_direction = 'in'  then p_amount
    when p_kind = 'transfer' and p_direction = 'out' then -p_amount
    else 0
  end::numeric(14, 2)
$$;

create or replace function public.tg_apply_transaction_to_balance()
returns trigger
language plpgsql
as $$
declare
  v_old_delta numeric(14, 2);
  v_new_delta numeric(14, 2);
begin
  if (tg_op = 'INSERT') then
    v_new_delta := public.transaction_balance_delta(new.kind, new.transfer_direction, new.amount_account);
    update public.accounts
      set current_balance = current_balance + v_new_delta
      where id = new.account_id;
    return new;

  elsif (tg_op = 'DELETE') then
    v_old_delta := public.transaction_balance_delta(old.kind, old.transfer_direction, old.amount_account);
    update public.accounts
      set current_balance = current_balance - v_old_delta
      where id = old.account_id;
    return old;

  elsif (tg_op = 'UPDATE') then
    v_old_delta := public.transaction_balance_delta(old.kind, old.transfer_direction, old.amount_account);
    v_new_delta := public.transaction_balance_delta(new.kind, new.transfer_direction, new.amount_account);

    if (old.account_id = new.account_id) then
      update public.accounts
        set current_balance = current_balance - v_old_delta + v_new_delta
        where id = new.account_id;
    else
      update public.accounts
        set current_balance = current_balance - v_old_delta
        where id = old.account_id;
      update public.accounts
        set current_balance = current_balance + v_new_delta
        where id = new.account_id;
    end if;
    return new;
  end if;

  return null;
end;
$$;


-- ============================================================================
-- INVESTMENTS: currency
-- ============================================================================
alter table public.investments
  add column currency text not null default 'BRL'
  check (currency in ('BRL', 'EUR', 'USD'));


-- ============================================================================
-- PHYSICAL_ASSETS: currency
-- ============================================================================
alter table public.physical_assets
  add column currency text not null default 'BRL'
  check (currency in ('BRL', 'EUR', 'USD'));


-- ============================================================================
-- GOALS: currency
-- ============================================================================
alter table public.goals
  add column currency text not null default 'BRL'
  check (currency in ('BRL', 'EUR', 'USD'));


-- ============================================================================
-- Realtime publication
-- ============================================================================
alter publication supabase_realtime add table public.currency_rates;
