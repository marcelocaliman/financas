-- ============================================================================
-- Finanças — Fase 5: metas
-- ============================================================================

set search_path = public;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  target_amount numeric(14, 2) not null,
  current_amount numeric(14, 2) not null default 0,
  target_date date,
  linked_account_id uuid references public.accounts(id) on delete set null,
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_household_idx on public.goals(household_id);
create index goals_household_active_idx on public.goals(household_id) where is_archived = false;

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.tg_set_updated_at();

alter table public.goals enable row level security;

create policy "goals: full access within household"
  on public.goals for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

alter publication supabase_realtime add table public.goals;
