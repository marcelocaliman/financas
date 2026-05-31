-- Testa delete_account_complete: apaga tudo, não deixa órfão. Prod + ROLLBACK.
begin;

\i supabase/migrations/20260531360000_delete_account_complete.sql

-- Fixtures (signup_mode=join → trigger de auto-cura pula)
insert into auth.users (id, raw_user_meta_data)
  values ('dddd1111-1111-1111-1111-111111111111', '{"signup_mode":"join"}'::jsonb);
insert into households (id, name) values ('dddd2222-2222-2222-2222-222222222222', 'DEL_HH');
insert into users (id, household_id, display_name)
  values ('dddd1111-1111-1111-1111-111111111111', 'dddd2222-2222-2222-2222-222222222222', 'ToDelete');
insert into accounts (id, household_id, institution, type, name)
  values ('dddd3333-3333-3333-3333-333333333333', 'dddd2222-2222-2222-2222-222222222222', 'i', 'checking', 'c');
insert into transactions (household_id, account_id, kind, amount, amount_account, currency, description, date, created_by)
  values ('dddd2222-2222-2222-2222-222222222222', 'dddd3333-3333-3333-3333-333333333333', 'expense', 50, 50, 'BRL', 't', current_date, 'dddd1111-1111-1111-1111-111111111111');
insert into user_consents (user_id, consent_type, version, granted)
  values ('dddd1111-1111-1111-1111-111111111111', 'terms_of_service', '1.0', true);

-- Executa a exclusão
do $$
declare v_proof jsonb;
begin
  v_proof := public.delete_account_complete('dddd2222-2222-2222-2222-222222222222');
  raise notice 'prova: %', v_proof;
end $$;

-- Asserções: NADA sobra
do $$ begin
  assert (select count(*) from households where id='dddd2222-2222-2222-2222-222222222222') = 0, 'household sobrou';
  assert (select count(*) from users where id='dddd1111-1111-1111-1111-111111111111') = 0, 'users sobrou';
  assert (select count(*) from accounts where id='dddd3333-3333-3333-3333-333333333333') = 0, 'accounts sobrou (cascade falhou)';
  assert (select count(*) from transactions where household_id='dddd2222-2222-2222-2222-222222222222') = 0, 'transactions sobrou';
  assert (select count(*) from user_consents where user_id='dddd1111-1111-1111-1111-111111111111') = 0, 'user_consents sobrou';
  assert (select count(*) from auth.users where id='dddd1111-1111-1111-1111-111111111111') = 0, 'auth.users sobrou';
  assert (select count(*) from deletion_proofs where household_id='dddd2222-2222-2222-2222-222222222222') = 1, 'prova não registrada';
  raise notice 'TESTE ok — exclusão completa, zero órfão, prova registrada';
end $$;

do $$ begin raise notice '✅ TESTE DE EXCLUSÃO LGPD PASSOU'; end $$;
rollback;
