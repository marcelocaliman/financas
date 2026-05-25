-- ============================================================================
-- Finanças — Cobertura dos gaps do IRPF
--
-- 1) PGBL / VGBL como asset_type (códigos Receita 91/92)
-- 2) Snapshots 31/12 do ano anterior (fluxo manual)
-- 3) Vendas de imóvel (ganho de capital)
-- 4) Atualização de valor de imóvel (Lei 14.973/2024)
-- 5) Anexos de recibos (saúde/educação) — usando metadata pra path no Storage
-- ============================================================================

set search_path = public;


-- ============================================================================
-- 1) PGBL / VGBL como asset_type
-- ============================================================================
alter table public.investments
  drop constraint if exists investments_asset_type_check;

alter table public.investments
  add constraint investments_asset_type_check check (asset_type in (
    'fii', 'fixed_income_public', 'fixed_income_private',
    'stock', 'etf', 'crypto', 'option',
    'pgbl', 'vgbl'
  ));

comment on column public.investments.asset_type is
  'Classe do ativo. PGBL/VGBL são previdência: PGBL tem dedução de até 12% '
  'da renda tributável (model completo); VGBL não deduz mas tributa só o '
  'rendimento no resgate.';


-- ============================================================================
-- 2) Snapshots 31/12 do ano-base anterior — fluxo manual
-- Quando o user só começa a usar o app mid-year, a "Situação em 31/12" do
-- ano anterior fica em branco no relatório de Bens. Esta tabela permite
-- preencher manualmente esses valores históricos.
-- ============================================================================
create table if not exists public.ir_prior_year_balances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  -- Liga a UM dos 3 tipos de bem (xor obrigatório)
  account_id uuid references public.accounts(id) on delete cascade,
  investment_id uuid references public.investments(id) on delete cascade,
  physical_asset_id uuid references public.physical_assets(id) on delete cascade,
  -- Valor em 31/12/year (BRL convertido se ativo estrangeiro)
  balance numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 1 e exatamente 1 dos 3 FKs deve ser preenchido
  constraint ir_prior_year_xor check (
    (case when account_id is not null then 1 else 0 end) +
    (case when investment_id is not null then 1 else 0 end) +
    (case when physical_asset_id is not null then 1 else 0 end) = 1
  )
);

-- Um bem só pode ter 1 entry por ano
create unique index ir_prior_year_account_uniq
  on public.ir_prior_year_balances(account_id, year) where account_id is not null;
create unique index ir_prior_year_investment_uniq
  on public.ir_prior_year_balances(investment_id, year) where investment_id is not null;
create unique index ir_prior_year_physical_uniq
  on public.ir_prior_year_balances(physical_asset_id, year) where physical_asset_id is not null;

create index ir_prior_year_household_year_idx
  on public.ir_prior_year_balances(household_id, year);

create trigger ir_prior_year_balances_set_updated_at
  before update on public.ir_prior_year_balances
  for each row execute function public.tg_set_updated_at();

alter table public.ir_prior_year_balances enable row level security;

create policy "ir_prior_year_balances: full access within household"
  on public.ir_prior_year_balances for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

comment on table public.ir_prior_year_balances is
  'Saldos manuais em 31/12 do ano N pra preencher coluna "Situação anterior" '
  'no relatório de Bens. Usado quando o user começa a usar o app mid-year.';


-- ============================================================================
-- 3) Vendas de imóvel — ganho de capital (GCAP)
-- Quando o user vende um physical_asset (real_estate principalmente),
-- gera-se a obrigação de calcular GCAP e gerar DARF.
--
-- Regras (Lei 7.713/88 + Lei 11.196/05):
--   - Lucro = preço de venda - custo de aquisição
--   - Tributação 15% sobre o lucro (faixa progressiva acima de R$ 5M)
--   - Isenção: imóvel residencial < R$ 440k se único do contribuinte
--   - Isenção: usar todo o produto para comprar outro residencial em 180 dias
--   - Redução: fator de redução por tempo de posse (FR1 e FR2)
-- ============================================================================
create table if not exists public.physical_asset_sales (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  physical_asset_id uuid not null references public.physical_assets(id) on delete cascade,
  sale_date date not null,
  sale_price numeric(14, 2) not null check (sale_price > 0),
  -- Custo de aquisição em BRL (snapshot na data da venda — pode diferir
  -- do acquired_value original em casos de doação/herança/sub-rogação)
  acquisition_cost numeric(14, 2) not null check (acquisition_cost >= 0),
  -- Lucro bruto (preço - custo, sem redução de fator de tempo)
  gross_profit numeric(14, 2) not null,
  -- Fatores de redução aplicáveis (Lei 11.196/05)
  reduction_factor_pre_88 numeric(10, 6),  -- bens adquiridos antes de 1988
  reduction_factor_96_05 numeric(10, 6),   -- ganhos entre 1996 e 2005
  -- Lucro líquido após reduções
  taxable_profit numeric(14, 2) not null,
  -- Imposto devido (15% padrão; 17.5%/20%/22.5% nas faixas acima de R$ 5M)
  tax_due numeric(14, 2) not null default 0,
  -- Isenções aplicadas
  exemption_kind text check (exemption_kind in (
    'unico_imovel_440k',     -- imóvel residencial único < R$ 440k
    'reaplicacao_residencial', -- 180 dias pra comprar outro residencial
    'desapropriacao',
    'permuta_sem_torna',
    'none'
  )) default 'none',
  exemption_notes text,
  -- DARF gerado
  darf_due_date date,
  darf_paid_at date,
  darf_payment_reference text,
  -- Atribuição filer (declaração separada)
  filer_id uuid references public.ir_filers(id) on delete set null,
  -- Metadados livres
  buyer_name text,
  buyer_cpf_cnpj text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index physical_asset_sales_household_year_idx
  on public.physical_asset_sales(household_id, sale_date);

create trigger physical_asset_sales_set_updated_at
  before update on public.physical_asset_sales
  for each row execute function public.tg_set_updated_at();

alter table public.physical_asset_sales enable row level security;

create policy "physical_asset_sales: full access within household"
  on public.physical_asset_sales for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

comment on table public.physical_asset_sales is
  'Venda de bem físico — gera ganho de capital pra declaração IR. '
  'Cálculo segue Lei 7.713/88 + Lei 11.196/05 (fatores de redução).';


-- ============================================================================
-- 4) Atualização de valor de imóvel — Lei 14.973/2024
-- Permite atualizar o valor de imóveis pra preço de mercado pagando 4%
-- (PF) sobre a diferença, gerando GCAP reduzido em venda futura.
-- ============================================================================
create table if not exists public.physical_asset_revaluations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  physical_asset_id uuid not null references public.physical_assets(id) on delete cascade,
  revaluation_date date not null,
  -- Valor declarado anteriormente (snapshot na data)
  previous_value numeric(14, 2) not null,
  -- Novo valor a mercado
  new_value numeric(14, 2) not null check (new_value > 0),
  difference numeric(14, 2) not null,
  -- Imposto pago (4% PF, 6% PJ na regra atual)
  tax_rate numeric(5, 4) not null default 0.04,
  tax_paid numeric(14, 2) not null,
  darf_paid_at date,
  darf_payment_reference text,
  filer_id uuid references public.ir_filers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index physical_asset_revaluations_asset_idx
  on public.physical_asset_revaluations(physical_asset_id);

create trigger physical_asset_revaluations_set_updated_at
  before update on public.physical_asset_revaluations
  for each row execute function public.tg_set_updated_at();

alter table public.physical_asset_revaluations enable row level security;

create policy "physical_asset_revaluations: full access within household"
  on public.physical_asset_revaluations for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

comment on table public.physical_asset_revaluations is
  'Atualização de valor de imóvel pra mercado (Lei 14.973/2024). '
  'Paga DARF 4% sobre o ganho na hora — reduz GCAP futuro.';


-- ============================================================================
-- 5) Anexos de recibos em ir_deductible_payments
-- Storage path (Supabase Storage bucket "ir-receipts"); validação de existência
-- fica no client. Aqui só guardamos o path e mime.
-- ============================================================================
alter table public.ir_deductible_payments
  add column if not exists receipt_storage_path text,
  add column if not exists receipt_mime_type text,
  add column if not exists receipt_size_bytes integer,
  add column if not exists receipt_uploaded_at timestamptz;

comment on column public.ir_deductible_payments.receipt_storage_path is
  'Path no Supabase Storage (bucket "ir-receipts"). Importante pra defesa '
  'em caso de malha fiscal — Receita pode pedir recibo até 5 anos depois.';
