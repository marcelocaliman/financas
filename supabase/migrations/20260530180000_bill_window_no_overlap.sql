-- ============================================================================
-- bill_window_for_due_date: corrige overlap de ciclos quando close_day é alto
-- ============================================================================
-- Bug (auditoria, schema-db#2): period_start vinha de
--   (v_close_date - interval '1 month') + 1
-- que clampa pro último dia do MÊS ANTERIOR, não pro close real do ciclo
-- anterior. Pra close_day=31: fatura de fev fecha 28/fev e period_start virava
-- 29/jan — mas a fatura de jan fecha 31/jan, então 29,30,31/jan caíam em AMBAS.
-- No fallback por date de credit_card_bill_amount, despesas desses dias eram
-- somadas em duas faturas (inflando ambas + o pagamento auto-sincronizado).
--
-- Fix: period_start = (close do ciclo ANTERIOR, com o mesmo clamp) + 1 dia.
-- Assim janeiro termina 31/jan e fevereiro começa 01/fev — sem overlap nem
-- buraco. Txs com bill_period_end explícito (match exato) não são afetadas.
-- ============================================================================

set search_path = public;

create or replace function public.bill_window_for_due_date(
  p_close_day integer,
  p_due_day integer,
  p_due_date date
)
returns table(period_start date, period_end date)
language plpgsql
immutable
as $$
declare
  v_target_month date;
  v_last_day int;
  v_close_date date;
  v_prev_month date;
  v_prev_last_day int;
  v_prev_close_date date;
begin
  if p_due_day > p_close_day then
    v_target_month := date_trunc('month', p_due_date)::date;
  else
    v_target_month := (date_trunc('month', p_due_date) - interval '1 month')::date;
  end if;

  v_last_day := extract(day from (v_target_month + interval '1 month - 1 day'))::int;
  v_close_date := v_target_month + (least(p_close_day, v_last_day) - 1);

  -- Close do ciclo ANTERIOR, com o mesmo clamp ao último dia daquele mês.
  v_prev_month := (v_target_month - interval '1 month')::date;
  v_prev_last_day := extract(day from (v_prev_month + interval '1 month - 1 day'))::int;
  v_prev_close_date := v_prev_month + (least(p_close_day, v_prev_last_day) - 1);

  period_end := v_close_date;
  period_start := v_prev_close_date + 1; -- dia seguinte ao close anterior
  return next;
end;
$$;
