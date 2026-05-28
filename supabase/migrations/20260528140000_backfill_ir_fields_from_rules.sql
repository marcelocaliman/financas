-- ============================================================================
-- Finanças — Backfill one-shot: propaga fonte_pagadora_id, irrf_amount,
-- inss_amount e exclude_from_ir das recurring_rules pras transactions
-- já materializadas (vinculadas via recurring_rule_id).
--
-- Motivação:
--   Antes do ajuste em services/recurrences.actions.ts (updateRecurringRule
--   passou a fazer backfill ativo), editar a fonte do salário (por exemplo)
--   só afetava as transações materializadas DEPOIS da edição. Todas as
--   anteriores continuavam com NULL — o checklist do IR seguia reclamando
--   indefinidamente de "recebimentos sem fonte pagadora".
--
--   Esta migration corrige o histórico de uma vez. Idempotente: pode rodar
--   quantas vezes for, só sobrescreve com os valores atuais da regra.
-- ============================================================================

set search_path = public;

update public.transactions tx
set
  fonte_pagadora_id = rr.fonte_pagadora_id,
  irrf_amount       = rr.irrf_amount,
  inss_amount       = rr.inss_amount,
  exclude_from_ir   = rr.exclude_from_ir
from public.recurring_rules rr
where tx.recurring_rule_id = rr.id
  and tx.kind <> 'transfer'
  and (
       tx.fonte_pagadora_id is distinct from rr.fonte_pagadora_id
    or tx.irrf_amount       is distinct from rr.irrf_amount
    or tx.inss_amount       is distinct from rr.inss_amount
    or tx.exclude_from_ir   is distinct from rr.exclude_from_ir
  );
