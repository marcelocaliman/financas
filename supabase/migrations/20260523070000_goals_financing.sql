-- ============================================================================
-- Finanças — Financiamento opcional em metas (compra de imóvel financiado)
-- ============================================================================
-- Permite que uma meta represente compra de imóvel via financiamento:
--   - target_amount continua sendo "quanto poupar" (= entrada + custos)
--   - novas colunas guardam preço cheio + parâmetros do financiamento
--   - cálculo de parcela mensal é feito client-side (lib/financial/mortgage.ts)
-- Todas as colunas são NULLABLE → metas existentes não mudam.
-- ============================================================================

alter table public.goals
  add column if not exists property_price numeric(14, 2),
  add column if not exists property_down_pct numeric(5, 4) check (
    property_down_pct is null or (property_down_pct >= 0 and property_down_pct <= 1)
  ),
  add column if not exists property_closing_pct numeric(5, 4) check (
    property_closing_pct is null or (property_closing_pct >= 0 and property_closing_pct <= 1)
  ),
  add column if not exists loan_term_months integer check (
    loan_term_months is null or (loan_term_months > 0 and loan_term_months <= 600)
  ),
  add column if not exists loan_annual_rate_pct numeric(6, 3) check (
    loan_annual_rate_pct is null or (loan_annual_rate_pct >= 0 and loan_annual_rate_pct <= 100)
  ),
  add column if not exists loan_system text check (
    loan_system is null or loan_system in ('sac', 'price')
  );

comment on column public.goals.property_price is
  'Preço total do imóvel (R$). Quando preenchido, marca a meta como financiamento — target_amount fica = entrada + custos.';
comment on column public.goals.property_down_pct is
  'Fração da entrada (0..1, ex: 0.20 = 20%).';
comment on column public.goals.property_closing_pct is
  'Fração dos custos de cartório/ITBI (0..1, ex: 0.05 = 5%).';
comment on column public.goals.loan_term_months is
  'Prazo do financiamento em meses (ex: 360 = 30 anos).';
comment on column public.goals.loan_annual_rate_pct is
  'Taxa de juros anual nominal (% a.a., ex: 11.5).';
comment on column public.goals.loan_system is
  'Sistema de amortização: sac (parcela decrescente) ou price (parcela constante).';
