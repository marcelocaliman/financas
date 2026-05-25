-- ============================================================================
-- Finanças — Contas no exterior (Wise, Avenue, IBKR)
-- ============================================================================
-- Contas em corretoras/bancos estrangeiros têm regras diferentes no IRPF:
--   - Código Receita 62 (não 61)
--   - Não exigem CNPJ Brasileiro
--   - Exigem identificação do país + nome da instituição estrangeira
-- ============================================================================

set search_path = public;

alter table public.accounts
  add column is_exterior boolean not null default false,
  add column country text;

comment on column public.accounts.is_exterior is
  'Marca a conta como custodiada em instituição estrangeira (Wise, Avenue, IBKR).
   Quando true: código Receita 62 (não 61) + dispensa CNPJ Brasileiro.';
comment on column public.accounts.country is
  'País da instituição (apenas quando is_exterior=true). Ex: "Reino Unido", "EUA".';
