-- ============================================================================
-- JCP (Juros sobre Capital Próprio) como tipo de movimento de investimento.
-- ============================================================================
-- JCP é tributação EXCLUSIVA de 15% na fonte (cód. 10 da ficha "Rendimentos
-- Sujeitos à Tributação Exclusiva"), NÃO isento como dividendo. Antes não havia
-- como distinguir — todo provento entrava como dividendo isento (cód. 09).
-- Adiciona 'jcp' ao CHECK de investment_movements.kind.

alter table public.investment_movements
  drop constraint if exists investment_movements_kind_check;

alter table public.investment_movements
  add constraint investment_movements_kind_check
  check (kind = any (array[
    'buy'::text, 'sell'::text, 'dividend'::text, 'jcp'::text,
    'split'::text, 'exercise'::text, 'assignment'::text, 'expiration'::text
  ]));
