-- ============================================================================
-- Recurring rules — templates de transações recorrentes
--
-- Modela despesas/receitas/transferências que repetem em uma cadência fixa.
-- Cron diário (`/api/cron/materialize-recurrences`) chama
-- materialize_recurrence(rule_id, until_date) que cria os transactions
-- faltantes desde `last_materialized_date` até a data alvo.
--
-- transactions.recurring_rule_id (já existente) faz o link reverso.
-- ============================================================================

create type recurrence_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'BRL'
    check (currency in ('BRL', 'EUR', 'USD')),
  description text not null,

  -- pra income/expense
  account_id uuid references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  payment_method text check (
    payment_method is null
    or payment_method in ('credit', 'debit', 'pix', 'cash', 'auto_debit', 'transfer')
  ),

  -- pra transfer
  from_account_id uuid references public.accounts(id) on delete cascade,
  to_account_id uuid references public.accounts(id) on delete cascade,

  -- cadência
  frequency recurrence_frequency not null,
  interval_count int not null default 1 check (interval_count between 1 and 365),
  -- âncora: pra monthly usa day_of_month; pra weekly usa day_of_week (0=dom)
  day_of_month int check (day_of_month is null or day_of_month between 1 and 31),
  day_of_week int check (day_of_week is null or day_of_week between 0 and 6),

  start_date date not null,
  end_date date,
  is_active boolean not null default true,

  -- até quando o cron já materializou (inclusive). null = nada gerado ainda.
  last_materialized_date date,

  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_rules_kind_targets check (
    case kind
      when 'transfer' then
        from_account_id is not null
        and to_account_id is not null
        and from_account_id <> to_account_id
        and account_id is null
      else
        account_id is not null
        and from_account_id is null
        and to_account_id is null
    end
  ),
  constraint recurring_rules_end_after_start check (
    end_date is null or end_date >= start_date
  )
);

create index recurring_rules_household_idx
  on public.recurring_rules(household_id);
create index recurring_rules_active_idx
  on public.recurring_rules(household_id, is_active) where is_active = true;

alter table public.recurring_rules enable row level security;

create policy "recurring_rules: full access within household"
  on public.recurring_rules for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create trigger recurring_rules_set_updated_at
before update on public.recurring_rules
for each row execute function public.tg_set_updated_at();


-- ============================================================================
-- Helper: próxima data de ocorrência ≥ `p_from`, dado uma regra.
-- Lógica pura: não toca em transactions.
-- ============================================================================
create or replace function public.next_recurrence_date(
  p_start_date date,
  p_frequency recurrence_frequency,
  p_interval int,
  p_day_of_month int,
  p_day_of_week int,
  p_from date
)
returns date
language plpgsql
immutable
as $$
declare
  v_candidate date;
  v_anchor int;
  v_diff int;
begin
  if p_from <= p_start_date then
    return p_start_date;
  end if;

  case p_frequency
    when 'daily' then
      -- nº de intervalos completos entre start e from
      v_diff := (p_from - p_start_date);
      -- arredonda pra cima
      v_candidate := p_start_date + (ceil(v_diff::numeric / p_interval)::int * p_interval);
      return v_candidate;

    when 'weekly' then
      -- semanal: anda em múltiplos de 7*interval
      v_diff := (p_from - p_start_date);
      v_candidate := p_start_date + (ceil(v_diff::numeric / (7 * p_interval))::int * 7 * p_interval);
      return v_candidate;

    when 'monthly' then
      -- mensal: anda em múltiplos de interval meses, ancorado no day_of_month
      v_anchor := coalesce(p_day_of_month, extract(day from p_start_date)::int);
      -- começa do start, avança até passar p_from
      v_candidate := p_start_date;
      while v_candidate < p_from loop
        v_candidate := (date_trunc('month', v_candidate) + (p_interval || ' months')::interval)::date;
        -- ajusta dia (último dia do mês se anchor > dias do mês)
        v_candidate := least(
          (date_trunc('month', v_candidate) + ((v_anchor - 1) || ' days')::interval)::date,
          (date_trunc('month', v_candidate) + interval '1 month' - interval '1 day')::date
        );
      end loop;
      return v_candidate;

    when 'yearly' then
      v_candidate := p_start_date;
      while v_candidate < p_from loop
        v_candidate := (v_candidate + (p_interval || ' years')::interval)::date;
      end loop;
      return v_candidate;
  end case;
end;
$$;

revoke all on function public.next_recurrence_date(date, recurrence_frequency, int, int, int, date) from public;
grant execute on function public.next_recurrence_date(date, recurrence_frequency, int, int, int, date) to authenticated;


-- ============================================================================
-- materialize_recurrence(rule_id, until_date)
--
-- Gera todas as ocorrências da regra entre
--   max(start_date, last_materialized_date + interval)  e  until_date
-- (respeitando end_date), criando transactions ou pares de transfer.
-- Atualiza last_materialized_date pra a maior data gerada.
-- Retorna o número de instâncias criadas.
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
  v_anchor int;
  v_end date;
  v_count int := 0;
  v_creator uuid;
begin
  select * into v_rule from public.recurring_rules where id = p_rule_id;
  if not found or not v_rule.is_active then
    return 0;
  end if;

  -- limite final: min(until_date, end_date) — end_date pode ser null
  v_end := least(p_until_date, coalesce(v_rule.end_date, p_until_date));

  -- cursor inicial: primeira ocorrência ainda não materializada
  if v_rule.last_materialized_date is null then
    v_cursor := v_rule.start_date;
  else
    -- próxima ocorrência APÓS a última materializada
    v_cursor := public.next_recurrence_date(
      v_rule.start_date,
      v_rule.frequency,
      v_rule.interval_count,
      v_rule.day_of_month,
      v_rule.day_of_week,
      v_rule.last_materialized_date + 1
    );
  end if;

  -- usuário criador (pra preencher transactions.created_by)
  v_creator := coalesce(v_rule.created_by, (
    select id from public.users where household_id = v_rule.household_id limit 1
  ));

  while v_cursor <= v_end loop
    if v_rule.kind = 'transfer' then
      -- usa o RPC de transfer já existente — cria os 2 lados + pair_id
      perform public.create_transfer(
        v_rule.from_account_id,
        v_rule.to_account_id,
        v_rule.amount,
        v_cursor,
        v_rule.description
      );
      -- marcar as duas pontas como recorrentes vinculadas à regra
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
        metadata
      ) values (
        v_rule.household_id, v_rule.account_id, v_rule.category_id, v_rule.kind,
        v_rule.amount, v_rule.amount, v_rule.currency, v_rule.description,
        v_rule.payment_method, v_cursor, v_creator,
        'manual', true, p_rule_id,
        jsonb_build_object('recurring', true)
      );
    end if;

    v_count := v_count + 1;

    -- avança o cursor pra próxima ocorrência
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


-- ============================================================================
-- materialize_all_recurrences(household_id, until_date)
-- Atalho pra cron: roda materialize_recurrence em todas as regras ativas.
-- ============================================================================
create or replace function public.materialize_all_recurrences(
  p_household_id uuid,
  p_until_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_id uuid;
  v_total int := 0;
begin
  for v_rule_id in
    select id from public.recurring_rules
    where household_id = p_household_id and is_active = true
  loop
    v_total := v_total + public.materialize_recurrence(v_rule_id, p_until_date);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.materialize_all_recurrences(uuid, date) from public;
grant execute on function public.materialize_all_recurrences(uuid, date) to authenticated;
