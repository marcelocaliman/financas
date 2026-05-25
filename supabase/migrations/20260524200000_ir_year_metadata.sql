-- ============================================================================
-- Finanças — Metadata por ano-base do IRPF (arquivamento)
--
-- Permite "arquivar" um ano sem deletar dados — útil pra:
--   - Anos já entregues externamente pelo contador
--   - Anos antigos que ficam só pra histórico
--
-- Diferente de `ir_year_snapshots.closed_at` (que indica que o user FECHOU
-- a declaração após snapshot dos saldos). Arquivar é só visibility.
-- ============================================================================

set search_path = public;

create table public.ir_year_metadata (
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  archived_at timestamptz,
  /** Motivo do arquivamento (opcional, ex.: 'entregue_externamente') */
  archive_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, year)
);

create trigger ir_year_metadata_set_updated_at
  before update on public.ir_year_metadata
  for each row execute function public.tg_set_updated_at();

alter table public.ir_year_metadata enable row level security;

create policy "ir_year_metadata: full access within household"
  on public.ir_year_metadata for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

comment on table public.ir_year_metadata is
  'Metadados por ano-base do IRPF (arquivamento, notas). Distinto de '
  'ir_year_snapshots que congela o estado da declaração ao fechar.';

create index ir_year_metadata_archived_idx
  on public.ir_year_metadata(household_id, archived_at)
  where archived_at is not null;
