-- ============================================================================
-- Permite gross_amount = 0 em ir_other_incomes
--
-- Motivo: vendas de RF (Tesouro, CDB) sem lucro (gross_proceeds == initial)
-- ainda precisam ser registradas em "Rendimentos exclusivos de fonte" pra
-- rastreabilidade do fluxo. O check antigo (> 0) impedia o auto-create.
--
-- Para evitar lixo: pelo menos UM dos valores monetários deve ser > 0
-- (gross OU irrf OU thirteenth). Vendas com tudo zero seguem rejeitadas.
-- ============================================================================

alter table public.ir_other_incomes
  drop constraint if exists ir_other_incomes_gross_amount_check;

alter table public.ir_other_incomes
  add constraint ir_other_incomes_amounts_nonempty
  check (gross_amount >= 0 and (gross_amount > 0 or irrf_amount > 0 or thirteenth_amount > 0));
