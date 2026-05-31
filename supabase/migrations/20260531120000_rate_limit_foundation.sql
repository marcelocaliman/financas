-- ============================================================================
-- Fundação de rate-limit / cota — RPC atômica em Postgres (ROADMAP, decisão D1)
-- ============================================================================
-- Base compartilhada por: cota de IA (SEC), throttle de auth (AUTH), proteção
-- de rotas que proxyam APIs pagas (CRON). Zero infra externa: o contador vive
-- no próprio Postgres e o check-and-increment é ATÔMICO numa única chamada
-- (INSERT ... ON CONFLICT DO UPDATE ... RETURNING), eliminando a corrida do
-- padrão SELECT-then-INSERT em TS.

set search_path = public;

-- ----------------------------------------------------------------------------
-- Tabela de contadores, particionada logicamente por janela (fixed window).
-- bucket_key codifica a identidade + a ação (ex.: "ai:run-audit:hh:<uuid>").
-- ----------------------------------------------------------------------------
create table if not exists public.rate_limit_counters (
  bucket_key      text        not null,
  window_start    timestamptz not null,
  window_seconds  integer     not null,
  count           integer     not null default 0,
  primary key (bucket_key, window_start)
);

comment on table public.rate_limit_counters is
  'Contadores de rate-limit/cota por janela fixa. Escrito SOMENTE via consume_rate_limit() (security definer). RLS nega acesso direto.';

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);

-- RLS: ninguém toca direto. A RPC é security definer (roda como owner e
-- bypassa RLS). Sem policies = deny-all para authenticated/anon.
alter table public.rate_limit_counters enable row level security;

-- ----------------------------------------------------------------------------
-- consume_rate_limit: tenta consumir p_cost unidades da janela atual.
-- Retorna allowed/remaining/reset_at. Se estourar, NÃO consome (rollback do
-- incremento) — assim a janela reflete só o que de fato passou.
-- ----------------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer,
  p_cost           integer default 1
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz;
  v_count  integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'consume_rate_limit: p_limit e p_window_seconds devem ser > 0';
  end if;

  -- Alinha ao início da janela atual (fixed window).
  v_bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters as r (bucket_key, window_start, window_seconds, count)
    values (p_key, v_bucket, p_window_seconds, p_cost)
  on conflict (bucket_key, window_start)
    do update set count = r.count + p_cost
  returning r.count into v_count;

  if v_count > p_limit then
    -- Estourou: devolve o que tentamos consumir (não infla a janela).
    update public.rate_limit_counters
       set count = count - p_cost
     where bucket_key = p_key and window_start = v_bucket;
    return query
      select false, 0, v_bucket + make_interval(secs => p_window_seconds);
    return;
  end if;

  return query
    select true, greatest(0, p_limit - v_count), v_bucket + make_interval(secs => p_window_seconds);
end;
$$;

comment on function public.consume_rate_limit(text, integer, integer, integer) is
  'Rate-limit atômico de janela fixa. Retorna allowed/remaining/reset_at. Chamado por lib/rate-limit.ts.';

-- Executável por sessões autenticadas e pelo service-role (crons/rotas).
revoke all on function public.consume_rate_limit(text, integer, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer, integer) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- GC: remove janelas vencidas. Chamado por um cron leve (a agendar).
-- ----------------------------------------------------------------------------
create or replace function public.gc_rate_limit_counters(p_keep_hours integer default 48)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_counters
   where window_start < clock_timestamp() - make_interval(hours => p_keep_hours);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.gc_rate_limit_counters(integer) from public;
grant execute on function public.gc_rate_limit_counters(integer) to service_role;
