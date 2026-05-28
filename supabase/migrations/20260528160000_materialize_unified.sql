-- ============================================================================
-- Finanças — materialize_recurrence unificado
--
-- Consolida toda a lógica desenvolvida em migrations anteriores numa única
-- versão coerente:
--   1. Auto-sync de pagamento de fatura (20260525120000): transfer pra
--      credit_card cuja origem é payment_account_id usa o valor REAL da
--      fatura em vez do rule.amount.
--   2. Marco zero (20260528150000): tx materializada com date <
--      household.app_start_date vira is_historical_ir_only=true, EXCETO
--      em cartão de crédito (cash basis cuida disso).
--   3. Propagação de fonte_pagadora_id, IRRF, INSS, exclude_from_ir do
--      rule pras tx (20260524140000, 20260525030000).
--   4. Auto-promove dedutíveis pra ir_deductible_payments quando a regra
--      é is_tax_deductible=true.
--
-- Regressão fixada: a 20260528150000 substituiu materialize_recurrence sem
-- preservar o autosync, fazendo a regra de pagamento de fatura usar valor
-- fixo (R$ rule.amount) em vez do valor real da fatura.
-- ============================================================================

set search_path = public;

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
  v_tx_id uuid;
  v_owner_filer uuid;
  v_deductible_amt numeric(14, 2);
  v_app_start date;
  v_is_historical boolean;
  v_account_type text;
  v_is_bill_payment boolean := false;
  v_to_card_id uuid;
  v_dynamic_amount numeric;
  v_effective_amount numeric;
begin
  select * into v_rule from public.recurring_rules where id = p_rule_id;
  if not found or not v_rule.is_active then
    return 0;
  end if;

  -- Marco zero
  select app_start_date into v_app_start
    from public.households where id = v_rule.household_id;
  v_app_start := coalesce(v_app_start, p_until_date + 1);

  -- Tipo da conta — cartão de crédito é exceção ao marco zero
  select type::text into v_account_type
    from public.accounts where id = v_rule.account_id;

  -- Detecta auto-sync de pagamento de fatura:
  -- transfer + destino é cartão + origem = payment_account_id do cartão.
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
      v_rule.start_date, v_rule.frequency, v_rule.interval_count,
      v_rule.day_of_month, v_rule.day_of_week,
      v_rule.last_materialized_date + 1
    );
  end if;

  v_creator := coalesce(v_rule.created_by, (
    select id from public.users where household_id = v_rule.household_id limit 1
  ));

  while v_cursor <= v_end loop
    -- Marco zero: histórica-IR se data < app_start_date, exceto cartão
    v_is_historical := v_cursor < v_app_start
                       and coalesce(v_account_type, '') <> 'credit_card';

    if v_rule.kind = 'transfer' then
      -- Auto-sync de fatura: usa valor real da fatura quando aplicável
      v_effective_amount := v_rule.amount;
      if v_is_bill_payment then
        v_dynamic_amount := public.credit_card_bill_amount(v_to_card_id, v_cursor);
        if v_dynamic_amount is not null then
          v_effective_amount := v_dynamic_amount;
        end if;
      end if;

      -- Pula ocorrência se fatura = 0 (nada pra pagar)
      if v_effective_amount > 0 then
        perform public.create_transfer(
          v_rule.from_account_id, v_rule.to_account_id,
          v_effective_amount, v_cursor, v_rule.description
        );
        update public.transactions
          set recurring_rule_id = p_rule_id, is_recurring = true,
              exclude_from_ir = v_rule.exclude_from_ir,
              is_historical_ir_only = v_is_historical
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
        exclude_from_ir, is_historical_ir_only, metadata
      ) values (
        v_rule.household_id, v_rule.account_id, v_rule.category_id, v_rule.kind,
        v_rule.amount, v_rule.amount, v_rule.currency, v_rule.description,
        v_rule.payment_method, v_cursor, v_creator,
        'manual', true, p_rule_id,
        v_rule.fonte_pagadora_id, v_rule.irrf_amount, v_rule.inss_amount,
        v_rule.exclude_from_ir, v_is_historical,
        jsonb_build_object('recurring', true)
      ) returning id into v_tx_id;

      -- Auto-promove pra ir_deductible_payments (só se não exclude_from_ir)
      if v_rule.kind = 'expense'
         and v_rule.is_tax_deductible = true
         and v_rule.ir_deductible_kind is not null
         and v_rule.exclude_from_ir = false
      then
        select owner_filer_id into v_owner_filer
          from public.accounts where id = v_rule.account_id;
        v_deductible_amt := coalesce(v_rule.deductible_amount, v_rule.amount);

        if not exists (
          select 1 from public.ir_deductible_payments where transaction_id = v_tx_id
        ) then
          insert into public.ir_deductible_payments (
            household_id, year, kind, description,
            recipient_name, recipient_cnpj_cpf,
            amount, currency, payment_date,
            transaction_id, recurring_rule_id, auto_imported,
            owner_filer_id, notes
          ) values (
            v_rule.household_id, extract(year from v_cursor)::int,
            v_rule.ir_deductible_kind, v_rule.description,
            coalesce(
              (select name from public.fontes_pagadoras where id = v_rule.fonte_pagadora_id),
              v_rule.description
            ),
            (select coalesce(cnpj, cpf) from public.fontes_pagadoras where id = v_rule.fonte_pagadora_id),
            v_deductible_amt, v_rule.currency, v_cursor,
            v_tx_id, p_rule_id, true, v_owner_filer,
            case
              when v_rule.deductible_amount is not null and v_rule.deductible_amount <> v_rule.amount
                then 'Auto-importado. Valor dedutível parcial (R$ ' ||
                     to_char(v_rule.deductible_amount, 'FM999G999D00') || ') do total R$ ' ||
                     to_char(v_rule.amount, 'FM999G999D00') || '.'
              else 'Auto-importado da recorrência "' || v_rule.description || '"'
            end
          );
        end if;
      end if;
      v_count := v_count + 1;
    end if;

    v_cursor := public.next_recurrence_date(
      v_rule.start_date, v_rule.frequency, v_rule.interval_count,
      v_rule.day_of_month, v_rule.day_of_week, v_cursor + 1
    );
  end loop;

  -- Avança last_materialized_date mesmo se nenhuma ocorrência foi criada
  -- (fatura R$ 0 ou tudo pulado). Senão retentaria as mesmas datas.
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
  'Funcionalidades: '
  '(1) tx com date < app_start_date viram histórica-IR (exceto cartão); '
  '(2) regra de pagamento de fatura usa valor real da fatura via '
  'credit_card_bill_amount(); '
  '(3) propaga fonte/IRRF/INSS/exclude_from_ir do rule pra tx; '
  '(4) auto-promove dedutíveis pra ir_deductible_payments.';
