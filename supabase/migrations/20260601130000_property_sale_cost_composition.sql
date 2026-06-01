-- ============================================================================
-- Composição de custo na venda de imóvel (ganho de capital).
-- ============================================================================
-- O custo de aquisição pra GCAP não é só o preço pago: soma benfeitorias e
-- corretagem da compra, e a venda abate despesas (corretagem de venda). Antes
-- era um número único, superestimando o lucro tributável (M6).

alter table public.physical_asset_sales
  add column if not exists improvements numeric(14, 2) not null default 0,
  add column if not exists acquisition_brokerage numeric(14, 2) not null default 0,
  add column if not exists selling_expenses numeric(14, 2) not null default 0;
