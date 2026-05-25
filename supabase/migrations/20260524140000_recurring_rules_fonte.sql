-- ============================================================================
-- Finanças — Fonte pagadora em regras recorrentes
--
-- Salário, pró-labore, aluguel recebido — geralmente vêm de UMA fonte
-- (Empresa X, inquilino Y) com IRRF/INSS fixos. Hoje quem cadastra como
-- recorrente perde essa atribuição: cada transação materializada nasce sem
-- fonte_pagadora_id e sem IRRF/INSS, e o IR agrupa errado.
--
-- Esta migration:
--   1) Adiciona fonte_pagadora_id + irrf_amount + inss_amount em recurring_rules
--   2) Reescreve materialize_recurrence pra propagar esses campos pras
--      transactions geradas (só pra income/expense — transfer não tem fonte).
-- ============================================================================

set search_path = public;

alter table public.recurring_rules
  add column if not exists fonte_pagadora_id uuid references public.fontes_pagadoras(id) on delete set null,
  add column if not exists irrf_amount numeric(14, 2),
  add column if not exists inss_amount numeric(14, 2);

comment on column public.recurring_rules.fonte_pagadora_id is
  'Empresa/PJ que paga este recorrente. Propagado pras transactions geradas '
  'pra agrupar corretamente no IRPF (Ficha Rendimentos Tributáveis).';
comment on column public.recurring_rules.irrf_amount is
  'IRRF retido por ocorrência (padrão). Pode editar transação individual depois.';
comment on column public.recurring_rules.inss_amount is
  'INSS retido por ocorrência (padrão).';

create index if not exists recurring_rules_fonte_idx
  on public.recurring_rules(fonte_pagadora_id)
  where fonte_pagadora_id is not null;


-- ============================================================================
-- Reescrita: materialize_recurrence agora propaga fonte + IRRF + INSS
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
      perform public.create_transfer(
        v_rule.from_account_id,
        v_rule.to_account_id,
        v_rule.amount,
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
    end if;

    v_count := v_count + 1;

    v_cursor := public.next_recurrence_date(
      v_rule.start_date,
      v_rule.frequency,
      v_rule.interval_count,
      v_rule.day_of_month,
      v_rule.day_of_week,
      v_cursor + 1
    );
  end loop;

  if v_count > 0 then
    update public.recurring_rules
      set last_materialized_date = v_end
      where id = p_rule_id;
  end if;

  return v_count;
end;
$$;

revoke all on function public.materialize_recurrence(uuid, date) from public;
grant execute on function public.materialize_recurrence(uuid, date) to authenticated;
