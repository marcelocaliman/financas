-- ============================================================================
-- Testes de caminhos de dinheiro — rodam contra PRODUÇÃO dentro de uma
-- transação com ROLLBACK (nada é persistido). Estratégia acordada com o dono
-- (sem Docker, sem staging por ora): BEGIN; aplica migrations novas; cria
-- fixtures; asserções; ROLLBACK.
--
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql-tests/money-paths.sql
-- Se algum assert falhar, o psql aborta com erro (ON_ERROR_STOP) e a transação
-- é desfeita. "TODOS OS TESTES PASSARAM" no final = tudo verde.
-- ============================================================================

begin;

-- Aplica o trigger de dívida novo (simétrico) DENTRO da transação — assim
-- testamos a versão nova; o rollback desfaz (aplicamos de verdade depois).
\i supabase/migrations/20260531220000_debt_trigger_symmetry.sql

-- Contexto de auth pra funções que usam current_household_id()/auth.uid().
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- ---- Fixtures ----
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into households (id, name) values ('22222222-2222-2222-2222-222222222222', 'TEST_HH');
insert into users (id, household_id, display_name)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Tester');
insert into accounts (id, household_id, institution, type, name, currency, current_balance) values
  ('a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Test', 'checking', 'Conta BRL', 'BRL', 1000),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Test', 'checking', 'Conta USD', 'USD', 0);
insert into debts (id, household_id, kind, description, creditor_name, original_amount, current_balance)
  values ('d1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
          'emprestimo_pessoal', 'Dívida teste', 'Banco Teste', 1000, 100);

-- ===========================================================================
-- TESTE 1 — trigger de saldo: despesa de hoje reduz o saldo da conta
-- ===========================================================================
insert into transactions (household_id, account_id, kind, amount, amount_account, currency, description, date, created_by)
  values ('22222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111',
          'expense', 200, 200, 'BRL', 't1', current_date, '11111111-1111-1111-1111-111111111111');
do $$ begin
  assert (select current_balance from accounts where id = 'a1111111-1111-1111-1111-111111111111') = 800,
    'TESTE 1 FALHOU: despesa de 200 deveria deixar saldo 800';
  raise notice 'TESTE 1 ok — trigger de saldo (despesa)';
end $$;

-- ===========================================================================
-- TESTE 2 — create_transfer mesma moeda: debita origem, credita destino
-- ===========================================================================
do $$
declare v_pair uuid;
begin
  insert into accounts (id, household_id, institution, type, name, currency, current_balance)
    values ('a3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Test', 'checking', 'BRL 2', 'BRL', 500);
  v_pair := public.create_transfer(
    'a1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 300, current_date, 'tr');
  assert (select current_balance from accounts where id = 'a1111111-1111-1111-1111-111111111111') = 500,
    'TESTE 2 FALHOU: origem deveria ter 800-300=500';
  assert (select current_balance from accounts where id = 'a3333333-3333-3333-3333-333333333333') = 800,
    'TESTE 2 FALHOU: destino deveria ter 500+300=800';
  raise notice 'TESTE 2 ok — transferência mesma moeda';
end $$;

-- ===========================================================================
-- TESTE 3 — create_transfer cross-currency SEM p_amount_to → BLOQUEIA
-- ===========================================================================
do $$
declare v_raised boolean := false;
begin
  begin
    perform public.create_transfer(
      'a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 100, current_date, 'tr');
  exception when others then
    v_raised := true;
  end;
  assert v_raised, 'TESTE 3 FALHOU: cross-currency sem p_amount_to deveria ter lançado exceção';
  raise notice 'TESTE 3 ok — cross-currency sem valor destino é bloqueado (não corrompe)';
end $$;

-- ===========================================================================
-- TESTE 4 — create_transfer cross-currency COM p_amount_to → credita o destino
--           com o valor informado (na moeda dele), não o número da origem
-- ===========================================================================
do $$
begin
  perform public.create_transfer(
    'a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222',
    500, current_date, 'tr fx', 95);  -- R$500 saem; US$95 entram
  assert (select current_balance from accounts where id = 'a2222222-2222-2222-2222-222222222222') = 95,
    'TESTE 4 FALHOU: destino USD deveria ter 95 (valor informado), não 500';
  raise notice 'TESTE 4 ok — cross-currency credita o valor informado no destino';
end $$;

-- ===========================================================================
-- TESTE 5 — trigger de dívida SIMÉTRICO: pagamento a mais e reversão exata
-- ===========================================================================
do $$
begin
  -- Dívida está em 100. Pagamento (expense vinculado) de 150 (paga a mais).
  insert into transactions (id, household_id, account_id, kind, amount, amount_account, currency, description, date, created_by, debt_id)
    values ('f1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
            'a1111111-1111-1111-1111-111111111111', 'expense', 150, 150, 'BRL', 'pgto dívida',
            current_date, '11111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111');
  assert (select current_balance from debts where id = 'd1111111-1111-1111-1111-111111111111') = -50,
    'TESTE 5a FALHOU: 100 - 150 deveria dar -50 (crédito), não clampar em 0';
  -- Reverter (delete) tem que voltar EXATAMENTE pra 100 (simetria).
  delete from transactions where id = 'f1111111-1111-1111-1111-111111111111';
  assert (select current_balance from debts where id = 'd1111111-1111-1111-1111-111111111111') = 100,
    'TESTE 5b FALHOU: reverter o pagamento deveria voltar pra 100 (era o bug de assimetria)';
  raise notice 'TESTE 5 ok — trigger de dívida simétrico (sem o bug de over-crédito)';
end $$;

-- ===========================================================================
-- TESTE 6 — credit_card_bill_amount: soma despesa e SUBTRAI income (estorno)
--           na janela da fatura
-- ===========================================================================
do $$
declare
  v_card uuid := 'a4444444-4444-4444-4444-444444444444';
  v_due  date := (current_date + 30);
  v_win  record;
  v_amt  numeric;
begin
  insert into accounts (id, household_id, institution, type, name, currency, bill_close_day, bill_due_day)
    values (v_card, '22222222-2222-2222-2222-222222222222', 'Test', 'credit_card', 'Cartão', 'BRL', 20, 10);
  select * into v_win from public.bill_window_for_due_date(20, 10, v_due);
  insert into transactions (household_id, account_id, kind, amount, amount_account, currency, description, date, created_by)
    values ('22222222-2222-2222-2222-222222222222', v_card, 'expense', 100, 100, 'BRL', 'compra', v_win.period_start, '11111111-1111-1111-1111-111111111111'),
           ('22222222-2222-2222-2222-222222222222', v_card, 'income',   30,  30, 'BRL', 'estorno', v_win.period_start, '11111111-1111-1111-1111-111111111111');
  v_amt := public.credit_card_bill_amount(v_card, v_due);
  assert v_amt = 70, 'TESTE 6 FALHOU: fatura deveria ser 100 - 30 = 70, veio ' || coalesce(v_amt::text,'null');
  raise notice 'TESTE 6 ok — fatura de cartão soma despesa e subtrai estorno';
end $$;

-- ===========================================================================
-- TESTE 7 — materialize_recurrence: gera ocorrências e NÃO duplica (guard)
-- ===========================================================================
do $$
declare
  v_rule uuid := 'e1111111-1111-1111-1111-111111111111';
  v_n1 int;
  v_n2 int;
begin
  update households set app_start_date = '2024-01-01'
    where id = '22222222-2222-2222-2222-222222222222';
  insert into recurring_rules
    (id, household_id, kind, account_id, amount, description, frequency, start_date, day_of_month, interval_count, is_active, currency)
  values
    (v_rule, '22222222-2222-2222-2222-222222222222', 'expense', 'a1111111-1111-1111-1111-111111111111',
     100, 'Assinatura', 'monthly', '2024-06-01', 1, 1, true, 'BRL');

  perform public.materialize_recurrence(v_rule, '2024-09-15');
  select count(*) into v_n1 from transactions where recurring_rule_id = v_rule;
  -- Segunda chamada não pode duplicar.
  perform public.materialize_recurrence(v_rule, '2024-09-15');
  select count(*) into v_n2 from transactions where recurring_rule_id = v_rule;

  assert v_n1 > 0, 'TESTE 7 FALHOU: materialize deveria gerar ocorrências, gerou ' || v_n1;
  assert v_n1 = v_n2, 'TESTE 7 FALHOU: materialize duplicou (' || v_n1 || ' → ' || v_n2 || '), o guard falhou';
  raise notice 'TESTE 7 ok — materialize gera % ocorrências e é idempotente', v_n1;
end $$;

do $$ begin raise notice '✅ TODOS OS TESTES DE DINHEIRO PASSARAM'; end $$;

rollback;
