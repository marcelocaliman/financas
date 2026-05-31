-- ============================================================================
-- IR: modo revisão — classificações confirmadas pelo usuário (ROADMAP IR-6, D8)
-- ============================================================================
-- O motor é fail-loud: renda que ele não consegue classificar vira
-- `naoClassificado` (fora da base + aviso). Aqui o usuário RESOLVE cada
-- pendência, escolhendo o bucket — e a decisão fica PERSISTIDA por
-- (household, ano, origem). Na próxima apuração, o motor aplica a escolha.
-- A declaração final fica bloqueada enquanto houver pendência sem decisão.

set search_path = public;

create table if not exists public.ir_income_classifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  year          integer not null,
  -- Chave estável da origem da renda (ex.: "cat:aluguel::joão" ou "manual:<id>").
  -- Derivada de forma determinística em services/ir/rendimentos.ts.
  origin_key    text not null,
  -- Bucket escolhido pelo usuário.
  bucket        text not null check (bucket in ('tributavel', 'isento', 'exclusivo')),
  -- Código Receita opcional (ex.: 09 dividendos, 12 LCI/LCA).
  receita_code  text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, year, origin_key)
);

create index if not exists ir_income_classifications_household_year_idx
  on public.ir_income_classifications (household_id, year);

create trigger ir_income_classifications_set_updated_at
  before update on public.ir_income_classifications
  for each row execute function public.tg_set_updated_at();

alter table public.ir_income_classifications enable row level security;

create policy "ir_income_classifications: full access within household"
  on public.ir_income_classifications for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

comment on table public.ir_income_classifications is
  'Decisões do usuário no modo revisão do IR: como classificar uma renda que o '
  'motor não classificou sozinho. Aplicadas na apuração; gate do export final.';
