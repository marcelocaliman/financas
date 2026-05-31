-- Testa o date-gate do trigger de dívida. Prod + BEGIN…ROLLBACK.
begin;

\i supabase/migrations/20260531400000_debt_trigger_date_gate.sql

-- Fixtures (signup_mode=join → auto-heal pula)
insert into auth.users (id, raw_user_meta_data)
  values ('e1111111-1111-1111-1111-111111111111', '{"signup_mode":"join"}'::jsonb);
insert into households (id, name) values ('e2222222-2222-2222-2222-222222222222', 'DG_HH');
insert into users (id, household_id, display_name)
  values ('e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'u');
insert into accounts (id, household_id, institution, type, name)
  values ('e3333333-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 'i', 'checking', 'c');
insert into debts (id, household_id, kind, description, creditor_name, original_amount, current_balance)
  values ('e4444444-4444-4444-4444-444444444444', 'e2222222-2222-2222-2222-222222222222',
          'emprestimo_pessoal', 'Dívida', 'Banco', 200, 100);

-- TESTE A: pagamento FUTURO não baixa a dívida na hora
do $$ begin
  insert into transactions (id, household_id, account_id, kind, amount, amount_account, currency, description, date, created_by, debt_id)
    values ('eaaaaaaa-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222',
            'e3333333-3333-3333-3333-333333333333', 'expense', 40, 40, 'BRL', 'futuro',
            current_date + 30, 'e1111111-1111-1111-1111-111111111111', 'e4444444-4444-4444-4444-444444444444');
  assert (select current_balance from debts where id='e4444444-4444-4444-4444-444444444444') = 100,
    'TESTE A FALHOU: pagamento futuro não deveria baixar a dívida (esperado 100)';
  raise notice 'TESTE A ok — pagamento futuro NÃO baixa a dívida';
end $$;

-- TESTE B: quando a data chega, advance_pending_balances baixa a dívida
do $$ begin
  update transactions set date = current_date where id = 'eaaaaaaa-1111-1111-1111-111111111111';
  perform public.advance_pending_balances();
  assert (select current_balance from debts where id='e4444444-4444-4444-4444-444444444444') = 60,
    'TESTE B FALHOU: após a data chegar, dívida deveria ir a 60';
  raise notice 'TESTE B ok — dívida baixa quando a data chega';
end $$;

-- TESTE C: pagamento de HOJE baixa imediatamente
do $$ begin
  insert into transactions (household_id, account_id, kind, amount, amount_account, currency, description, date, created_by, debt_id)
    values ('e2222222-2222-2222-2222-222222222222', 'e3333333-3333-3333-3333-333333333333',
            'expense', 10, 10, 'BRL', 'hoje', current_date, 'e1111111-1111-1111-1111-111111111111',
            'e4444444-4444-4444-4444-444444444444');
  assert (select current_balance from debts where id='e4444444-4444-4444-4444-444444444444') = 50,
    'TESTE C FALHOU: pagamento de hoje deveria baixar pra 50';
  raise notice 'TESTE C ok — pagamento de hoje baixa na hora';
end $$;

do $$ begin raise notice '✅ TESTES DE DATE-GATE DE DÍVIDA PASSARAM'; end $$;
rollback;
