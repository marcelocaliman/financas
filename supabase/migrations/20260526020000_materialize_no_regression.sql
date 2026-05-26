-- ============================================================================
-- Finanças — Fix de regressão em last_materialized_date
--
-- Bug introduzido na migration 20260525120000 (auto-sync de fatura): a função
-- `materialize_recurrence` passou a setar `last_materialized_date = v_end`
-- INCONDICIONALMENTE, mesmo quando nenhuma ocorrência foi criada.
--
-- Efeitos colaterais:
--   1) Regra com last_mat à frente da data alvo: last_mat RETROCEDE pro alvo.
--      Ex: regra com last_mat=30/jun, clica "materializar até hoje (26/mai)" →
--          last_mat vira 26/mai. Próximo clique vai duplicar tudo de jun.
--
--   2) Regra com start_date futuro: last_mat é populado mesmo antes da regra
--      "começar". Ex: auto-sync com start=5/jul, clica em 26/mai → last_mat
--      vira 26/mai. Em 5/jun a função olha "próxima após 26/mai" = 5/jun
--      (ignorando start_date) e materializa errado.
--
-- Correção: voltar ao comportamento original (só atualiza se v_count > 0).
-- A justificativa antiga ("avançar mesmo com 0 ocorrências pra não retentar
-- ciclo de fatura R$ 0") era over-engineering: re-tentar uma fatura R$ 0
-- é barato e idempotente.
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
  v_is_bill_payment boolean := false;
  v_to_card_id uuid;
  v_dynamic_amount numeric;
  v_effective_amount numeric;
begin
  select * into v_rule from public.recurring_rules where id = p_rule_id;
  if not found or not v_rule.is_active then
    return 0;
  end if;

  -- Detecta auto-sync de pagamento de fatura
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
      v_effective_amount := v_rule.amount;
      if v_is_bill_payment then
        v_dynamic_amount := public.credit_card_bill_amount(v_to_card_id, v_cursor);
        if v_dynamic_amount is not null then
          v_effective_amount := v_dynamic_amount;
        end if;
      end if;

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
      -- Se bill = 0, NÃO incrementa v_count. last_mat não vai ser atualizado
      -- pra esta tentativa. Próxima materialização vai re-tentar — o que é OK,
      -- compute_credit_card_bill_amount é barato. Quando a fatura ficar > 0,
      -- a tentativa seguinte cria e avança last_mat.
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

  -- ✅ FIX: só atualiza se realmente criou algo. Evita:
  --   - retrocesso (last_mat > v_end)
  --   - avanço prematuro (regra com start_date futuro)
  if v_count > 0 then
    update public.recurring_rules
      set last_materialized_date = v_end
      where id = p_rule_id
        and (last_materialized_date is null or v_end > last_materialized_date);
  end if;

  return v_count;
end;
$$;

revoke all on function public.materialize_recurrence(uuid, date) from public;
grant execute on function public.materialize_recurrence(uuid, date) to authenticated;

comment on function public.materialize_recurrence is
  'Materializa ocorrências de uma regra recorrente até p_until_date. '
  'Regras de pagamento de fatura (transfer pra credit_card cuja origem '
  'é a payment_account) têm o amount calculado dinamicamente. Faturas '
  'R$ 0 são puladas. last_materialized_date só avança se houve ocorrências '
  'criadas E o avanço é estritamente forward — nunca retrocede.';
