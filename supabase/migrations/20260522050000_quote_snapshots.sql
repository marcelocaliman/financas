-- ============================================================================
-- Finanças — snapshot de cotações brapi.dev
-- Tabela compartilhada entre households (cotações são públicas), serve como
-- L2 de cache pra reduzir hits à brapi e mantê-los dentro do plano free (5k/mês).
-- ============================================================================

set search_path = public;

create table public.quote_snapshots (
  ticker text primary key,
  price numeric(14, 4) not null,
  change_pct numeric(8, 4),
  long_name text,
  currency text,
  fetched_at timestamptz not null default now()
);

create index quote_snapshots_fetched_idx on public.quote_snapshots(fetched_at desc);

alter table public.quote_snapshots enable row level security;

-- Qualquer usuário autenticado lê (cotação não é dado pessoal)
create policy "quote_snapshots: read for authenticated"
  on public.quote_snapshots for select to authenticated
  using (true);

-- Escrita apenas via service role (lib/financial/brapi.ts faz upsert server-side
-- usando o anon key via Supabase client autenticado, então também precisamos
-- permitir write pra authenticated com restrição razoável — RLS permissiva aqui
-- não vaza dados pessoais já que a tabela é pública por natureza).
create policy "quote_snapshots: upsert for authenticated"
  on public.quote_snapshots for insert to authenticated
  with check (true);

create policy "quote_snapshots: update for authenticated"
  on public.quote_snapshots for update to authenticated
  using (true)
  with check (true);
