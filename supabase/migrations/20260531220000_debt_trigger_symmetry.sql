-- ============================================================================
-- FIN: simetria do trigger de saldo de dívida (ROADMAP FIN, D13)
-- ============================================================================
-- BUG: a aplicação de pagamento usava greatest(0, balance - amount) (clampa em
-- zero), mas a REVERSÃO somava amount inteiro de volta. Se um pagamento foi
-- clampado (pagou mais que o saldo devedor), reverter creditava a mais — o
-- saldo da dívida ficava corrompido e assimétrico.
--
-- FIX (D13): aplicação e reversão ficam SIMÉTRICAS — o saldo pode ficar
-- negativo (= pagamento a mais, "crédito"), o que torna a reversão exata. A
-- EXIBIÇÃO clampa em zero (services/debts + debt-card). Sem coluna extra, sem
-- backfill arriscado.

set search_path = public;

create or replace function public.tg_apply_transaction_to_debt_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_apply_old boolean;
  v_apply_new boolean;
begin
  -- Só conta expense não-histórica. Income/transfer ignoram.
  if (tg_op = 'INSERT') then
    v_apply_new := new.debt_id is not null
                   and new.kind = 'expense'
                   and coalesce(new.is_historical_ir_only, false) = false;
    if v_apply_new then
      update public.debts
        set current_balance = round(current_balance - new.amount_account, 2)
        where id = new.debt_id;
    end if;
    return new;

  elsif (tg_op = 'UPDATE') then
    v_apply_old := old.debt_id is not null
                   and old.kind = 'expense'
                   and coalesce(old.is_historical_ir_only, false) = false;
    v_apply_new := new.debt_id is not null
                   and new.kind = 'expense'
                   and coalesce(new.is_historical_ir_only, false) = false;
    -- Reversão EXATA (mesmo número que foi aplicado) + nova aplicação.
    if v_apply_old then
      update public.debts
        set current_balance = round(current_balance + old.amount_account, 2)
        where id = old.debt_id;
    end if;
    if v_apply_new then
      update public.debts
        set current_balance = round(current_balance - new.amount_account, 2)
        where id = new.debt_id;
    end if;
    return new;

  elsif (tg_op = 'DELETE') then
    v_apply_old := old.debt_id is not null
                   and old.kind = 'expense'
                   and coalesce(old.is_historical_ir_only, false) = false;
    if v_apply_old then
      update public.debts
        set current_balance = round(current_balance + old.amount_account, 2)
        where id = old.debt_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

revoke all on function public.tg_apply_transaction_to_debt_balance() from public;

comment on function public.tg_apply_transaction_to_debt_balance is
  'Aplica/reverte pagamento de dívida no saldo de forma SIMÉTRICA. Saldo pode '
  'ficar negativo (pagamento a mais); a exibição clampa em zero.';
