-- ============================================================================
-- FIN: date-gate do trigger de dívida (espelha balance_applied_at) — ROADMAP
-- ============================================================================
-- O trigger de saldo de CONTA já é date-aware (só aplica date<=hoje; futuras
-- esperam o cron). O de DÍVIDA aplicava qualquer data — um pagamento futuro
-- reduzia a dívida na hora. Aqui adicionamos `debt_applied_at` (espelho de
-- balance_applied_at): pagamento futuro só baixa a dívida quando a data chega
-- (via advance_pending_balances). Mantém a simetria já corrigida.

set search_path = public;

-- 1) Coluna de controle (mirror de balance_applied_at).
alter table public.transactions
  add column if not exists debt_applied_at timestamptz;

-- 2) DROP do trigger antigo ANTES do backfill (pra o backfill não disparar nada).
drop trigger if exists transactions_apply_to_debt_balance on public.transactions;

-- 3) Backfill seguro (sem trigger ativo):
--    - past/today já estão no saldo → marca como aplicado.
update public.transactions
  set debt_applied_at = coalesce(balance_applied_at, now())
  where debt_id is not null and kind = 'expense'
    and coalesce(is_historical_ir_only, false) = false
    and date <= (now() at time zone 'America/Sao_Paulo')::date;
--    - futuras foram aplicadas POR ENGANO pelo trigger antigo → reverte do
--      saldo da dívida e deixa debt_applied_at null (auditado: 0 hoje).
update public.debts d
  set current_balance = round(current_balance + coalesce((
    select sum(t.amount_account) from public.transactions t
    where t.debt_id = d.id and t.kind = 'expense'
      and coalesce(t.is_historical_ir_only, false) = false
      and t.date > (now() at time zone 'America/Sao_Paulo')::date
  ), 0), 2);

-- 4) Trigger novo: BEFORE, date-aware, simétrico, com debt_applied_at.
create or replace function public.tg_apply_transaction_to_debt_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_old_applied boolean;
  v_new_apply boolean;
begin
  if tg_op = 'INSERT' then
    v_new_apply := new.debt_id is not null and new.kind = 'expense'
                   and coalesce(new.is_historical_ir_only, false) = false
                   and new.date <= v_today;
    if v_new_apply then
      new.debt_applied_at := coalesce(new.debt_applied_at, now());
      update public.debts set current_balance = round(current_balance - new.amount_account, 2)
        where id = new.debt_id;
    else
      new.debt_applied_at := null;
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    v_old_applied := old.debt_applied_at is not null;
    v_new_apply := new.debt_id is not null and new.kind = 'expense'
                   and coalesce(new.is_historical_ir_only, false) = false
                   and new.date <= v_today;
    if v_old_applied then
      update public.debts set current_balance = round(current_balance + old.amount_account, 2)
        where id = old.debt_id;
    end if;
    if v_new_apply then
      new.debt_applied_at := coalesce(new.debt_applied_at, now());
      update public.debts set current_balance = round(current_balance - new.amount_account, 2)
        where id = new.debt_id;
    else
      new.debt_applied_at := null;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.debt_applied_at is not null then
      update public.debts set current_balance = round(current_balance + old.amount_account, 2)
        where id = old.debt_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

-- BEFORE (pra setar new.debt_applied_at).
create trigger transactions_apply_to_debt_balance
  before insert or update or delete on public.transactions
  for each row execute function public.tg_apply_transaction_to_debt_balance();

revoke all on function public.tg_apply_transaction_to_debt_balance() from public;

-- 5) O cron de advance também libera as dívidas futuras quando a data chega:
--    flipar debt_applied_at dispara o trigger BEFORE, que baixa a dívida.
create or replace function public.advance_pending_balances()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update public.transactions
    set balance_applied_at = now()
    where date <= v_today and balance_applied_at is null;
  get diagnostics v_count = row_count;

  update public.transactions
    set debt_applied_at = now()
    where date <= v_today and debt_applied_at is null
      and debt_id is not null and kind = 'expense'
      and coalesce(is_historical_ir_only, false) = false;

  return v_count;
end;
$$;
