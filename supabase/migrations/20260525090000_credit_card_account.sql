-- ============================================================================
-- Finanças — Cartão de crédito como conta completa
--
-- Antes: usuário lançava 1 transaction por mês com o total da fatura.
-- Agora: cada compra vira tx no cartão; sistema calcula fatura aberta;
-- "pagar fatura" cria transfer da conta corrente pro cartão.
--
-- Campos adicionados:
--   credit_limit          — limite total do cartão
--   bill_close_day        — dia do fechamento (1-31)
--   bill_due_day          — dia do vencimento (1-31)
--   payment_account_id    — de onde a fatura é paga (auto-debit)
-- ============================================================================

set search_path = public;

alter table public.accounts
  add column if not exists credit_limit numeric(14, 2),
  add column if not exists bill_close_day int check (bill_close_day between 1 and 31),
  add column if not exists bill_due_day int check (bill_due_day between 1 and 31),
  add column if not exists payment_account_id uuid references public.accounts(id) on delete set null;

comment on column public.accounts.credit_limit is
  'Limite total do cartão. Só relevante quando type=credit_card.';
comment on column public.accounts.bill_close_day is
  'Dia do mês que a fatura fecha (1-31). Após esse dia, novas compras vão pra próxima fatura.';
comment on column public.accounts.bill_due_day is
  'Dia do mês que a fatura vence. Pagamento típico via débito automático.';
comment on column public.accounts.payment_account_id is
  'Conta de onde o pagamento da fatura sai (débito automático). Quando preenchido, '
  '"Pagar fatura" gera transfer automático.';
