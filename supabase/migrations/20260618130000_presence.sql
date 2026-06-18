-- ============================================================================
-- "Online agora" por HEARTBEAT (robusto, sem depender do Realtime de presença).
--
-- Cada sessão do app (autenticada) faz upsert do seu session_id ANÔNIMO a cada
-- ~25s. O painel conta as sessões com ping nos últimos ~70s. Sem user_id, sem PII:
-- a tabela só sabe que "alguma sessão está aberta", nunca quem.
-- ============================================================================

create table public.presence (
  session_id text primary key,           -- id aleatório por aba (anônimo, sem PII)
  surface    text,                        -- 'app'
  last_seen  timestamptz not null default now()
);
alter table public.presence enable row level security;
alter table public.presence force row level security;
revoke all on public.presence from anon, authenticated;  -- só via RPC

create index presence_last_seen_idx on public.presence (last_seen desc);

-- Ping: a sessão autenticada renova o próprio last_seen. NÃO grava user_id (anônimo).
create or replace function public.presence_ping(p_session text, p_surface text default 'app')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;                 -- só sessões logadas
  if p_session is null or length(p_session) not between 1 and 64 then return; end if;
  insert into public.presence(session_id, surface, last_seen)
  values (p_session, left(coalesce(p_surface, 'app'), 12), now())
  on conflict (session_id) do update set last_seen = now(), surface = excluded.surface;
  -- limpeza oportunista de sessões velhas (mantém a tabela enxuta)
  delete from public.presence where last_seen < now() - interval '10 minutes';
end $$;
revoke all on function public.presence_ping(text, text) from public;
grant execute on function public.presence_ping(text, text) to authenticated;

-- Contagem de sessões abertas agora (janela de 70s tolera throttling de aba em 2º plano).
create or replace function public.admin_online_count()
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return (select count(*)::int from public.presence where last_seen > now() - interval '70 seconds');
end $$;
revoke all on function public.admin_online_count() from public;
grant execute on function public.admin_online_count() to authenticated;
