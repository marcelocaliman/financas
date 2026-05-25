-- ============================================================================
-- Finanças — Marco zero (app_start_date) + transações históricas pra IR
--
-- Resolve o "onboarding mid-period": usuário começa a usar o app numa data X
-- e não quer reconstituir histórico operacional. Mas pra IR funcionar, ainda
-- precisa registrar receitas/dedutíveis do ano todo.
--
-- Conceitos:
--   - households.app_start_date: marco zero. Saldos das contas nessa data são
--     verdade. Dashboards/sobra/gráficos só consideram transações ≥ esta data.
--   - transactions.is_historical_ir_only: quando true, a transação:
--       * APARECE em relatórios IR (rendimentos, dedutíveis, checklist)
--       * NÃO afeta saldo da conta (trigger não aplica delta)
--       * NÃO entra em dashboards operacionais (sobra, top categorias, gráficos)
--     Use pra: salário Aline jan-mai/2026 cadastrado agora (já caiu na conta
--     na realidade — saldo já reflete).
-- ============================================================================

set search_path = public;

-- 1) household.app_start_date
alter table public.households
  add column if not exists app_start_date date not null default current_date;

comment on column public.households.app_start_date is
  'Marco zero — quando o usuário começou a usar o app de verdade. Saldos das contas '
  'nessa data são fonte de verdade. Dashboards/gráficos/sobra mensal só consideram '
  'transações com date >= app_start_date.';

-- 2) transactions.is_historical_ir_only
alter table public.transactions
  add column if not exists is_historical_ir_only boolean not null default false;

comment on column public.transactions.is_historical_ir_only is
  'Quando true, esta transação é informativa pra IR (rendimentos, dedutíveis) mas '
  'NÃO afeta saldo da conta nem aparece em relatórios operacionais (sobra mensal, '
  'top categorias, gráfico receitas vs despesas). Use pra cadastrar receitas/despesas '
  'já passadas, onde o saldo da conta já reflete o efeito.';

-- Index pra acelerar queries de dashboard (filtram is_historical_ir_only=false)
create index if not exists transactions_operational_idx
  on public.transactions (household_id, date)
  where is_historical_ir_only = false;

-- 3) Atualizar trigger de balance pra respeitar is_historical_ir_only
-- (skip aplicação do delta quando true)
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
    -- Histórica IR: nunca afeta saldo
    if new.is_historical_ir_only then
      new.balance_applied_at := null;
      return new;
    end if;
    v_new_applied := new.date <= v_today;
    if v_new_applied then
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
      new.balance_applied_at := null;
    end if;
    return new;

  elsif (tg_op = 'UPDATE') then
    v_old_applied := old.balance_applied_at is not null;
    -- Após edição: histórica IR força balance_applied_at=null
    if new.is_historical_ir_only then
      new.balance_applied_at := null;
      v_new_applied := false;
    else
      v_new_applied := new.date <= v_today;
    end if;

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
