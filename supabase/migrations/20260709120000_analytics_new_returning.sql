-- Adiciona NOVOS × RECORRENTES ao admin_analytics_overview. Por anon_id da landing (pseudônimo de
-- 1ª-parte, sem PII), compara o PRIMEIRO acesso de SEMPRE com a janela do período:
--   • 1º acesso DENTRO da janela           → NOVO visitante
--   • 1º acesso ANTES, mas ativo na janela  → RECORRENTE
-- new + returning = unique_visitors (todo visitante ativo é novo OU recorrente). Só metadado anônimo.
create or replace function public.admin_analytics_overview(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_lv bigint; v_su bigint; v_new bigint; v_ret bigint; v_start timestamptz;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_start := now() - (greatest(p_days, 1) || ' days')::interval;
  select count(*) into v_lv from public.app_events where name = 'landing_view' and created_at > v_start;
  select count(*) into v_su from public.app_events where name = 'signup' and created_at > v_start;
  select
    count(*) filter (where fs > v_start),
    count(*) filter (where fs <= v_start and ls > v_start)
    into v_new, v_ret
  from (
    select anon_id, min(created_at) as fs, max(created_at) as ls
    from public.app_events
    where surface = 'landing' and anon_id is not null
    group by anon_id
  ) s;
  select jsonb_build_object(
    'events_total',       (select count(*) from public.app_events where created_at > v_start),
    'landing_views',      v_lv,
    'unique_visitors',    (select count(distinct anon_id) from public.app_events where surface = 'landing' and created_at > v_start),
    'new_visitors',       v_new,
    'returning_visitors', v_ret,
    'cta_clicks',         (select count(*) from public.app_events where name = 'cta_click' and created_at > v_start),
    'signups',            v_su,
    'logins',             (select count(*) from public.app_events where name = 'login' and created_at > v_start),
    'app_opens',          (select count(*) from public.app_events where name = 'app_open' and created_at > v_start),
    'conversion_pct',     (case when v_lv > 0 then round(100.0 * v_su / v_lv, 2) else 0 end)
  ) into r;
  return r;
end $$;
