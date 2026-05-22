-- ============================================================================
-- Finanças — Fase 4: regras de resgate + histórico
-- ============================================================================

set search_path = public;


-- ============================================================================
-- yield_rules — regra de saque mensal por ativo
-- ============================================================================
create table public.yield_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  destination_account_id uuid not null references public.accounts(id) on delete restrict,
  mode text not null check (mode in ('reinvest', 'fixed_amount', 'percentage')),
  suggested_amount numeric(14, 2),
  percentage numeric(5, 2), -- 0 a 100
  day_of_month int not null check (day_of_month between 1 and 31),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index yield_rules_household_idx on public.yield_rules(household_id);
create index yield_rules_active_idx on public.yield_rules(household_id, is_active);

create trigger yield_rules_set_updated_at
  before update on public.yield_rules
  for each row execute function public.tg_set_updated_at();

alter table public.yield_rules enable row level security;

create policy "yield_rules: full access within household"
  on public.yield_rules for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- redemption_intents — eventos de saque (executado, ajustado, pulado)
-- ============================================================================
create table public.redemption_intents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  yield_rule_id uuid not null references public.yield_rules(id) on delete cascade,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'executed', 'skipped')),
  suggested_amount numeric(14, 2) not null,
  executed_amount numeric(14, 2),
  transfer_pair_id uuid, -- liga ao par de transactions geradas
  notes text,
  decided_at timestamptz,
  decided_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique (yield_rule_id, due_date)
);

create index redemption_intents_household_due_idx
  on public.redemption_intents(household_id, due_date desc);
create index redemption_intents_status_idx
  on public.redemption_intents(household_id, status, due_date desc);

alter table public.redemption_intents enable row level security;

create policy "redemption_intents: full access within household"
  on public.redemption_intents for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- RPC ensure_pending_intents — cria/upserta intents pendentes pros próximos N
-- meses para cada yield_rule ativa do household.
-- Chamada pelo client toda vez que a página /resgates carrega.
-- ============================================================================
create or replace function public.ensure_pending_intents(p_months_ahead int default 3)
returns int -- número de intents inseridos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_rule public.yield_rules;
  v_today date := current_date;
  v_i int;
  v_due date;
  v_count int := 0;
begin
  if v_household is null then return 0; end if;

  for v_rule in
    select * from public.yield_rules
    where household_id = v_household and is_active = true
  loop
    for v_i in 0..p_months_ahead loop
      -- Próximo dia v_rule.day_of_month a partir de hoje + v_i meses
      v_due := make_date(
        extract(year from v_today + (v_i || ' months')::interval)::int,
        extract(month from v_today + (v_i || ' months')::interval)::int,
        least(v_rule.day_of_month, extract(day from
          (date_trunc('month', v_today + (v_i || ' months')::interval) + interval '1 month - 1 day')::date
        )::int)
      );

      if v_due < v_today then continue; end if;
      if v_rule.mode = 'reinvest' then continue; end if;

      insert into public.redemption_intents
        (household_id, yield_rule_id, due_date, suggested_amount, status)
      values
        (v_household, v_rule.id, v_due,
         coalesce(v_rule.suggested_amount, 0),
         'pending')
      on conflict (yield_rule_id, due_date) do nothing;

      get diagnostics v_count = row_count;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.ensure_pending_intents(int) from public;
grant execute on function public.ensure_pending_intents(int) to authenticated;


-- ============================================================================
-- RPC execute_redemption — marca intent como executado e cria transferência
-- ============================================================================
create or replace function public.execute_redemption(
  p_intent_id uuid,
  p_amount numeric
)
returns uuid -- transfer_pair_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_user uuid := auth.uid();
  v_intent public.redemption_intents;
  v_rule public.yield_rules;
  v_inv public.investments;
  v_pair uuid;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select * into v_intent from public.redemption_intents
    where id = p_intent_id and household_id = v_household;
  if not found then raise exception 'intent not found'; end if;
  if v_intent.status = 'executed' then raise exception 'intent already executed'; end if;

  select * into v_rule from public.yield_rules where id = v_intent.yield_rule_id;
  select * into v_inv from public.investments where id = v_rule.investment_id;

  -- Cria transfer entre conta de investimento → conta de destino
  v_pair := public.create_transfer(
    v_inv.account_id,
    v_rule.destination_account_id,
    p_amount,
    current_date,
    'Saque mensal · ' || v_inv.ticker
  );

  update public.redemption_intents
    set status = 'executed',
        executed_amount = p_amount,
        transfer_pair_id = v_pair,
        decided_at = now(),
        decided_by = v_user
    where id = p_intent_id;

  return v_pair;
end;
$$;

revoke all on function public.execute_redemption(uuid, numeric) from public;
grant execute on function public.execute_redemption(uuid, numeric) to authenticated;


-- ============================================================================
-- RPC skip_redemption — pula o mês (não executa)
-- ============================================================================
create or replace function public.skip_redemption(p_intent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_user uuid := auth.uid();
begin
  update public.redemption_intents
    set status = 'skipped', decided_at = now(), decided_by = v_user
    where id = p_intent_id and household_id = v_household;
end;
$$;

revoke all on function public.skip_redemption(uuid) from public;
grant execute on function public.skip_redemption(uuid) to authenticated;


-- Realtime
alter publication supabase_realtime add table public.yield_rules;
alter publication supabase_realtime add table public.redemption_intents;
