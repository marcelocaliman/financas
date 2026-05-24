-- ============================================================================
-- Finanças — fixup do IR complete migration
-- Subscriptions ficam em recurring_rules (com tag) — ajustando referências.
-- ============================================================================

set search_path = public;

-- ============================================================================
-- recurring_rules ganha ir_deductible_kind + is_tax_deductible
-- (em vez da tabela subscriptions que não existe)
-- ============================================================================
alter table public.recurring_rules
  add column if not exists ir_deductible_kind text,
  add column if not exists is_tax_deductible boolean not null default false;

comment on column public.recurring_rules.ir_deductible_kind is
  'Quando setado, materializations dessa recorrência podem ser auto-importadas
   como pagamentos dedutíveis IR.';

-- Liga ir_deductible_payments a recurring_rules (em vez de subscriptions)
alter table public.ir_deductible_payments
  add column if not exists recurring_rule_id uuid
    references public.recurring_rules(id) on delete set null,
  add column if not exists transaction_id uuid
    references public.transactions(id) on delete set null,
  add column if not exists auto_imported boolean not null default false;

-- Drop a coluna subscription_id se ela acabou sendo criada (não deveria ter sido)
alter table public.ir_deductible_payments
  drop column if exists subscription_id;

create index if not exists ir_deductible_payments_transaction_idx
  on public.ir_deductible_payments(transaction_id)
  where transaction_id is not null;

create index if not exists ir_deductible_payments_recurring_idx
  on public.ir_deductible_payments(recurring_rule_id)
  where recurring_rule_id is not null;
