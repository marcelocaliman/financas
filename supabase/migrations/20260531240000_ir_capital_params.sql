-- ============================================================================
-- IR: parâmetros de ganho de capital (cripto/exterior) saem do código → banco
-- (ROADMAP IR-10 / FIN). Mesma filosofia das tabelas do IR: por ano, com
-- rollforward no código. Antes estavam hardcoded em services/ir/exterior-crypto.ts.
-- ============================================================================

set search_path = public;

create table if not exists public.ir_tax_table_capital (
  year                      integer primary key,
  -- Cripto: vendas mensais até este valor são isentas.
  crypto_monthly_exemption  numeric(14, 2) not null default 35000,
  -- Faixas progressivas sobre o LUCRO (jsonb: [{upTo, rate}]).
  crypto_brackets           jsonb not null,
  -- Alíquota de ganho de capital no exterior (bens/ativos).
  exterior_rate             numeric(6, 4) not null default 0.15,
  source                    text,
  is_estimate               boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger ir_tax_table_capital_set_updated_at
  before update on public.ir_tax_table_capital
  for each row execute function public.tg_set_updated_at();

alter table public.ir_tax_table_capital enable row level security;
-- Tabela de referência pública (sem dados de usuário): leitura liberada a quem está logado.
create policy "ir_tax_table_capital: read"
  on public.ir_tax_table_capital for select to authenticated using (true);

-- Seed dos valores vigentes (Lei 13.259/2016 c/c IN RFB 1888/2019 p/ cripto;
-- 15% p/ exterior). upTo do topo usa um número grande no lugar de Infinity.
insert into public.ir_tax_table_capital (year, crypto_monthly_exemption, crypto_brackets, exterior_rate, source, is_estimate)
values
  (2024, 35000, '[{"upTo":5000000,"rate":0.15},{"upTo":10000000,"rate":0.175},{"upTo":30000000,"rate":0.2},{"upTo":999999999999,"rate":0.225}]'::jsonb, 0.15, 'Lei 13.259/16 + IN 1888/19', false),
  (2025, 35000, '[{"upTo":5000000,"rate":0.15},{"upTo":10000000,"rate":0.175},{"upTo":30000000,"rate":0.2},{"upTo":999999999999,"rate":0.225}]'::jsonb, 0.15, 'Lei 13.259/16 + IN 1888/19', false),
  (2026, 35000, '[{"upTo":5000000,"rate":0.15},{"upTo":10000000,"rate":0.175},{"upTo":30000000,"rate":0.2},{"upTo":999999999999,"rate":0.225}]'::jsonb, 0.15, 'Lei 13.259/16 + IN 1888/19', false)
on conflict (year) do nothing;
