-- ============================================================================
-- Finanças — FIRE preferences (Financial Independence / Retire Early)
-- ============================================================================
-- Separação por escopo:
--   - HOUSEHOLD: parâmetros financeiros compartilhados pelo casal
--     (renda alvo, retorno esperado, inflação, SWR)
--   - USER: parâmetros individuais (idade, INSS, idade-alvo)
--
-- Tudo nullable com defaults sensatos pro mercado brasileiro:
--   retorno real = 6% a.a. (após inflação)
--   inflação = 4% a.a. (média histórica IPCA)
--   SWR = 4% (regra clássica Trinity)
-- ============================================================================

alter table public.households
  add column if not exists fire_target_monthly_income numeric(14, 2),
  add column if not exists fire_expected_return_pct numeric(5, 2) default 6.0
    check (fire_expected_return_pct is null or (fire_expected_return_pct >= 0 and fire_expected_return_pct <= 50)),
  add column if not exists fire_inflation_pct numeric(5, 2) default 4.0
    check (fire_inflation_pct is null or (fire_inflation_pct >= 0 and fire_inflation_pct <= 50)),
  add column if not exists fire_swr_pct numeric(5, 2) default 4.0
    check (fire_swr_pct is null or (fire_swr_pct > 0 and fire_swr_pct <= 20));

comment on column public.households.fire_target_monthly_income is
  'Renda passiva mensal desejada na aposentadoria (em moeda de exibição). '
  'NULL = usa despesa mensal atual como proxy.';
comment on column public.households.fire_expected_return_pct is
  'Retorno REAL anual esperado da carteira (já descontada inflação). '
  'Default 6% — conservador pra Brasil renda fixa+variável misto.';
comment on column public.households.fire_inflation_pct is
  'Inflação anual esperada (% a.a.). Usado pra corrigir despesa futura. '
  'Default 4% — média IPCA dos últimos 10 anos.';
comment on column public.households.fire_swr_pct is
  'Safe Withdrawal Rate (% a.a.). 4% = regra clássica Trinity. '
  '3.5% = mais conservador (sugerido pra prazos longos > 30 anos). '
  '3% = ultra-conservador. Patrimônio alvo = renda_anual / (swr/100).';

-- ----------------------------------------------------------------------------
-- USER-level: idade, INSS, idade-alvo
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists birth_date date,
  add column if not exists target_retirement_age int
    check (target_retirement_age is null or (target_retirement_age >= 18 and target_retirement_age <= 100)),
  add column if not exists inss_monthly_estimate numeric(14, 2);

comment on column public.users.birth_date is
  'Data de nascimento (opcional). Usada pra calcular idade atual + idade ao '
  'atingir FIRE.';
comment on column public.users.target_retirement_age is
  'Idade-alvo de aposentadoria (opcional). Display: "vc precisa X anos pra '
  'aposentar aos Y" e alerta se trajetória atual não bate.';
comment on column public.users.inss_monthly_estimate is
  'Estimativa do benefício INSS mensal futuro (R$, valor real hoje). '
  'Quando preenchido: o cálculo FIRE considera que a aposentadoria pública '
  'cobre parte da renda alvo (reduz patrimônio necessário).';
