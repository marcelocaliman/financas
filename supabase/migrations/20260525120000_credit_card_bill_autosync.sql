-- ============================================================================
-- Finanças — Auto-sync de pagamento de fatura de cartão
--
-- Uma regra recorrente é considerada "pagamento de fatura de cartão" quando:
--   - kind = 'transfer'
--   - to_account.type = 'credit_card'
--   - to_account.payment_account_id = rule.from_account_id
--
-- Pra essas regras, ao materializar, ignoramos o `amount` chumbado e
-- usamos a soma das despesas do cartão no ciclo cuja data de vencimento
-- = data da ocorrência. Se a fatura for R$ 0, pulamos a ocorrência
-- (sem nada pra pagar) mas avançamos o last_materialized_date.
-- ============================================================================

set search_path = public;

-- ------------------------------------------------------------
-- Helper 1: dado close_day, due_day e a data de vencimento,
-- retorna o período (start/end) do ciclo que esse vencimento paga.
-- ------------------------------------------------------------
create or replace function public.bill_window_for_due_date(
  p_close_day int,
  p_due_day int,
  p_due_date date
)
returns table(period_start date, period_end date)
language plpgsql
immutable
as $$
declare
  v_target_month date;
  v_last_day int;
  v_close_date date;
begin
  -- Se due_day > close_day: close e due acontecem no MESMO mês (ex: close=5, due=15)
  -- Senão: close em um mês, due no mês seguinte (ex: close=27, due=5)
  if p_due_day > p_close_day then
    v_target_month := date_trunc('month', p_due_date)::date;
  else
    v_target_month := (date_trunc('month', p_due_date) - interval '1 month')::date;
  end if;

  v_last_day := extract(day from (v_target_month + interval '1 month - 1 day'))::int;
  v_close_date := v_target_month + (least(p_close_day, v_last_day) - 1);

  period_end := v_close_date;
  period_start := (v_close_date - interval '1 month' + interval '1 day')::date;
  return next;
end;
$$;

revoke all on function public.bill_window_for_due_date(int, int, date) from public;
grant execute on function public.bill_window_for_due_date(int, int, date) to authenticated, service_role;

-- ------------------------------------------------------------
-- Helper 2: soma das despesas do cartão no ciclo cujo
-- vencimento bate com p_due_date. Inclui is_historical_ir_only
-- (carryover/marco zero conta pra fatura).
-- Retorna NULL se o cartão não tem ciclo configurado.
-- ------------------------------------------------------------
create or replace function public.credit_card_bill_amount(
  p_card_id uuid,
  p_due_date date
)
returns numeric
language plpgsql
stable
as $$
declare
  v_close_day int;
  v_due_day int;
  v_window record;
  v_total numeric;
begin
  select bill_close_day, bill_due_day
    into v_close_day, v_due_day
  from public.accounts
  where id = p_card_id and type = 'credit_card';

  if v_close_day is null then
    return null;
  end if;

  select * into v_window
  from public.bill_window_for_due_date(
    v_close_day,
    coalesce(v_due_day, v_close_day),
    p_due_date
  );

  select coalesce(sum(amount_account), 0) into v_total
  from public.transactions
  where account_id = p_card_id
    and kind = 'expense'
    and date >= v_window.period_start
    and date <= v_window.period_end;

  return v_total;
end;
$$;

revoke all on function public.credit_card_bill_amount(uuid, date) from public;
grant execute on function public.credit_card_bill_amount(uuid, date) to authenticated, service_role;

-- ------------------------------------------------------------
-- Reescreve materialize_recurrence pra detectar regras de
-- pagamento de fatura e usar o valor real da fatura.
-- ------------------------------------------------------------
create or replace function public.materialize_recurrence(
  p_rule_id uuid,
  p_until_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_cursor date;
  v_end date;
  v_count int := 0;
  v_creator uuid;
  v_is_bill_payment boolean := false;
  v_to_card_id uuid;
  v_dynamic_amount numeric;
  v_effective_amount numeric;
begin
  select * into v_rule from public.recurring_rules where id = p_rule_id;
  if not found or not v_rule.is_active then
    return 0;
  end if;

  -- Detecta auto-sync de pagamento de fatura:
  -- transfer + destino é cartão + origem = payment_account do cartão.
  if v_rule.kind = 'transfer'
     and v_rule.from_account_id is not null
     and v_rule.to_account_id is not null then
    select id into v_to_card_id
    from public.accounts
    where id = v_rule.to_account_id
      and type = 'credit_card'
      and payment_account_id = v_rule.from_account_id
      and bill_close_day is not null;
    v_is_bill_payment := v_to_card_id is not null;
  end if;

  v_end := least(p_until_date, coalesce(v_rule.end_date, p_until_date));

  if v_rule.last_materialized_date is null then
    v_cursor := v_rule.start_date;
  else
    v_cursor := public.next_recurrence_date(
      v_rule.start_date,
      v_rule.frequency,
      v_rule.interval_count,
      v_rule.day_of_month,
      v_rule.day_of_week,
      v_rule.last_materialized_date + 1
    );
  end if;

  v_creator := coalesce(v_rule.created_by, (
    select id from public.users where household_id = v_rule.household_id limit 1
  ));

  while v_cursor <= v_end loop
    if v_rule.kind = 'transfer' then
      -- Auto-sync: calcula valor da fatura
      v_effective_amount := v_rule.amount;
      if v_is_bill_payment then
        v_dynamic_amount := public.credit_card_bill_amount(v_to_card_id, v_cursor);
        if v_dynamic_amount is not null then
          v_effective_amount := v_dynamic_amount;
        end if;
      end if;

      -- Pula ocorrência se fatura = 0 (nada pra pagar). Avança o cursor
      -- mas não cria transação nem incrementa contagem.
      if v_effective_amount > 0 then
        perform public.create_transfer(
          v_rule.from_account_id,
          v_rule.to_account_id,
          v_effective_amount,
          v_cursor,
          v_rule.description
        );
        update public.transactions
          set recurring_rule_id = p_rule_id, is_recurring = true
          where household_id = v_rule.household_id
            and date = v_cursor
            and description = v_rule.description
            and transfer_pair_id is not null
            and recurring_rule_id is null;
        v_count := v_count + 1;
      end if;
    else
      insert into public.transactions (
        household_id, account_id, category_id, kind,
        amount, amount_account, currency, description,
        payment_method, date, created_by,
        category_source, is_recurring, recurring_rule_id,
        fonte_pagadora_id, irrf_amount, inss_amount,
        metadata
      ) values (
        v_rule.household_id, v_rule.account_id, v_rule.category_id, v_rule.kind,
        v_rule.amount, v_rule.amount, v_rule.currency, v_rule.description,
        v_rule.payment_method, v_cursor, v_creator,
        'manual', true, p_rule_id,
        v_rule.fonte_pagadora_id, v_rule.irrf_amount, v_rule.inss_amount,
        jsonb_build_object('recurring', true)
      );
      v_count := v_count + 1;
    end if;

    v_cursor := public.next_recurrence_date(
      v_rule.start_date,
      v_rule.frequency,
      v_rule.interval_count,
      v_rule.day_of_month,
      v_rule.day_of_week,
      v_cursor + 1
    );
  end loop;

  -- Sempre avança last_materialized_date pra v_end, mesmo se nenhuma
  -- ocorrência foi criada (fatura R$ 0 em todos os ciclos). Senão a
  -- próxima materialização retentaria as mesmas datas.
  update public.recurring_rules
    set last_materialized_date = v_end
    where id = p_rule_id;

  return v_count;
end;
$$;

revoke all on function public.materialize_recurrence(uuid, date) from public;
grant execute on function public.materialize_recurrence(uuid, date) to authenticated;

comment on function public.materialize_recurrence is
  'Materializa ocorrências de uma regra recorrente até p_until_date. '
  'Regras de pagamento de fatura (transfer pra credit_card cuja origem '
  'é a payment_account) têm o amount calculado dinamicamente a partir '
  'da fatura real do ciclo. Faturas R$ 0 são puladas.';
