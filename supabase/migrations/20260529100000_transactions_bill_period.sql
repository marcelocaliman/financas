-- ============================================================================
-- Finanças — bill_period_end e bill_due_date em transactions
--
-- Resolve o problema de PARCELAS em cartão de crédito: uma compra parcelada
-- tem date = data da compra original, mas as parcelas hit faturas FUTURAS.
-- Sem essa coluna, credit_card_bill_amount filtra por date entre period_start
-- e period_end e parcelas caem na fatura errada.
--
-- Agora cada tx de cartão (importada via fatura ou criada manualmente) pode
-- registrar EXPLICITAMENTE a qual ciclo de fatura pertence:
--   - bill_period_end: data de fechamento da fatura (period_end)
--   - bill_due_date: data de vencimento dessa fatura
--
-- A função credit_card_bill_amount passa a usar bill_period_end (precisão)
-- com fallback pra date (legacy/manual sem info).
-- ============================================================================

set search_path = public;

alter table public.transactions
  add column if not exists bill_period_end date,
  add column if not exists bill_due_date date;

create index if not exists transactions_bill_period_end_idx
  on public.transactions (account_id, bill_period_end)
  where bill_period_end is not null;

comment on column public.transactions.bill_period_end is
  'Data de fechamento do ciclo da fatura ao qual esta tx pertence. '
  'Usado pra cartão de crédito: parcelas têm date no passado mas '
  'pertencem a faturas futuras. Quando setado, credit_card_bill_amount '
  'usa esta coluna em vez de date pra agregar a fatura.';

comment on column public.transactions.bill_due_date is
  'Data de vencimento da fatura ao qual esta tx pertence. Informativo, '
  'útil pra "quanto vence em cada mês". Geralmente bill_due_date = '
  'next_business_day(bill_period_end + ~10 dias).';

-- ============================================================================
-- Recria credit_card_bill_amount pra usar bill_period_end (precisão) com
-- fallback pra date (legacy/manual sem info de ciclo).
-- ============================================================================
create or replace function public.credit_card_bill_amount(
  p_card_id uuid,
  p_due_date date
)
returns numeric
language plpgsql
stable
as $$
declare
  v_close_day int;
  v_due_day int;
  v_window record;
  v_total numeric;
begin
  select bill_close_day, bill_due_day
    into v_close_day, v_due_day
  from public.accounts
  where id = p_card_id and type = 'credit_card';

  if v_close_day is null then
    return null;
  end if;

  select * into v_window
  from public.bill_window_for_due_date(
    v_close_day,
    coalesce(v_due_day, v_close_day),
    p_due_date
  );

  -- Soma em duas camadas:
  --   1. Txs com bill_period_end explícito (importadas via fatura) — match
  --      exato com v_window.period_end
  --   2. Txs SEM bill_period_end (manuais, antigas) — usa date no range
  --      [period_start, period_end] como fallback
  select coalesce(sum(amount_account), 0) into v_total
  from public.transactions
  where account_id = p_card_id
    and kind = 'expense'
    and (
      bill_period_end = v_window.period_end
      OR (
        bill_period_end is null
        AND date >= v_window.period_start
        AND date <= v_window.period_end
      )
    );

  return v_total;
end;
$$;

revoke all on function public.credit_card_bill_amount(uuid, date) from public;
grant execute on function public.credit_card_bill_amount(uuid, date) to authenticated, service_role;

comment on function public.credit_card_bill_amount is
  'Calcula o total da fatura de um cartão que vence em p_due_date. Usa '
  'bill_period_end quando explícito (preciso pra parcelas) e cai pra '
  'date como fallback. Soma só kind=expense.';
