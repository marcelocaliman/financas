-- ============================================================================
-- Tabela IRPF ano-base 2026 — ESTIMATIVA
--
-- Receita ainda não publicou tabela oficial 2026. Enquanto isso, replicamos
-- a tabela 2025 (MP 1206/24) como estimativa pra cálculos do app não retornarem
-- 0 e atrapalharem a tomada de decisão durante o ano.
--
-- Quando a Receita publicar a nova MP/Lei pra 2026, atualizar via UPDATE
-- (não DELETE — preserva o histórico de versões).
-- ============================================================================

set search_path = public;

-- ANO-BASE 2026 — ESTIMATIVA baseada na tabela 2025 (MP 1206/24)
insert into public.ir_tax_table_annual
  (year, brackets, simples_pct, simples_limit, dependent_deduction, education_limit_per_person, source, published_at, is_estimate, notes)
values
  (2026,
   '[
     {"upTo": 27110.40, "rate": 0, "deduct": 0},
     {"upTo": 33919.80, "rate": 0.075, "deduct": 2033.28},
     {"upTo": 45012.60, "rate": 0.15, "deduct": 4577.27},
     {"upTo": 55976.16, "rate": 0.225, "deduct": 7953.21},
     {"upTo": 999999999, "rate": 0.275, "deduct": 10752.02}
   ]'::jsonb,
   0.20, 16754.34, 2275.08, 3561.50,
   'Estimativa baseada em MP 1206/24 — Receita ainda não publicou tabela oficial 2026',
   null,
   true,
   'Tabela 2026 ainda não publicada pela Receita Federal. Esta é uma cópia da tabela 2025 como estimativa razoável (provavelmente a Receita atualizará os limites mais alto). Atualizar quando a MP/Lei oficial sair.')
on conflict (year) do update
  set brackets = excluded.brackets,
      simples_pct = excluded.simples_pct,
      simples_limit = excluded.simples_limit,
      dependent_deduction = excluded.dependent_deduction,
      education_limit_per_person = excluded.education_limit_per_person,
      source = excluded.source,
      is_estimate = excluded.is_estimate,
      notes = excluded.notes;

-- TABELA MENSAL 2026 (estimativa = mensal vigente em 2025)
insert into public.ir_tax_table_monthly
  (year, effective_from_month, brackets, dependent_deduction, source, is_estimate, notes)
values
  (2026, 1,
   '[
     {"upTo": 2259.20, "rate": 0, "deduct": 0},
     {"upTo": 2826.65, "rate": 0.075, "deduct": 169.44},
     {"upTo": 3751.05, "rate": 0.15, "deduct": 381.44},
     {"upTo": 4664.68, "rate": 0.225, "deduct": 662.77},
     {"upTo": 999999999, "rate": 0.275, "deduct": 896.00}
   ]'::jsonb,
   189.59,
   'Estimativa baseada em MP 1206/24 (mensal 2025)',
   true,
   'Tabela mensal 2026 ainda não publicada — usando MP 1206/24 como estimativa. Atualizar quando sair.')
on conflict (year, effective_from_month) do update
  set brackets = excluded.brackets,
      dependent_deduction = excluded.dependent_deduction,
      source = excluded.source,
      is_estimate = excluded.is_estimate,
      notes = excluded.notes;
