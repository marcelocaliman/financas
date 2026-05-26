-- ============================================================================
-- Finanças — Vinculação de transações a dívidas (debt_id)
--
-- Problema: pagamento de parcela de financiamento (moto, imóvel) entrava
-- como "despesa" qualquer no app, sem trilha pra a dívida que está sendo
-- quitada. Resultado: categoria errada (ex: parcela da moto → Transporte)
-- e patrimônio não refletia a redução do passivo.
--
-- Solução: coluna debt_id em transactions (FK pra debts). Quando setada,
-- trigger atualiza debts.current_balance automaticamente. Vínculo 1-pra-N
-- (uma dívida tem várias parcelas/transações).
--
-- Comportamento do trigger:
--   - INSERT expense com debt_id: debts.current_balance -= amount_account
--   - DELETE: reverte
--   - UPDATE (mudou debt_id ou amount): reverte antigo, aplica novo
--   - Ignora kind != 'expense' (não faz sentido pagar dívida com income)
--   - Ignora is_historical_ir_only=true (lançamento informativo, não real)
-- ============================================================================

set search_path = public;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Coluna debt_id em transactions
-- ────────────────────────────────────────────────────────────────────────────
alter table public.transactions
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

create index if not exists transactions_debt_idx
  on public.transactions(debt_id)
  where debt_id is not null;

comment on column public.transactions.debt_id is
  'Quando setado, esta transação é uma parcela/pagamento da dívida indicada. '
  'Trigger atualiza debts.current_balance automaticamente.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Trigger que aplica delta no debts.current_balance
-- ────────────────────────────────────────────────────────────────────────────
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
  -- Historical IR não conta (informativo).
  if (tg_op = 'INSERT') then
    v_apply_new := new.debt_id is not null
                   and new.kind = 'expense'
                   and coalesce(new.is_historical_ir_only, false) = false;
    if v_apply_new then
      update public.debts
        set current_balance = greatest(0, round(current_balance - new.amount_account, 2))
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
    -- Reverte aplicação antiga (se houver) e aplica nova (se houver).
    if v_apply_old then
      update public.debts
        set current_balance = round(current_balance + old.amount_account, 2)
        where id = old.debt_id;
    end if;
    if v_apply_new then
      update public.debts
        set current_balance = greatest(0, round(current_balance - new.amount_account, 2))
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

drop trigger if exists transactions_apply_to_debt_balance on public.transactions;
create trigger transactions_apply_to_debt_balance
  after insert or update or delete on public.transactions
  for each row execute function public.tg_apply_transaction_to_debt_balance();

revoke all on function public.tg_apply_transaction_to_debt_balance() from public;


-- ────────────────────────────────────────────────────────────────────────────
-- 3) Coluna em category_rules pra sugerir dívida automaticamente
-- ────────────────────────────────────────────────────────────────────────────
alter table public.category_rules
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

comment on column public.category_rules.debt_id is
  'Quando setado, ao auto-categorizar uma tx que casa com este pattern, '
  'também sugere vincular à dívida indicada. Útil pra parcelas recorrentes.';
