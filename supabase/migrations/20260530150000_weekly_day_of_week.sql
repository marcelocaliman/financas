-- ============================================================================
-- next_recurrence_date: recorrência semanal respeita o day_of_week escolhido
-- ============================================================================
-- Bug (auditoria, recorrentes#1): o caminho 'weekly' andava só em múltiplos de
-- 7*interval a partir de start_date, ignorando p_day_of_week. A UI oferece o
-- campo "Dia da semana" e exibe o weekday escolhido, mas as ocorrências
-- (forecast, próximos 7 dias, materialização) caíam na weekday do start_date.
--
-- Fix: quando p_day_of_week é fornecido, ancora a 1ª ocorrência no primeiro dia
-- >= start_date cuja weekday == p_day_of_week, e itera a partir daí. Espelha o
-- nextFrom() em services/recurrences.ts (extract(dow) e JS getUTCDay() usam a
-- mesma convenção: 0=domingo … 6=sábado).
-- ============================================================================

set search_path = public;

create or replace function public.next_recurrence_date(
  p_start_date date,
  p_frequency recurrence_frequency,
  p_interval int,
  p_day_of_month int,
  p_day_of_week int,
  p_from date
)
returns date
language plpgsql
immutable
as $$
declare
  v_candidate date;
  v_anchor int;
  v_diff int;
  v_eff_start date;
begin
  -- Início efetivo: semanal com day_of_week ancora no primeiro dia com a
  -- weekday escolhida; nos demais casos é o próprio start_date.
  v_eff_start := p_start_date;
  if p_frequency = 'weekly' and p_day_of_week is not null then
    v_eff_start := p_start_date
      + ((p_day_of_week - extract(dow from p_start_date)::int + 7) % 7);
  end if;

  if p_from <= v_eff_start then
    return v_eff_start;
  end if;

  case p_frequency
    when 'daily' then
      v_diff := (p_from - p_start_date);
      v_candidate := p_start_date + (ceil(v_diff::numeric / p_interval)::int * p_interval);
      return v_candidate;

    when 'weekly' then
      v_diff := (p_from - v_eff_start);
      v_candidate := v_eff_start + (ceil(v_diff::numeric / (7 * p_interval))::int * 7 * p_interval);
      return v_candidate;

    when 'monthly' then
      v_anchor := coalesce(p_day_of_month, extract(day from p_start_date)::int);
      v_candidate := p_start_date;
      while v_candidate < p_from loop
        v_candidate := (date_trunc('month', v_candidate) + (p_interval || ' months')::interval)::date;
        v_candidate := least(
          (date_trunc('month', v_candidate) + ((v_anchor - 1) || ' days')::interval)::date,
          (date_trunc('month', v_candidate) + interval '1 month' - interval '1 day')::date
        );
      end loop;
      return v_candidate;

    when 'yearly' then
      v_candidate := p_start_date;
      while v_candidate < p_from loop
        v_candidate := (v_candidate + (p_interval || ' years')::interval)::date;
      end loop;
      return v_candidate;
  end case;
end;
$$;

revoke all on function public.next_recurrence_date(date, recurrence_frequency, int, int, int, date) from public;
grant execute on function public.next_recurrence_date(date, recurrence_frequency, int, int, int, date) to authenticated;
