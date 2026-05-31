-- ============================================================================
-- RLS: guard de platform-admin DENTRO das RPCs admin (ROADMAP RLS, D15-B)
-- ============================================================================
-- As RPCs admin_* são SECURITY DEFINER e grantadas a `authenticated` — qualquer
-- usuário logado podia chamá-las direto (bypassando o guard em TS) e ver
-- métricas da plataforma inteira. Aqui adicionamos um guard no BANCO: só roda
-- se is_platform_admin(). O app passa a chamá-las com o client AUTENTICADO do
-- admin (não o service-role), pra auth.uid() resolver o guard. Defense-in-depth.

set search_path = public;

create or replace function public.admin_household_growth(p_days integer default 30)
returns table(date date, count bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  return query
    with series as (
      select generate_series((current_date - (p_days - 1))::date, current_date::date, '1 day'::interval)::date as d
    )
    select series.d as date, coalesce(count(h.id), 0) as count
    from series left join households h on h.created_at::date = series.d
    group by series.d order by series.d;
end;
$$;

create or replace function public.admin_user_growth(p_days integer default 30)
returns table(date date, count bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  return query
    with series as (
      select generate_series((current_date - (p_days - 1))::date, current_date::date, '1 day'::interval)::date as d
    )
    select series.d as date, coalesce(count(u.id), 0) as count
    from series left join users u on u.created_at::date = series.d
    group by series.d order by series.d;
end;
$$;

create or replace function public.admin_action_volume(p_days integer default 30)
returns table(date date, count bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  return query
    with series as (
      select generate_series((current_date - (p_days - 1))::date, current_date::date, '1 day'::interval)::date as d
    )
    select series.d as date, coalesce(count(a.id), 0) as count
    from series left join admin_audit_log a on a.created_at::date = series.d
    group by series.d order by series.d;
end;
$$;

create or replace function public.admin_platform_stats()
returns table(
  total_households bigint, total_users bigint, active_subscriptions bigint,
  trialing bigint, suspended bigint, pending_data_requests bigint,
  new_households_7d bigint, new_users_7d bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  return query select
    (select count(*) from households),
    (select count(*) from users where is_active = true),
    (select count(*) from households where subscription_status = 'active'),
    (select count(*) from households where subscription_status = 'trialing'),
    (select count(*) from households where subscription_status = 'suspended'),
    (select count(*) from data_access_requests where status = 'pending'),
    (select count(*) from households where created_at > now() - interval '7 days'),
    (select count(*) from users where created_at > now() - interval '7 days');
end;
$$;
