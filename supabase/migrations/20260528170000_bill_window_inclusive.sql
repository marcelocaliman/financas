-- ============================================================================
-- Finanças — bill_window_for_due_date com close_day inclusivo
--
-- Semântica anterior (errada do ponto de vista do usuário):
--   close_day=26 → ciclo [26/mês-anterior, 25/mês-atual] (close exclusivo)
--   Resultado: despesas DO dia 26 caíam na fatura SEGUINTE, não na que
--   fechava nesse dia. Usuário esperava que "fecha 26" significasse
--   "tudo até 26 inclusive entra".
--
-- Semântica correta:
--   close_day=26 → ciclo [27/mês-anterior, 26/mês-atual] (close inclusivo)
--   Tudo até o dia 26 (incluso) entra na fatura que fecha nesse dia.
--
-- Impacto downstream:
--   - credit_card_bill_amount(card, due_date) usa esta função → valor
--     da fatura recalculado corretamente.
--   - materialize_recurrence (autosync de pagamento) → usa o valor certo.
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
begin
  -- Mesma lógica de qual mês fechou: se due > close, mesmo mês; senão mês anterior.
  if p_due_day > p_close_day then
    v_target_month := date_trunc('month', p_due_date)::date;
  else
    v_target_month := (date_trunc('month', p_due_date) - interval '1 month')::date;
  end if;

  v_last_day := extract(day from (v_target_month + interval '1 month - 1 day'))::int;
  v_close_date := v_target_month + (least(p_close_day, v_last_day) - 1);

  -- Semântica corrigida: close_day é INCLUSIVO. Tudo até esse dia
  -- (incluso) entra na fatura que fecha nesse dia. O ciclo anterior
  -- termina UM DIA ANTES (close-1) — i.e. o ciclo desta fatura começa
  -- exatamente no dia seguinte ao close anterior.
  period_end := v_close_date;
  period_start := (v_close_date - interval '1 month')::date + 1;
  return next;
end;
$$;
