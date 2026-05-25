-- ============================================================================
-- Finanças — exclude_from_ir em transactions e recurring_rules
--
-- Casos de uso:
--   - Receita não declarada pelo usuário (decisão pessoal)
--   - Transferências internas que não devem aparecer em relatórios IR
--   - Ajustes de saldo iniciais (consolidação de despesas históricas)
--
-- Quando uma recurring_rule tem exclude_from_ir=true, as transactions
-- materializadas herdam o mesmo valor automaticamente.
-- ============================================================================

set search_path = public;

alter table public.transactions
  add column if not exists exclude_from_ir boolean not null default false;

alter table public.recurring_rules
  add column if not exists exclude_from_ir boolean not null default false;

comment on column public.transactions.exclude_from_ir is
  'Quando true, esta transaction é ignorada nos relatórios e checklist do IRPF. '
  'Use pra receitas que o usuário decidiu não declarar, ajustes de saldo, ou '
  'gastos pessoais não-dedutíveis que poluem reports.';

comment on column public.recurring_rules.exclude_from_ir is
  'Quando true, transactions materializadas desta regra herdam o flag.';

-- Index parcial pra acelerar queries do IR (que filtram exclude_from_ir=false)
create index if not exists transactions_ir_eligible_idx
  on public.transactions (household_id, kind, date)
  where exclude_from_ir = false;

-- ============================================================================
-- Atualizar materialize_recurrence: propagar exclude_from_ir + deductible_amount
-- (recriação completa pra preservar lógica anterior)
-- ============================================================================
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
begin
  select * into v_rule from public.recurring_rules where id = p_rule_id;
  if not found or not v_rule.is_active then
    return 0;
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
    if v_rule.kind = 'transfer' then
      perform public.create_transfer(
        v_rule.from_account_id, v_rule.to_account_id,
        v_rule.amount, v_cursor, v_rule.description
      );
      update public.transactions
        set recurring_rule_id = p_rule_id, is_recurring = true,
            exclude_from_ir = v_rule.exclude_from_ir
        where household_id = v_rule.household_id
          and date = v_cursor
          and description = v_rule.description
          and transfer_pair_id is not null
          and recurring_rule_id is null;
    else
      insert into public.transactions (
        household_id, account_id, category_id, kind,
        amount, amount_account, currency, description,
        payment_method, date, created_by,
        category_source, is_recurring, recurring_rule_id,
        fonte_pagadora_id, irrf_amount, inss_amount,
        exclude_from_ir, metadata
      ) values (
        v_rule.household_id, v_rule.account_id, v_rule.category_id, v_rule.kind,
        v_rule.amount, v_rule.amount, v_rule.currency, v_rule.description,
        v_rule.payment_method, v_cursor, v_creator,
        'manual', true, p_rule_id,
        v_rule.fonte_pagadora_id, v_rule.irrf_amount, v_rule.inss_amount,
        v_rule.exclude_from_ir,
        jsonb_build_object('recurring', true)
      ) returning id into v_tx_id;

      -- Auto-promote pra ir_deductible_payments (só se não exclude_from_ir)
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
    end if;

    v_count := v_count + 1;
    v_cursor := public.next_recurrence_date(
      v_rule.start_date, v_rule.frequency, v_rule.interval_count,
      v_rule.day_of_month, v_rule.day_of_week, v_cursor + 1
    );
  end loop;

  if v_count > 0 then
    update public.recurring_rules
      set last_materialized_date = v_end where id = p_rule_id;
  end if;

  return v_count;
end;
$$;

revoke all on function public.materialize_recurrence(uuid, date) from public;
grant execute on function public.materialize_recurrence(uuid, date) to authenticated;
