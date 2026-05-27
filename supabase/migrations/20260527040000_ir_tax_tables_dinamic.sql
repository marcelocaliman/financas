-- ============================================================================
-- Finanças — Tabelas IRPF dinâmicas (anual + mensal)
--
-- Substitui constantes hardcoded em imposto.ts/carne-leao.ts por dados no
-- banco. A Receita atualiza tabelas periodicamente (MPs/Leis) — com schema
-- dinâmico, basta INSERT pra novo ano sem alteração de código.
--
-- Dados públicos (não dependem de household). Read pra todo authenticated;
-- write apenas service_role (atualização manual via SQL ou seed).
-- ============================================================================

set search_path = public;

-- ────────────────────────────────────────────────────────────────────────────
-- TABELA ANUAL — usada no cálculo do IRPF de ajuste (declaração)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.ir_tax_table_annual (
  year integer primary key,
  -- Array ordenado: [{upTo, rate, deduct}, ...]. upTo é o limite SUPERIOR
  -- inclusive de cada faixa; último item usa um número grande pra "infinito".
  brackets jsonb not null,
  simples_pct numeric(5, 4) not null,           -- ex: 0.2 (20%)
  simples_limit numeric(12, 2) not null,         -- teto do desconto simples
  dependent_deduction numeric(10, 2) not null,   -- dedução anual por dependente
  education_limit_per_person numeric(10, 2) not null,
  source text not null,                          -- "Lei 14.848/24", "MP 1206/24"
  published_at date,                             -- quando a tabela foi publicada
  -- True quando a Receita ainda não publicou tabela oficial pra esse ano
  -- (estamos usando estimativa baseada em outras tabelas/MPs)
  is_estimate boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- TABELA MENSAL — carnê-leão + retenção fonte de salário
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.ir_tax_table_monthly (
  year integer not null,
  -- Mês a partir do qual a tabela vigora (1-12). Permite múltiplas tabelas
  -- num mesmo ano quando uma MP é publicada no meio do ano (ex: jan-abr/2024
  -- usou MP 1171/23, mai-dez/2024 usou MP 1206/24).
  effective_from_month integer not null check (effective_from_month between 1 and 12),
  brackets jsonb not null,
  dependent_deduction numeric(10, 2) not null,   -- dedução mensal por dependente
  source text not null,
  is_estimate boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  primary key (year, effective_from_month)
);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS — dados públicos (leitura free pra authenticated)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.ir_tax_table_annual enable row level security;
alter table public.ir_tax_table_monthly enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='ir_tax_table_annual'
      and policyname='ir_tax_annual: read all authenticated'
  ) then
    create policy "ir_tax_annual: read all authenticated"
      on public.ir_tax_table_annual for select
      to authenticated
      using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='ir_tax_table_monthly'
      and policyname='ir_tax_monthly: read all authenticated'
  ) then
    create policy "ir_tax_monthly: read all authenticated"
      on public.ir_tax_table_monthly for select
      to authenticated
      using (true);
  end if;
end$$;

grant select on public.ir_tax_table_annual to authenticated;
grant select on public.ir_tax_table_monthly to authenticated;
grant insert, update, delete on public.ir_tax_table_annual to service_role;
grant insert, update, delete on public.ir_tax_table_monthly to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- SEED — tabelas conhecidas até ano-base 2025
-- ────────────────────────────────────────────────────────────────────────────

-- ANO-BASE 2024 (declaração 2025) — Lei 14.848/24 ratificou MP 1206/24
-- Fonte: Anexo I da Lei 14.848/24
insert into public.ir_tax_table_annual
  (year, brackets, simples_pct, simples_limit, dependent_deduction, education_limit_per_person, source, published_at, is_estimate, notes)
values
  (2024,
   '[
     {"upTo": 26963.20, "rate": 0, "deduct": 0},
     {"upTo": 33919.80, "rate": 0.075, "deduct": 2022.24},
     {"upTo": 45012.60, "rate": 0.15, "deduct": 4566.23},
     {"upTo": 55976.16, "rate": 0.225, "deduct": 7942.17},
     {"upTo": 999999999, "rate": 0.275, "deduct": 10740.98}
   ]'::jsonb,
   0.20, 16754.34, 2275.08, 3561.50,
   'Lei 14.848/24 (ratifica MP 1206/24)',
   '2024-05-28',
   false,
   'Tabela anual oficial — média ponderada das tabelas mensais jan-abr e mai-dez/2024')
on conflict (year) do nothing;

-- ANO-BASE 2025 (declaração 2026) — MP 1206/24 vigente o ano inteiro
-- Tabela anual = mensal × 12 já que vigora 12 meses
insert into public.ir_tax_table_annual
  (year, brackets, simples_pct, simples_limit, dependent_deduction, education_limit_per_person, source, published_at, is_estimate, notes)
values
  (2025,
   '[
     {"upTo": 27110.40, "rate": 0, "deduct": 0},
     {"upTo": 33919.80, "rate": 0.075, "deduct": 2033.28},
     {"upTo": 45012.60, "rate": 0.15, "deduct": 4577.27},
     {"upTo": 55976.16, "rate": 0.225, "deduct": 7953.21},
     {"upTo": 999999999, "rate": 0.275, "deduct": 10752.02}
   ]'::jsonb,
   0.20, 16754.34, 2275.08, 3561.50,
   'MP 1206/24 vigente jan-dez/2025 (anualizada da mensal R$ 2.259,20)',
   '2024-05-28',
   false,
   'Tabela anual ano-base 2025: tabela mensal MP 1206/24 vigente o ano todo. Faixa zero = R$ 2.259,20 × 12 = R$ 27.110,40.')
on conflict (year) do nothing;

-- TABELA MENSAL 2024 JAN-ABR (MP 1171/23)
insert into public.ir_tax_table_monthly
  (year, effective_from_month, brackets, dependent_deduction, source, is_estimate, notes)
values
  (2024, 1,
   '[
     {"upTo": 2112.00, "rate": 0, "deduct": 0},
     {"upTo": 2826.65, "rate": 0.075, "deduct": 158.40},
     {"upTo": 3751.05, "rate": 0.15, "deduct": 370.40},
     {"upTo": 4664.68, "rate": 0.225, "deduct": 651.73},
     {"upTo": 999999999, "rate": 0.275, "deduct": 884.96}
   ]'::jsonb,
   189.59, 'MP 1171/23 (vigente jan-abr/2024)', false, null)
on conflict (year, effective_from_month) do nothing;

-- TABELA MENSAL 2024 MAI-DEZ (MP 1206/24, ratificada pela Lei 14.848/24)
insert into public.ir_tax_table_monthly
  (year, effective_from_month, brackets, dependent_deduction, source, is_estimate, notes)
values
  (2024, 5,
   '[
     {"upTo": 2259.20, "rate": 0, "deduct": 0},
     {"upTo": 2826.65, "rate": 0.075, "deduct": 169.44},
     {"upTo": 3751.05, "rate": 0.15, "deduct": 381.44},
     {"upTo": 4664.68, "rate": 0.225, "deduct": 662.77},
     {"upTo": 999999999, "rate": 0.275, "deduct": 896.00}
   ]'::jsonb,
   189.59, 'MP 1206/24 / Lei 14.848/24 (vigente mai/2024+)', false, null)
on conflict (year, effective_from_month) do nothing;

-- TABELA MENSAL 2025 JAN+ (continua MP 1206/24 — sem nova MP até a publicação desta migration)
insert into public.ir_tax_table_monthly
  (year, effective_from_month, brackets, dependent_deduction, source, is_estimate, notes)
values
  (2025, 1,
   '[
     {"upTo": 2259.20, "rate": 0, "deduct": 0},
     {"upTo": 2826.65, "rate": 0.075, "deduct": 169.44},
     {"upTo": 3751.05, "rate": 0.15, "deduct": 381.44},
     {"upTo": 4664.68, "rate": 0.225, "deduct": 662.77},
     {"upTo": 999999999, "rate": 0.275, "deduct": 896.00}
   ]'::jsonb,
   189.59, 'MP 1206/24 mantida pra 2025 (atualizar quando MP/Lei nova for publicada)', false, null)
on conflict (year, effective_from_month) do nothing;

comment on table public.ir_tax_table_annual is
  'Tabela progressiva ANUAL do IRPF por ano-base. Substitui hardcoded constants. '
  'INSERT pra novo ano quando Receita publicar nova MP/Lei.';
comment on table public.ir_tax_table_monthly is
  'Tabela progressiva MENSAL do IRPF (carnê-leão + retenção fonte). '
  'effective_from_month permite múltiplas tabelas no mesmo ano quando MP é publicada no meio do ano.';
