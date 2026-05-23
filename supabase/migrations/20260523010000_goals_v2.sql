-- ============================================================================
-- 20260523010000_goals_v2.sql
--
-- Overhaul de /metas: tipo, prioridade, alocação de fontes (multi-fonte),
-- histórico de contribuições. Permite que current_amount seja derivado
-- automaticamente do saldo real das fontes vinculadas (contas/investimentos)
-- + contribuições registradas — eliminando a edição manual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.goal_type_enum as enum (
    'emergencia', 'casa', 'veiculo', 'viagem',
    'aposentadoria', 'educacao', 'projeto', 'outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.goal_allocation_mode as enum (
    'manual', 'fixed_amount', 'percentage', 'waterfall'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.goal_source_type as enum (
    'account', 'investment', 'manual'
  );
exception when duplicate_object then null; end $$;


-- ----------------------------------------------------------------------------
-- GOALS: novas colunas
-- ----------------------------------------------------------------------------
alter table public.goals
  add column if not exists goal_type public.goal_type_enum not null default 'outro',
  add column if not exists priority int not null default 100,
  add column if not exists allocation_mode public.goal_allocation_mode not null default 'manual',
  -- allocation_value: significa coisas diferentes por mode:
  --   fixed_amount → R$ por mês destinado
  --   percentage   → 0..1 da sobra mensal (ex 0.30 = 30%)
  --   waterfall    → ignored (consome o que sobrar das anteriores)
  --   manual       → ignored
  add column if not exists allocation_value numeric(14, 4),
  -- Dia recomendado pra fazer o aporte (1..31). Usado no calendário.
  add column if not exists contribution_day int check (contribution_day between 1 and 31);

create index if not exists goals_household_priority_idx
  on public.goals(household_id, priority);


-- ----------------------------------------------------------------------------
-- GOAL_SOURCES: cada meta pode ter N fontes
-- ----------------------------------------------------------------------------
create table if not exists public.goal_sources (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  source_type public.goal_source_type not null,
  -- account_id pra source_type='account', investment_id pra 'investment'.
  -- Pra 'manual' deve ser NULL — o valor vem direto de allocated_amount.
  source_id uuid,
  -- Pelo menos um dos dois deve ser preenchido:
  --   allocated_amount: R$ fixos earmarked (snapshot pra manual; teto pra account/investment)
  --   allocated_pct:    0..1 do saldo dinâmico da fonte (só pra account/investment)
  allocated_amount numeric(14, 2),
  allocated_pct numeric(5, 4) check (allocated_pct is null or (allocated_pct >= 0 and allocated_pct <= 1)),
  notes text,
  created_at timestamptz not null default now(),
  constraint goal_sources_value_check check (
    allocated_amount is not null or allocated_pct is not null
  ),
  constraint goal_sources_manual_no_id check (
    source_type != 'manual' or source_id is null
  ),
  constraint goal_sources_typed_has_id check (
    source_type = 'manual' or source_id is not null
  )
);

create index if not exists goal_sources_goal_idx on public.goal_sources(goal_id);
create index if not exists goal_sources_source_idx on public.goal_sources(source_type, source_id);

alter table public.goal_sources enable row level security;

create policy "goal_sources: full access via goal household"
  on public.goal_sources for all to authenticated
  using (exists (
    select 1 from public.goals g
    where g.id = goal_sources.goal_id
      and g.household_id = public.current_household_id()
  ))
  with check (exists (
    select 1 from public.goals g
    where g.id = goal_sources.goal_id
      and g.household_id = public.current_household_id()
  ));


-- ----------------------------------------------------------------------------
-- GOAL_CONTRIBUTIONS: registra cada aporte na meta
-- ----------------------------------------------------------------------------
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  date date not null,
  amount numeric(14, 2) not null check (amount != 0),
  -- 'manual' (usuário clicou "Aportar"),
  -- 'auto_waterfall' (cron mensal seguiu plano),
  -- 'transfer_link' (usuário vinculou uma transferência real)
  source text not null default 'manual',
  -- Quando source='transfer_link', aponta pra transação
  transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists goal_contributions_goal_date_idx
  on public.goal_contributions(goal_id, date desc);

alter table public.goal_contributions enable row level security;

create policy "goal_contributions: full access via goal household"
  on public.goal_contributions for all to authenticated
  using (exists (
    select 1 from public.goals g
    where g.id = goal_contributions.goal_id
      and g.household_id = public.current_household_id()
  ))
  with check (exists (
    select 1 from public.goals g
    where g.id = goal_contributions.goal_id
      and g.household_id = public.current_household_id()
  ));


-- ----------------------------------------------------------------------------
-- RPC: reorder_goals(ordered_ids)
-- Atualiza priority em lote — usado pelo drag-and-drop.
-- ----------------------------------------------------------------------------
create or replace function public.reorder_goals(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  i int;
begin
  if v_household is null then raise exception 'no household'; end if;
  for i in 1 .. array_length(p_ids, 1) loop
    update public.goals
    set priority = i
    where id = p_ids[i] and household_id = v_household;
  end loop;
end;
$$;

revoke all on function public.reorder_goals(uuid[]) from public;
grant execute on function public.reorder_goals(uuid[]) to authenticated;


-- ----------------------------------------------------------------------------
-- RPC: record_goal_contribution
-- Adiciona uma contribuição e (se solicitado) atualiza current_amount da meta
-- atomicamente. Usado pelo botão "Aportar" e pela rotina de waterfall.
-- ----------------------------------------------------------------------------
create or replace function public.record_goal_contribution(
  p_goal_id uuid,
  p_amount numeric,
  p_date date default current_date,
  p_source text default 'manual',
  p_notes text default null,
  p_transaction_id uuid default null,
  -- Quando true, soma o amount no current_amount diretamente. Quando false,
  -- só registra histórico (current_amount fica derived das sources).
  p_bump_current boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_id uuid;
begin
  if v_household is null then raise exception 'no household'; end if;

  if not exists (select 1 from public.goals where id = p_goal_id and household_id = v_household) then
    raise exception 'goal not found in household';
  end if;

  insert into public.goal_contributions
    (goal_id, date, amount, source, notes, transaction_id, created_by)
  values
    (p_goal_id, p_date, p_amount, p_source, p_notes, p_transaction_id, auth.uid())
  returning id into v_id;

  if p_bump_current then
    update public.goals
    set current_amount = round(current_amount + p_amount, 2)
    where id = p_goal_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_goal_contribution(uuid, numeric, date, text, text, uuid, boolean) from public;
grant execute on function public.record_goal_contribution(uuid, numeric, date, text, text, uuid, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- Backfill: prioridades = sort_order existente, tipo default = 'outro'.
-- ----------------------------------------------------------------------------
update public.goals
set priority = coalesce(sort_order, 100)
where priority = 100;
