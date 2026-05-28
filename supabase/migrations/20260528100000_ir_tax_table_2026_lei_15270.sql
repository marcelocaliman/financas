-- ============================================================================
-- Tabela IRPF 2026 — Lei 15.270/2025 (sancionada em 26/11/2025)
--
-- Mudanças vs estimativa anterior:
--   - Desconto simplificado anual: R$ 16.754,34 → R$ 17.640,00
--   - Deduções de educação, dependente continuam (R$ 3.561,50 e R$ 2.275,08 anuais)
--   - Faixas progressivas: INALTERADAS (mesmas alíquotas 7,5%-27,5%)
--   - NOVO: redutor instituído pela Lei 15.270/25 (zera imposto até R$ 60k/ano)
--     - Mensal: até R$ 5.000 redutor = R$ 312,89; R$ 5.000-R$ 7.350 fórmula
--       978,62 − 0,133145 × renda; > R$ 7.350: redutor = 0
--     - Anual: até R$ 60.000 zera; R$ 60.000-R$ 88.200 decai linear; > R$ 88.200: 0
--     - Implementado em services/ir/imposto.ts (computeRedutorAnual) e
--       lib/financial/irpf-monthly-table.ts (computeRedutorMensal)
--
-- Status: is_estimate = false (lei sancionada e vigente desde 01/01/2026)
-- ============================================================================

set search_path = public;

update public.ir_tax_table_annual
   set simples_limit = 17640.00,
       source = 'Lei 15.270/25 (sancionada 26/11/2025)',
       published_at = '2025-11-26',
       is_estimate = false,
       notes = 'Lei 15.270/2025 sancionada em 26/11/2025, vigência 01/01/2026. Tabela progressiva mantém alíquotas 7,5%-27,5% (faixa zero R$ 27.110,40). NOVIDADE: redutor anual (Art. 1º): zera imposto até renda tributável anual R$ 60k; decai linear até R$ 88,2k; zero acima. Desconto simplificado anual subiu de R$ 16.754,34 → R$ 17.640,00. Aplicação do redutor: services/ir/imposto.ts::computeRedutorAnual.'
 where year = 2026;

update public.ir_tax_table_monthly
   set source = 'Lei 15.270/25 (mensal 2026)',
       is_estimate = false,
       notes = 'Lei 15.270/2025: tabela progressiva mensal MP 1206/24 mantida (R$ 2.259,20 faixa zero). NOVIDADE: redutor mensal — renda bruta ≤ R$ 5.000: redutor = R$ 312,89; R$ 5.000 < renda ≤ R$ 7.350: redutor = 978,62 − 0,133145 × renda; > R$ 7.350: redutor = 0. Aplicação: lib/financial/irpf-monthly-table.ts::computeRedutorMensal.'
 where year = 2026 and effective_from_month = 1;
