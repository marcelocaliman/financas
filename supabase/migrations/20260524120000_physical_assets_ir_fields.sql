-- ============================================================================
-- Finanças — Campos IR pra bens físicos
-- Adiciona campos exigidos pela Receita Federal na ficha "Bens e Direitos":
--   Imóveis (cód 11/12/13): cartório, IPTU, área, % de propriedade
--   Veículos (cód 21):       marca, modelo, ano de fabricação, placa
-- Campos já existentes que continuam multiuso:
--   registration_number → matrícula (imóvel) ou RENAVAM (veículo)
--   address             → endereço completo (imóvel)
-- ============================================================================

set search_path = public;

alter table public.physical_assets
  -- Imóveis
  add column if not exists registry_office text,             -- cartório de registro
  add column if not exists iptu_registration text,           -- inscrição municipal (IPTU)
  add column if not exists area_sqm numeric(10, 2),          -- área (m²)
  add column if not exists ownership_percent numeric(5, 2),  -- % de propriedade (default 100 = sozinho)
  -- Veículos
  add column if not exists brand text,                       -- marca (Honda, Volkswagen, Kawasaki)
  add column if not exists model text,                       -- modelo (Civic, Gol, Ninja 400)
  add column if not exists manufacture_year integer,         -- ano de fabricação
  add column if not exists license_plate text;               -- placa

comment on column public.physical_assets.registration_number is
  'Multiuso: matrícula do imóvel (real_estate) ou RENAVAM (vehicle).';
comment on column public.physical_assets.ownership_percent is
  'Quanto o titular detém do bem. Default 100 = único proprietário. Use 50 pra meação, etc.';
