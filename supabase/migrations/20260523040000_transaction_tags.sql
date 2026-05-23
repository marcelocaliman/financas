-- ============================================================================
-- 20260523040000_transaction_tags.sql
--
-- Adiciona tags TEXT[] em transactions. Categorização secundária livre,
-- usada pra agrupar gastos de projetos pontuais (Viagem Itália 2026,
-- Reforma cozinha, etc) sem inchar a árvore de categorias.
-- ============================================================================

alter table public.transactions
  add column if not exists tags text[] not null default '{}';

create index if not exists transactions_tags_idx
  on public.transactions using gin (tags);
