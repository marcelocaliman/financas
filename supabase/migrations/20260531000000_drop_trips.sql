-- ============================================================================
-- Remove a feature Viagens (decisão de produto: simplificar o app no core
-- despesas/receitas + investimentos + IR). Remove tabelas, coluna de vínculo,
-- policies de storage e o bucket de fotos.
-- ============================================================================

set search_path = public;

-- Vínculo opcional em transactions (o índice transactions_trip_idx cai junto).
alter table public.transactions drop column if exists trip_id;

-- Tabelas (cascade resolve as FKs circulares trips <-> trip_photos).
drop table if exists public.trip_photos cascade;
drop table if exists public.trip_budget_items cascade;
drop table if exists public.trips cascade;

-- Policies de storage das fotos de viagem.
drop policy if exists "Users can view own household trip photos" on storage.objects;
drop policy if exists "Users can upload own household trip photos" on storage.objects;
drop policy if exists "Users can delete own household trip photos" on storage.objects;

-- O bucket "trip-photos" e seus objetos são removidos via Storage API
-- (storage.objects não aceita DELETE direto via SQL).
