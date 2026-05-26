-- ============================================================================
-- Finanças — Histórico de cotações + datas de compra pra gráfico de patrimônio
--
-- 1) Nova tabela quote_history pra preço de fechamento histórico por ticker.
--    Diferente de quote_snapshots (que tem só o último preço por ticker),
--    quote_history mantém uma série temporal (mensal por enquanto).
--
-- 2) Garante que todos os investments do user tenham purchase_date setada.
--    Placeholder: 2025-05-26 (1 ano antes de hoje). Usuário pode atualizar
--    pra data exata depois — fica registrado.
-- ============================================================================

set search_path = public;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) quote_history: série temporal de preços
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.quote_history (
  ticker text not null,
  date date not null,
  close numeric(14, 4) not null,
  source text not null default 'brapi',
  created_at timestamptz not null default now(),
  primary key (ticker, date)
);

create index if not exists quote_history_ticker_date_idx
  on public.quote_history(ticker, date desc);

-- Read pública pra usuários autenticados (cotação não é dado privado)
alter table public.quote_history enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quote_history' and policyname = 'quote_history: read for authenticated'
  ) then
    create policy "quote_history: read for authenticated"
      on public.quote_history for select
      to authenticated
      using (true);
  end if;
end$$;

grant select on public.quote_history to authenticated;
grant insert, update on public.quote_history to service_role;

comment on table public.quote_history is
  'Série temporal de preços de fechamento (mensal). Populada via backfill '
  'da brapi.dev historical API. Usada pra reconstruir patrimônio histórico.';
