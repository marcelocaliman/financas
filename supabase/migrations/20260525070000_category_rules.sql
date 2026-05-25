-- ============================================================================
-- Finanças — Categorização automática de transactions
--
-- Regras "se descrição contém X → categoria Y". Aplicadas no INSERT de
-- transactions (via trigger ou na action). Economiza dezenas de minutos
-- por mês pra usuário que lança muito.
--
-- Pattern: case-insensitive ILIKE %X% (substring match). Ordem por priority
-- desc — usuário pode forçar regras específicas antes de genéricas.
-- ============================================================================

set search_path = public;

create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  /** Padrão substring (ILIKE %pattern%) — case-insensitive */
  pattern text not null,
  /** Categoria que será aplicada quando o pattern bate */
  category_id uuid not null references public.categories(id) on delete cascade,
  /** Pra que tipo de transaction (income/expense/transfer). Default = expense */
  kind text not null default 'expense' check (kind in ('income', 'expense', 'transfer')),
  /** Quanto maior, aplica antes (regra específica > regra genérica) */
  priority int not null default 0,
  is_active boolean not null default true,
  /** Quantas vezes essa regra foi aplicada (analytics simples) */
  hits int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.category_rules is
  'Regras de auto-categorização: descrição da transaction contendo "pattern" '
  'recebe category_id automaticamente. Aplicado na createTransaction action '
  '(antes do insert) e em batch import.';

create index if not exists category_rules_household_active_priority_idx
  on public.category_rules (household_id, is_active, priority desc);

alter table public.category_rules enable row level security;

create policy "category_rules: full access within household"
  on public.category_rules for all
  to authenticated
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

create trigger category_rules_set_updated_at
  before update on public.category_rules
  for each row execute function public.tg_set_updated_at();
