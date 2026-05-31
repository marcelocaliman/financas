-- ============================================================================
-- IR: isenções por perfil — aposentado 65+ e moléstia grave (ROADMAP IR-4)
-- ============================================================================
-- Cobre perfis que o motor ignorava:
--   - Aposentadoria/pensão de quem tem 65+ anos: parcela mensal isenta
--     (R$ 1.903,98 desde 2015) × 13 (12 meses + 13º) = R$ 24.751,74/ano.
--   - Moléstia grave (Lei 7.713/88 art. 6º XIV): proventos de aposentadoria/
--     reforma/pensão 100% isentos.
-- A idade vem de ir_filers.birth_date (já existe). Falta: flag de moléstia +
-- o parâmetro da parcela isenta por ano (na tabela do IR) + categoria manual.

set search_path = public;

-- 1) Flag de moléstia grave por declarante.
alter table public.ir_filers
  add column if not exists has_serious_illness boolean not null default false;

comment on column public.ir_filers.has_serious_illness is
  'Moléstia grave (Lei 7.713/88 art. 6º XIV): proventos de aposentadoria/'
  'reforma/pensão do declarante ficam 100% isentos. Auto-declarado.';

-- 2) Parcela isenta mensal de aposentadoria 65+ por ano-base (parametrizável).
--    Default = R$ 1.903,98 (valor congelado desde 2015). Anos futuros sem valor
--    próprio herdam via rollforward no código.
alter table public.ir_tax_table_annual
  add column if not exists elderly_monthly_exemption numeric(14, 2) not null default 1903.98;

comment on column public.ir_tax_table_annual.elderly_monthly_exemption is
  'Parcela mensal isenta de aposentadoria/pensão p/ maiores de 65 anos. '
  'Isenção anual = este valor × 13 (12 competências + 13º).';

-- 3) Categoria manual de aposentadoria/pensão (pra ir_other_incomes receber a
--    isenção). Recria o CHECK incluindo 'aposentadoria_pensao'.
alter table public.ir_other_incomes
  drop constraint if exists ir_other_incomes_category_check;

alter table public.ir_other_incomes
  add constraint ir_other_incomes_category_check check (category in (
    'tributavel_pj',
    'tributavel_pf',
    'aposentadoria_pensao',  -- aposentadoria/pensão (sujeita a isenção 65+/moléstia)
    'isento',
    'exclusivo_fonte',
    'rendimento_acumulado'
  ));

-- owner_filer_id já existe em ir_other_incomes? Garante (necessário pra saber
-- de quem é a aposentadoria e aplicar a idade/moléstia certa).
alter table public.ir_other_incomes
  add column if not exists owner_filer_id uuid references public.ir_filers(id) on delete set null;
