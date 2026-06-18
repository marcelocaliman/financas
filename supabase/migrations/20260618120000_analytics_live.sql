-- ============================================================================
-- Analytics AO VIVO + enriquecimento geo/device (privacy-first / LGPD).
--
-- Mantém o princípio inegociável: eventos ANÔNIMOS (app_events não tem user_id).
-- Acrescenta:
--   • country : país coarse (2 letras) vindo do header da Vercel — o IP NUNCA é
--               armazenado; guardamos só o país agregado.
--   • device  : tipo de dispositivo (mobile/tablet/desktop) do User-Agent coarse,
--               sem fingerprint.
-- Libera LEITURA só pro admin (RLS) — necessário pro Realtime do feed ao vivo —,
-- mantendo a ESCRITA só via service_role (/api/track). Habilita Realtime na tabela.
-- ============================================================================

alter table public.app_events add column if not exists country text;
alter table public.app_events add column if not exists device  text;

-- Admin pode LER os eventos (Realtime postgres_changes + feed). Não-admin vê ZERO
-- linhas (a policy avalia is_admin()=false). Escrita segue só via service_role.
grant select on public.app_events to authenticated;
drop policy if exists app_events_select_admin on public.app_events;
create policy app_events_select_admin on public.app_events for select using (public.is_admin());

-- Realtime: publica a tabela (postgres_changes respeita a RLS acima → só admin recebe).
do $$
begin
  alter publication supabase_realtime add table public.app_events;
exception when others then null;  -- idempotente (já publicada)
end $$;

-- ── RPCs novos (SECURITY DEFINER + guarda is_admin) ─────────────────────────
create or replace function public.admin_recent_events(p_limit int default 30)
returns table(created_at timestamptz, surface text, name text, country text, device text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select e.created_at, e.surface, e.name, e.country, e.device
  from public.app_events e
  order by e.created_at desc
  limit greatest(p_limit, 1);
end $$;

create or replace function public.admin_events_by_country(p_days int default 30)
returns table(country text, count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select coalesce(e.country, '??'), count(*)::bigint
  from public.app_events e
  where e.created_at > now() - (greatest(p_days, 1) || ' days')::interval
  group by 1 order by 2 desc limit 30;
end $$;

create or replace function public.admin_events_by_device(p_days int default 30)
returns table(device text, count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select coalesce(e.device, 'desconhecido'), count(*)::bigint
  from public.app_events e
  where e.created_at > now() - (greatest(p_days, 1) || ' days')::interval
  group by 1 order by 2 desc;
end $$;

revoke all on function public.admin_recent_events(int)     from public;
revoke all on function public.admin_events_by_country(int) from public;
revoke all on function public.admin_events_by_device(int)  from public;
grant execute on function public.admin_recent_events(int)     to authenticated;
grant execute on function public.admin_events_by_country(int) to authenticated;
grant execute on function public.admin_events_by_device(int)  to authenticated;
