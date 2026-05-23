-- ============================================================================
-- 20260523020000_category_budgets.sql
--
-- Orçamento mensal por categoria. Cada (household, category) tem um
-- histórico de "budgets" — quando o usuário muda o limite, cria nova linha
-- com start_month maior. Pra consultar "qual o budget de category C em mês M",
-- pega a linha com maior start_month ≤ M.
--
-- Suporta multi-currency (orçamento em € pra categoria de gastos no Euro).
-- alert_threshold = 0..1, default 0.80 — quando consumo passa esse pct, vira
-- amarelo na UI. Acima de 1.00 = vermelho.
-- ============================================================================

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  -- Primeiro dia do mês a partir do qual esse budget vale (YYYY-MM-01)
  start_month date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'BRL' check (currency in ('BRL', 'EUR', 'USD')),
  -- 0..1 — quando passar esse pct vira "alerta" na UI
  alert_threshold numeric(3, 2) not null default 0.80
    check (alert_threshold >= 0 and alert_threshold <= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, start_month)
);

create index if not exists category_budgets_household_idx
  on public.category_budgets(household_id, category_id, start_month desc);

create trigger category_budgets_set_updated_at
  before update on public.category_budgets
  for each row execute function public.tg_set_updated_at();

alter table public.category_budgets enable row level security;

create policy "category_budgets: full access within household"
  on public.category_budgets for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
