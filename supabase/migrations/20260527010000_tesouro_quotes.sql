-- ============================================================================
-- Finanças — Cache de PU oficial do Tesouro Direto
--
-- Fonte: tesourotransparente.gov.br CSV (PrecoTaxaTesouroDireto.csv)
-- Atualização: diária via cron sync-tesouro-prices
--
-- Permite calcular current_balance da RF pública de forma 100% precisa
-- (sem aproximação por Selic): basta multiplicar quantity × PU.
-- ============================================================================

set search_path = public;

create table if not exists public.tesouro_quotes (
  title_type text not null,           -- ex: 'Tesouro Selic', 'Tesouro IPCA+'
  maturity_date date not null,        -- vencimento do título
  base_date date not null,            -- dia de fechamento
  pu_base numeric(14, 4) not null,    -- PU base manhã (R$)
  source text not null default 'tesouro_transparente',
  fetched_at timestamptz not null default now(),
  primary key (title_type, maturity_date, base_date)
);

create index if not exists tesouro_quotes_lookup_idx
  on public.tesouro_quotes(title_type, maturity_date, base_date desc);

-- Cotação é dado público; read pra qualquer authenticated
alter table public.tesouro_quotes enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tesouro_quotes' and policyname = 'tesouro_quotes: read for authenticated'
  ) then
    create policy "tesouro_quotes: read for authenticated"
      on public.tesouro_quotes for select
      to authenticated
      using (true);
  end if;
end$$;

grant select on public.tesouro_quotes to authenticated;
grant insert, update on public.tesouro_quotes to service_role;

comment on table public.tesouro_quotes is
  'Cache do PU base do Tesouro Direto (fonte: tesourotransparente.gov.br). '
  'Populado pelo cron sync-tesouro-prices. Usado pra calcular current_balance '
  'de RF pública: quantity × PU = saldo real, sem aproximação por Selic.';
