-- ============================================================================
-- Finanças — Adiciona `fetched_at` a indexer_history e currency_rates
--
-- Sem isso, o health check de "última atualização" usa created_at, que
-- representa a primeira INSERÇÃO de cada (indexer, date) ou (base, quote, date).
-- Quando o cron rodava e o BCB/exchange retornavam o mesmo valor (Selic só
-- muda no Copom, ~45 dias entre reuniões), o upsert achava a linha existente
-- e o created_at ficava parado. Aparecia "há 5d" mesmo o cron rodando ok.
--
-- Agora fetched_at é tocado a cada upsert do cron → health check confiável.
-- ============================================================================

set search_path = public;

alter table public.indexer_history
  add column if not exists fetched_at timestamptz not null default now();

alter table public.currency_rates
  add column if not exists fetched_at timestamptz not null default now();

-- Backfill: pra rows existentes, usa created_at como ponto de partida
update public.indexer_history set fetched_at = created_at where fetched_at = '1970-01-01' or fetched_at is null;
update public.currency_rates set fetched_at = created_at where fetched_at = '1970-01-01' or fetched_at is null;

comment on column public.indexer_history.fetched_at is
  'Última vez que o cron rodou e tocou esta linha. Atualizado em todo upsert. '
  'Usado pelo health check pra mostrar "última atualização" corretamente.';
comment on column public.currency_rates.fetched_at is
  'Última vez que o cron rodou e tocou esta linha. Atualizado em todo upsert. '
  'Usado pelo health check pra mostrar "última atualização" corretamente.';
