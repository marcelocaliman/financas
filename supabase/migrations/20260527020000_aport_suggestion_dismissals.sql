-- ============================================================================
-- Finanças — Persiste dismissals de sugestões de aporte
--
-- Sem isso, o user clica "X" no banner do dashboard e a sugestão volta
-- no próximo refresh. Frustrante.
-- ============================================================================

set search_path = public;

create table if not exists public.aport_suggestion_dismissals (
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  dismissed_by uuid references auth.users(id) on delete set null,
  primary key (household_id, transaction_id, goal_id)
);

create index if not exists aport_dismissals_household_idx
  on public.aport_suggestion_dismissals(household_id);

alter table public.aport_suggestion_dismissals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'aport_suggestion_dismissals'
      and policyname = 'aport_dismissals: rw para membros do household'
  ) then
    create policy "aport_dismissals: rw para membros do household"
      on public.aport_suggestion_dismissals
      for all
      to authenticated
      using (household_id = public.current_household_id())
      with check (household_id = public.current_household_id());
  end if;
end$$;

grant select, insert, delete on public.aport_suggestion_dismissals to authenticated;

comment on table public.aport_suggestion_dismissals is
  'Marca (transaction_id, goal_id) que o usuário dispensou no banner de '
  'sugestões. Filtrados em getAportSuggestions pra não reaparecerem.';
