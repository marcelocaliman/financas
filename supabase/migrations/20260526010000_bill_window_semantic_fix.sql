-- ============================================================================
-- Finanças — Fix de semântica do bill_close_day
--
-- A versão anterior tratava close_day como "último dia do ciclo" (inclusivo).
-- Bancos brasileiros (XP confirmado via fatura real) interpretam de forma
-- diferente: close_day é o DIA EM QUE A FATURA É FECHADA/GERADA, e o ciclo
-- contém transações desde o close_day do mês anterior (inclusivo) até o
-- dia ANTERIOR ao close_day atual (inclusivo).
--
-- Ex: close=27, due=5
--   Antes:  fatura paga em 5/jun = ciclo [28/04, 27/05]
--   Agora:  fatura paga em 5/jun = ciclo [27/04, 26/05]
--
-- A função `bill_window_for_due_date` agora reflete o comportamento real.
-- O usuário continua configurando close_day livremente — só a interpretação
-- mudou.
-- ============================================================================

set search_path = public;

create or replace function public.bill_window_for_due_date(
  p_close_day int,
  p_due_day int,
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

  -- NOVA semântica: ciclo termina UM DIA ANTES do close_day, e começa
  -- exatamente NO close_day do mês anterior.
  period_end := v_close_date - 1;
  period_start := (v_close_date - interval '1 month')::date;
  return next;
end;
$$;

revoke all on function public.bill_window_for_due_date(int, int, date) from public;
grant execute on function public.bill_window_for_due_date(int, int, date) to authenticated, service_role;
