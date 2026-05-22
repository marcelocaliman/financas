-- ============================================================================
-- Finanças — saldo automático em accounts + transfer_direction + create_transfer
-- ============================================================================
-- O current_balance da conta é a soma viva das transações que a afetam.
-- Trigger mantém isso em sincronia automaticamente, sem dor no client.
-- ============================================================================

set search_path = public;


-- ============================================================================
-- TRANSACTIONS: campo transfer_direction
-- Identifica de qual lado da transferência espelhada a linha está.
-- ============================================================================
alter table public.transactions
  add column transfer_direction text
  check (transfer_direction is null or transfer_direction in ('out', 'in'));

-- Coerência: transferências exigem direction + pair_id; outras exigem direction null
alter table public.transactions
  add constraint transactions_transfer_consistency
  check (
    (kind = 'transfer' and transfer_direction is not null and transfer_pair_id is not null)
    or (kind in ('income', 'expense') and transfer_direction is null)
  );


-- ============================================================================
-- HELPER: delta de saldo dado kind + direction + amount
-- ============================================================================
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


-- ============================================================================
-- TRIGGER: mantém accounts.current_balance em sincronia
-- ============================================================================
create or replace function public.tg_apply_transaction_to_balance()
returns trigger
language plpgsql
as $$
declare
  v_old_delta numeric(14, 2);
  v_new_delta numeric(14, 2);
begin
  if (tg_op = 'INSERT') then
    v_new_delta := public.transaction_balance_delta(new.kind, new.transfer_direction, new.amount);
    update public.accounts
      set current_balance = current_balance + v_new_delta
      where id = new.account_id;
    return new;

  elsif (tg_op = 'DELETE') then
    v_old_delta := public.transaction_balance_delta(old.kind, old.transfer_direction, old.amount);
    update public.accounts
      set current_balance = current_balance - v_old_delta
      where id = old.account_id;
    return old;

  elsif (tg_op = 'UPDATE') then
    v_old_delta := public.transaction_balance_delta(old.kind, old.transfer_direction, old.amount);
    v_new_delta := public.transaction_balance_delta(new.kind, new.transfer_direction, new.amount);

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

create trigger transactions_apply_to_balance
  after insert or update or delete on public.transactions
  for each row execute function public.tg_apply_transaction_to_balance();


-- ============================================================================
-- RPC create_transfer — cria duas linhas espelhadas atomicamente
-- ============================================================================
create or replace function public.create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text default null
)
returns uuid -- retorna o transfer_pair_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_user uuid := auth.uid();
  v_pair uuid := gen_random_uuid();
  v_from public.accounts;
  v_to   public.accounts;
  v_desc text;
begin
  if v_household is null then
    raise exception 'no household for user';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'from and to accounts must differ';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select * into v_from from public.accounts
    where id = p_from_account_id and household_id = v_household;
  if not found then
    raise exception 'invalid source account';
  end if;

  select * into v_to from public.accounts
    where id = p_to_account_id and household_id = v_household;
  if not found then
    raise exception 'invalid destination account';
  end if;

  v_desc := coalesce(nullif(trim(p_description), ''), 'Transferência');

  insert into public.transactions
    (household_id, account_id, kind, amount, description, date, created_by,
     transfer_pair_id, transfer_direction)
  values
    (v_household, p_from_account_id, 'transfer', p_amount,
     v_desc || ' → ' || v_to.name, p_date, v_user, v_pair, 'out');

  insert into public.transactions
    (household_id, account_id, kind, amount, description, date, created_by,
     transfer_pair_id, transfer_direction)
  values
    (v_household, p_to_account_id, 'transfer', p_amount,
     v_desc || ' ← ' || v_from.name, p_date, v_user, v_pair, 'in');

  return v_pair;
end;
$$;

revoke all on function public.create_transfer(uuid, uuid, numeric, date, text) from public;
grant execute on function public.create_transfer(uuid, uuid, numeric, date, text) to authenticated;


-- ============================================================================
-- RPC delete_transfer — apaga ambas as linhas espelhadas
-- ============================================================================
create or replace function public.delete_transfer(p_pair_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_count int;
begin
  delete from public.transactions
    where transfer_pair_id = p_pair_id
      and household_id = v_household;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'transfer not found';
  end if;
end;
$$;

revoke all on function public.delete_transfer(uuid) from public;
grant execute on function public.delete_transfer(uuid) to authenticated;
