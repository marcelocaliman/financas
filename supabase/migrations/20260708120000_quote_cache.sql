-- Cache COMPARTILHADO de cotação de ativos por símbolo (preço público de mercado).
-- Faz a economia da cotação fechar: em vez de cada usuário bater na brapi/Finnhub, TODOS
-- dividem UMA busca por símbolo por janela. O custo passa a escalar com "símbolos distintos",
-- não com "usuários" — então o custo fixo do provedor cobre dezenas/centenas de assinantes.
--
-- IMPORTANTE (E2EE): guarda APENAS símbolo → preço/moeda. NÃO há user_id nem vínculo com quem
-- possui o quê — "AAPL = 283 USD" é dado PÚBLICO de mercado, não dado financeiro do usuário. O
-- servidor já via o símbolo na requisição pra fazer o proxy; cachear o preço público nada expõe.
--
-- Escrita/leitura SÓ pelo serverless /api/quote via service_role. RLS liga e não há policy:
-- anon/authenticated não acessam; o service_role ignora RLS. O `updated_at` é a trava de
-- cadência (TTL) no servidor — limita a frequência de busca upstream independente do cliente.
create table if not exists public.quote_cache (
  symbol     text primary key,
  price      numeric not null,
  currency   text not null,
  updated_at timestamptz not null default now()
);

alter table public.quote_cache enable row level security;
alter table public.quote_cache force row level security;
revoke all on public.quote_cache from anon, authenticated;
