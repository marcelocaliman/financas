-- ============================================================================
-- Finanças — Viagens (Trips)
--
-- Sistema dedicado pra controle de viagens com:
--   - Cadastro de viagens (planejadas, em andamento, concluídas)
--   - Localização (lat/lng pra mapa via Leaflet + OSM)
--   - Orçamento planejado por categoria
--   - Vinculação opcional de transações à viagem (gasto realizado)
--   - Galeria de fotos via Supabase Storage
--
-- Princípio: transação só existe em transactions. trip_id é só um vínculo
-- opcional. Realizado = SUM(amount_account) WHERE trip_id = X.
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1) trips: a viagem em si
-- ============================================================================
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,                          -- "Lisboa Set/2026"
  destination text not null,                   -- "Lisboa, Portugal"
  country_code text,                           -- "PT" (ISO 3166-1 alpha-2 — bandeirinha)
  latitude double precision,                   -- pra pin no mapa
  longitude double precision,
  start_date date,                             -- data de ida (nullable pra "ideia" sem data ainda)
  end_date date,                               -- data de volta
  status text not null default 'planning'
    check (status in ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  default_currency text not null default 'BRL'
    check (default_currency in ('BRL', 'EUR', 'USD', 'GBP')),
  cover_photo_id uuid,                         -- FK setado depois (cíclica com trip_photos)
  notes text,                                  -- markdown / itinerário
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

create index trips_household_idx on public.trips (household_id);
create index trips_status_idx on public.trips (status) where status != 'completed';
create index trips_start_date_idx on public.trips (start_date);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.tg_set_updated_at();

alter table public.trips enable row level security;
create policy trips_household_isolation on public.trips
  for all
  using (household_id = (select household_id from public.users where id = auth.uid()))
  with check (household_id = (select household_id from public.users where id = auth.uid()));

comment on table public.trips is
  'Viagens cadastradas pelo household. Orçamento via trip_budget_items, '
  'gastos reais via transactions.trip_id, fotos via trip_photos.';

-- ============================================================================
-- 2) trip_budget_items: planejado por categoria
-- ============================================================================
create table public.trip_budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null,                      -- "Passagem", "Hospedagem", "Comida", etc.
  planned_amount numeric(14, 2) not null check (planned_amount >= 0),
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (trip_id, category)
);

create index trip_budget_items_trip_idx on public.trip_budget_items (trip_id);

alter table public.trip_budget_items enable row level security;
create policy trip_budget_items_isolation on public.trip_budget_items
  for all
  using (
    trip_id in (select id from public.trips where household_id = (select household_id from public.users where id = auth.uid()))
  )
  with check (
    trip_id in (select id from public.trips where household_id = (select household_id from public.users where id = auth.uid()))
  );

comment on table public.trip_budget_items is
  'Linhas de orçamento da viagem por categoria. Realizado = soma de '
  'transactions vinculadas (trip_id + category_id ou trip_id geral).';

-- ============================================================================
-- 3) trip_photos: galeria
-- ============================================================================
create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  storage_path text not null,                  -- "{household_id}/{trip_id}/{uuid}.jpg"
  caption text,
  taken_at timestamptz,
  width int,
  height int,
  size_bytes int,
  position int not null default 0,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index trip_photos_trip_idx on public.trip_photos (trip_id, position);

alter table public.trip_photos enable row level security;
create policy trip_photos_isolation on public.trip_photos
  for all
  using (
    trip_id in (select id from public.trips where household_id = (select household_id from public.users where id = auth.uid()))
  )
  with check (
    trip_id in (select id from public.trips where household_id = (select household_id from public.users where id = auth.uid()))
  );

-- FK cover_photo_id agora que trip_photos existe
alter table public.trips
  add constraint trips_cover_photo_fk
  foreign key (cover_photo_id) references public.trip_photos(id) on delete set null;

comment on table public.trip_photos is
  'Fotos da viagem em Supabase Storage (bucket "trip-photos"). storage_path '
  'tem prefixo {household_id}/{trip_id}/ pra organização e RLS.';

-- ============================================================================
-- 4) transactions.trip_id: vínculo opcional
-- ============================================================================
alter table public.transactions
  add column trip_id uuid references public.trips(id) on delete set null;

create index transactions_trip_idx on public.transactions (trip_id)
  where trip_id is not null;

comment on column public.transactions.trip_id is
  'Vínculo opcional a uma viagem. Quando setado, a transação conta no '
  'realizado da viagem (não duplica em nenhum lugar — só categoriza).';

-- ============================================================================
-- 5) Storage bucket pra fotos das viagens
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,                                       -- privado, acesso via signed URL
  10 * 1024 * 1024,                            -- 10 MB max por foto
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- RLS no storage: usuário só vê fotos do próprio household
-- storage_path tem prefixo {household_id}/, então comparamos os primeiros bytes
create policy "Users can view own household trip photos"
  on storage.objects for select
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.users where id = auth.uid()
    )
  );

create policy "Users can upload own household trip photos"
  on storage.objects for insert
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.users where id = auth.uid()
    )
  );

create policy "Users can delete own household trip photos"
  on storage.objects for delete
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.users where id = auth.uid()
    )
  );
