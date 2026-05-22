-- ============================================================================
-- Finanças — Patrimônio imobilizado
-- Apartamento, carro, moto, bicicleta, computador, joia, obra de arte etc.
-- NÃO se mistura com investments (sem rendimento, sem cotação, sem fluxo).
-- Entra apenas no cálculo do patrimônio total.
-- ============================================================================

set search_path = public;

create table public.physical_assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null check (category in (
    'real_estate',      -- imóveis (apartamento, casa, terreno)
    'vehicle',          -- carro, moto, bicicleta
    'electronics',      -- computador, celular, eletrônicos
    'furniture',        -- móveis, decoração
    'jewelry',          -- joia, relógio, acessório
    'art',              -- obra, coleção
    'tools',            -- ferramenta, equipamento
    'other'
  )),
  description text,
  acquired_at date,
  acquired_value numeric(14, 2) not null default 0,
  current_value numeric(14, 2) not null,
  -- 'linear': depreciação linear N anos. 'none': mantém valor manual.
  depreciation_method text not null default 'none' check (depreciation_method in ('none', 'linear')),
  -- Anos para depreciar (só se method = 'linear')
  depreciation_years integer,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index physical_assets_household_idx on public.physical_assets(household_id);
create index physical_assets_household_category_idx
  on public.physical_assets(household_id, category)
  where is_active = true;

create trigger physical_assets_set_updated_at
  before update on public.physical_assets
  for each row execute function public.tg_set_updated_at();

alter table public.physical_assets enable row level security;

create policy "physical_assets: full access within household"
  on public.physical_assets for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

alter publication supabase_realtime add table public.physical_assets;
