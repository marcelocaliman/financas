-- SINGLE-FLIGHT contra thundering herd: claim ATÔMICO dos símbolos a buscar. Quando N requests
-- concorrentes veem o mesmo símbolo vencido no MESMO instante (cache expira + clientes sincronizados),
-- sem isso todos batem no upstream. Aqui só UM "ganha" a linha e busca; os outros servem o último
-- valor do cache (stale-while-revalidate). O Postgres resolve a corrida: o INSERT cria a linha nova
-- (símbolo inédito) OU o ON CONFLICT bumpa updated_at se ninguém tocou nos últimos `dedup_seconds` —
-- o RETURNING devolve SÓ os símbolos que ESTA chamada ganhou. Concorrentes perdem o WHERE e não voltam.
--
-- SECURITY INVOKER (padrão): roda como QUEM CHAMA. O único caller é o serverless via service_role
-- (BYPASSRLS), que escreve mesmo com `force row level security` ligado. NÃO é SECURITY DEFINER de
-- propósito: como definer rodaria como owner, a force-RLS sem policy BLOQUEARIA a escrita.
create or replace function public.claim_quote_symbols(syms text[], dedup_seconds int)
returns table(sym text)
language sql
as $$
  insert into public.quote_cache (symbol, price, currency, updated_at)
  select s, -1, '', now() from unnest(syms) as s
  on conflict (symbol) do update
    set updated_at = now()
    where quote_cache.updated_at < now() - make_interval(secs => dedup_seconds)
  returning symbol;
$$;

-- Só o service_role (serverless) chama. anon/authenticated não tocam.
revoke all on function public.claim_quote_symbols(text[], int) from public, anon, authenticated;
grant execute on function public.claim_quote_symbols(text[], int) to service_role;
