-- ============================================================================
-- Finanças — Splits de transação
--
-- 1 compra dividida em N categorias. Ex: mercado R$ 300 =
-- R$ 200 comida + R$ 80 higiene + R$ 20 bebida.
--
-- Parent transaction continua com amount total (afeta saldo da conta).
-- Splits são SÓ pra category breakdown em relatórios — não afetam saldo.
-- Validação de soma é feita na action (somar splits = amount da parent).
-- ============================================================================

set search_path = public;

create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

comment on table public.transaction_splits is
  'Divisão de uma transaction em múltiplas categorias. Soma dos splits = '
  'amount da parent. Usado em relatórios pra category breakdown mais preciso. '
  'NÃO afeta saldo da conta (parent já fez isso).';

create index if not exists transaction_splits_tx_idx
  on public.transaction_splits (transaction_id);
create index if not exists transaction_splits_category_idx
  on public.transaction_splits (category_id);

alter table public.transaction_splits enable row level security;

create policy "transaction_splits: full access within household"
  on public.transaction_splits for all
  to authenticated
  using (
    transaction_id in (
      select id from public.transactions where household_id = current_household_id()
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions where household_id = current_household_id()
    )
  );
