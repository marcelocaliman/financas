-- ============================================================================
-- "Online agora": janela 70s → 45s. O 'bye' no pagehide já remove a sessão na hora
-- (caminho comum, ~instantâneo); esta janela é o FALLBACK por TTL pra quando o beacon
-- não dispara (fechamento "duro", bfcache). 45s ≈ 2× o heartbeat mais lento (landing 25s)
-- com folga — tolera 1 ping perdido sem piscar, e derruba o ausente em ≤45s no pior caso.
-- ============================================================================
create or replace function public.admin_online()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'app',     (select count(*) from public.presence where surface = 'app'     and last_seen > now() - interval '45 seconds'),
    'landing', (select count(*) from public.presence where surface = 'landing' and last_seen > now() - interval '45 seconds'),
    'total',   (select count(*) from public.presence where last_seen > now() - interval '45 seconds')
  );
end $$;
-- create or replace preserva os grants; reafirma por idempotência.
revoke all on function public.admin_online() from public;
grant execute on function public.admin_online() to authenticated;
