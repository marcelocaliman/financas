-- Cache durável do "último valor bom" dos indicadores macro (juros + inflação) por praça/moeda.
-- Dado PÚBLICO (não é dado de usuário) — garante que o card de juros/inflação SEMPRE mostre um
-- valor real e atual mesmo quando a fonte oficial (BCB/IBGE/BCE/Fed/BoE) falhar pontualmente a
-- partir do datacenter (IP de nuvem é bloqueado/limitado de vez em quando). O valor guardado é a
-- ÚLTIMA leitura real publicada (IPCA é mensal, Selic é por Copom) — nunca um número defasado.
--
-- Escrita/leitura SÓ pelo serverless /api/macro via service_role. RLS liga e não há policy:
-- anon/authenticated não acessam; o service_role ignora RLS. Nada sensível aqui de qualquer forma.
create table if not exists public.macro_cache (
  currency   text primary key,
  rate       numeric,
  inflation  numeric,
  updated_at timestamptz not null default now()
);

alter table public.macro_cache enable row level security;
