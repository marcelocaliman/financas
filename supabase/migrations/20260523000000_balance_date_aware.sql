-- ============================================================================
-- 20260523000000_balance_date_aware.sql
--
-- Bug: transactions com date no futuro (materialização antecipada de
-- recorrências, lançamentos pré-agendados) já alteravam accounts.current_balance
-- imediatamente — porque o trigger antigo aplicava o delta em qualquer INSERT
-- sem ligar pra data. Sintoma: usuário via "caixa parado" inflado por salários
-- ainda não recebidos, despesas ainda não pagas, etc.
--
-- Fix raiz: o trigger só aplica o delta se `date <= today` (em São Paulo).
-- Coluna `balance_applied_at` rastreia se o delta já foi efetivamente
-- contabilizado no current_balance — null = pendente, timestamp = aplicado.
-- RPC `advance_pending_balances()` é chamada por cron diário pra "promover"
-- transações futuras conforme a data delas vira presente.
--
-- O current_balance permanece como a fonte canônica do saldo de cada conta,
-- agora respeitando a realidade temporal — todo lugar que lê current_balance
-- continua correto sem precisar de correção em view-time.
-- ============================================================================

-- 1. Drop o trigger antigo pra fazer backfill sem efeitos colaterais
drop trigger if exists transactions_apply_to_balance on public.transactions;

-- 2. Nova coluna: timestamp de quando o delta foi aplicado (null = pendente)
alter table public.transactions
  add column if not exists balance_applied_at timestamptz;

-- Índice parcial: cron busca rows com balance_applied_at IS NULL E date <= hoje.
-- Como a maioria das transações está aplicada, o índice fica pequeno.
create index if not exists transactions_pending_balance_idx
  on public.transactions(date)
  where balance_applied_at is null;

-- 3. BACKFILL: reverte deltas de transações FUTURAS que foram incorretamente
--    aplicadas pelo trigger antigo. Pra cada conta, soma os deltas das tx
--    futuras e subtrai do current_balance, voltando-o à realidade atual.
do $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  rec record;
begin
  for rec in
    select t.account_id,
           sum(public.transaction_balance_delta(t.kind, t.transfer_direction, t.amount_account)) as future_delta
    from public.transactions t
    where t.date > v_today
      and t.balance_applied_at is null
    group by t.account_id
  loop
    update public.accounts
    set current_balance = round(current_balance - rec.future_delta, 2)
    where id = rec.account_id;
  end loop;
end$$;

-- 4. BACKFILL: marca todas as transações passadas/hoje como já aplicadas.
--    Não dispara o trigger novo (que ainda não foi criado nesta migration).
update public.transactions
set balance_applied_at = now()
where date <= (now() at time zone 'America/Sao_Paulo')::date
  and balance_applied_at is null;

-- 5. Novo trigger: aplica delta apenas se a data já chegou (em SP).
--    AFTER → BEFORE pra poder modificar NEW.balance_applied_at.
create or replace function public.tg_apply_transaction_to_balance()
returns trigger
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_old_applied boolean;
  v_new_applied boolean;
  v_old_delta numeric(14, 2) := 0;
  v_new_delta numeric(14, 2) := 0;
begin
  if (tg_op = 'INSERT') then
    v_new_applied := new.date <= v_today;
    if v_new_applied then
      -- Só marca se o caller não já marcou explicitamente (preserva intent)
      if new.balance_applied_at is null then
        new.balance_applied_at := now();
      end if;
      v_new_delta := public.transaction_balance_delta(
        new.kind, new.transfer_direction, new.amount_account
      );
      update public.accounts
        set current_balance = round(current_balance + v_new_delta, 2)
        where id = new.account_id;
    else
      -- Futuro: garante que fica null mesmo se caller mandou um valor
      new.balance_applied_at := null;
    end if;
    return new;

  elsif (tg_op = 'UPDATE') then
    v_old_applied := old.balance_applied_at is not null;
    v_new_applied := new.date <= v_today;

    if v_old_applied then
      v_old_delta := public.transaction_balance_delta(
        old.kind, old.transfer_direction, old.amount_account
      );
    end if;
    if v_new_applied then
      if new.balance_applied_at is null then
        new.balance_applied_at := now();
      end if;
      v_new_delta := public.transaction_balance_delta(
        new.kind, new.transfer_direction, new.amount_account
      );
    else
      -- Data voltou pro futuro (ou continua futuro): desmarca
      new.balance_applied_at := null;
    end if;

    if (old.account_id = new.account_id) then
      if v_old_delta != 0 or v_new_delta != 0 then
        update public.accounts
          set current_balance = round(current_balance - v_old_delta + v_new_delta, 2)
          where id = new.account_id;
      end if;
    else
      if v_old_delta != 0 then
        update public.accounts
          set current_balance = round(current_balance - v_old_delta, 2)
          where id = old.account_id;
      end if;
      if v_new_delta != 0 then
        update public.accounts
          set current_balance = round(current_balance + v_new_delta, 2)
          where id = new.account_id;
      end if;
    end if;
    return new;

  elsif (tg_op = 'DELETE') then
    v_old_applied := old.balance_applied_at is not null;
    if v_old_applied then
      v_old_delta := public.transaction_balance_delta(
        old.kind, old.transfer_direction, old.amount_account
      );
      update public.accounts
        set current_balance = round(current_balance - v_old_delta, 2)
        where id = old.account_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

-- 6. Recria trigger como BEFORE (precisa pra modificar NEW)
create trigger transactions_apply_to_balance
  before insert or update or delete on public.transactions
  for each row execute function public.tg_apply_transaction_to_balance();


-- ============================================================================
-- RPC: advance_pending_balances()
-- Chamada pelo cron diário. Marca como aplicadas todas as transações cujo
-- date já chegou (≤ hoje em SP) e que ainda não tinham sido aplicadas. O
-- trigger UPDATE faz o resto: aplica o delta ao current_balance.
-- ============================================================================
create or replace function public.advance_pending_balances()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.transactions
  set balance_applied_at = now()
  where date <= (now() at time zone 'America/Sao_Paulo')::date
    and balance_applied_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.advance_pending_balances() from public;
grant execute on function public.advance_pending_balances() to service_role;
