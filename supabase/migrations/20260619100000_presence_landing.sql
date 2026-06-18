-- ============================================================================
-- "Online agora" por superfície: app (logados) + landing (visitantes anônimos).
-- A presença passa a ser gravada por um endpoint serverless (/api/presence, via
-- service_role) — robusto, sem depender do RPC autenticado nem do schema cache.
-- ============================================================================

-- Quebra por superfície (app/landing) + total. Janela de 70s.
create or replace function public.admin_online()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'app',     (select count(*) from public.presence where surface = 'app'     and last_seen > now() - interval '70 seconds'),
    'landing', (select count(*) from public.presence where surface = 'landing' and last_seen > now() - interval '70 seconds'),
    'total',   (select count(*) from public.presence where last_seen > now() - interval '70 seconds')
  );
end $$;
revoke all on function public.admin_online() from public;
grant execute on function public.admin_online() to authenticated;
