-- ============================================================================
-- Testes de ISOLAMENTO multi-tenant (RLS) — as tentativas que DEVEM falhar.
-- Rodam contra produção dentro de BEGIN…ROLLBACK. Diferente dos testes de
-- dinheiro, aqui trocamos pro role `authenticated` + claims JWT pra que a RLS
-- de fato se aplique (superuser bypassa RLS). Simula o PostgREST.
--
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql-tests/rls-isolation.sql
-- ============================================================================

begin;

-- ---- Fixtures (como superuser, RLS bypassada) ----
insert into auth.users (id) values
  ('aaaa1111-1111-1111-1111-111111111111'),  -- userA
  ('bbbb1111-1111-1111-1111-111111111111'),  -- userB
  ('cccc1111-1111-1111-1111-111111111111');  -- admin
insert into households (id, name) values
  ('aaaa2222-2222-2222-2222-222222222222', 'HH_A'),
  ('bbbb2222-2222-2222-2222-222222222222', 'HH_B');
insert into users (id, household_id, display_name) values
  ('aaaa1111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 'ua'),
  ('bbbb1111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222', 'ub'),
  ('cccc1111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 'adm');
insert into platform_admins (user_id) values ('cccc1111-1111-1111-1111-111111111111');
insert into accounts (id, household_id, institution, type, name) values
  ('aaaa3333-3333-3333-3333-333333333333', 'aaaa2222-2222-2222-2222-222222222222', 'i', 'checking', 'ca'),
  ('bbbb3333-3333-3333-3333-333333333333', 'bbbb2222-2222-2222-2222-222222222222', 'i', 'checking', 'cb');

-- ===========================================================================
-- TESTE A — leitura isolada: userA NÃO enxerga conta do household B
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaa1111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin
  assert (select count(*) from accounts where id = 'bbbb3333-3333-3333-3333-333333333333') = 0,
    'TESTE A FALHOU (VAZAMENTO): userA enxergou conta do household B';
  assert (select count(*) from accounts where id = 'aaaa3333-3333-3333-3333-333333333333') = 1,
    'TESTE A FALHOU: userA não enxergou a própria conta';
  raise notice 'TESTE A ok — leitura isolada por household';
end $$;
reset role;

-- ===========================================================================
-- TESTE B — escrita isolada: userA NÃO pode inserir conta em household alheio
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaa1111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into accounts (household_id, institution, type, name)
      values ('bbbb2222-2222-2222-2222-222222222222', 'i', 'checking', 'hack');
  exception when others then v_blocked := true;
  end;
  assert v_blocked, 'TESTE B FALHOU (VAZAMENTO): userA inseriu conta em household alheio';
  raise notice 'TESTE B ok — RLS with-check bloqueia escrita cross-tenant';
end $$;
reset role;

-- ===========================================================================
-- TESTE C — RPC admin BLOQUEIA usuário comum (não-admin)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaa1111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v_blocked boolean := false; v_dummy record;
begin
  begin
    select * into v_dummy from public.admin_platform_stats();
  exception when others then v_blocked := true;
  end;
  assert v_blocked, 'TESTE C FALHOU (VAZAMENTO): não-admin chamou admin_platform_stats';
  raise notice 'TESTE C ok — guard de admin bloqueia não-admin no banco';
end $$;
reset role;

-- ===========================================================================
-- TESTE D — RPC admin FUNCIONA pra platform admin
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccc1111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v_total bigint;
begin
  select total_households into v_total from public.admin_platform_stats();
  assert v_total >= 2, 'TESTE D FALHOU: admin deveria ver ao menos os 2 households de teste';
  raise notice 'TESTE D ok — admin consegue chamar a RPC admin';
end $$;
reset role;

-- ===========================================================================
-- TESTE E — invariante de tenancy: transação não pode referenciar conta de
-- outro household, mesmo que o household_id da linha seja o "certo"
-- ===========================================================================
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into transactions (household_id, account_id, kind, amount, amount_account, currency, description, date, created_by)
      values ('aaaa2222-2222-2222-2222-222222222222', 'bbbb3333-3333-3333-3333-333333333333',
              'expense', 10, 10, 'BRL', 'x', current_date, 'aaaa1111-1111-1111-1111-111111111111');
  exception when others then v_blocked := true;
  end;
  assert v_blocked, 'TESTE E FALHOU (VAZAMENTO): aceitou conta de outro household na transação';
  raise notice 'TESTE E ok — trigger barra account_id de outro household';
end $$;

do $$ begin raise notice '✅ TODOS OS TESTES DE ISOLAMENTO PASSARAM'; end $$;

rollback;
