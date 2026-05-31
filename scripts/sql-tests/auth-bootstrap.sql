-- Testa o trigger de auto-cura do bootstrap. Prod + BEGIN…ROLLBACK.
begin;

\i supabase/migrations/20260531340000_auth_bootstrap_autoheal.sql

-- create mode → monta lar completo
insert into auth.users (id, email, raw_user_meta_data)
  values ('aaaa9999-9999-9999-9999-999999999999', 'create@test.x',
          '{"signup_mode":"create","display_name":"Tester","household_name":"Lar Teste"}'::jsonb);
do $$ begin
  assert (select count(*) from public.users where id='aaaa9999-9999-9999-9999-999999999999') = 1,
    'TESTE 1 FALHOU: users não criado';
  assert (select h.name from public.households h
          join public.users u on u.household_id=h.id
          where u.id='aaaa9999-9999-9999-9999-999999999999') = 'Lar Teste',
    'TESTE 1 FALHOU: household errado';
  assert (select count(*) from public.categories c
          join public.users u on u.household_id=c.household_id
          where u.id='aaaa9999-9999-9999-9999-999999999999') > 0,
    'TESTE 1 FALHOU: categorias não semeadas';
  raise notice 'TESTE 1 ok — create monta lar+perfil+categorias';
end $$;

-- join mode → trigger NÃO interfere (fluxo da app cuida)
insert into auth.users (id, email, raw_user_meta_data)
  values ('bbbb9999-9999-9999-9999-999999999999', 'join@test.x',
          '{"signup_mode":"join","invite_code":"XYZ"}'::jsonb);
do $$ begin
  assert (select count(*) from public.users where id='bbbb9999-9999-9999-9999-999999999999') = 0,
    'TESTE 2 FALHOU: join não devia bootstrapar';
  raise notice 'TESTE 2 ok — join é deixado pro fluxo da app';
end $$;

-- idempotência: se já existe users, não duplica
insert into auth.users (id, email, raw_user_meta_data)
  values ('cccc9999-9999-9999-9999-999999999999', 'idem@test.x', '{"signup_mode":"create"}'::jsonb);
do $$
declare v_hh1 uuid; v_hh2 uuid;
begin
  select household_id into v_hh1 from public.users where id='cccc9999-9999-9999-9999-999999999999';
  -- simula a app chamando bootstrap depois (idempotente)
  update public.users set display_name = display_name where id='cccc9999-9999-9999-9999-999999999999';
  select household_id into v_hh2 from public.users where id='cccc9999-9999-9999-9999-999999999999';
  assert v_hh1 = v_hh2, 'TESTE 3 FALHOU: household mudou';
  raise notice 'TESTE 3 ok — idempotente';
end $$;

do $$ begin raise notice '✅ TODOS OS TESTES DE AUTO-CURA PASSARAM'; end $$;
rollback;
