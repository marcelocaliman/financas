-- ============================================================================
-- Finanças — Imposto de Renda (Pessoa Física, Brasil)
-- ============================================================================
-- Estrutura completa pra preparação da declaração anual de IRPF.
-- Não transmite à Receita (não há API pública) — gera relatórios espelhados
-- nas seções do programa IRPF + arquivo .DEC de importação parcial + DARFs
-- mensais de renda variável.
--
-- Carryover: dados do ano-base anterior podem ser puxados automaticamente
-- pra reduzir digitação no ano corrente.
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1) Enriquecimento dos schemas existentes pra produzir output Receita-friendly
-- ============================================================================

-- accounts: precisa de CNPJ da instituição + agência/conta pra discriminação
-- exata na seção "Bens e Direitos" (códigos 41 poupança / 61 conta corrente).
alter table public.accounts
  add column cnpj text,
  add column agency text,
  add column account_number text;

comment on column public.accounts.cnpj is
  'CNPJ da instituição financeira (formato livre — só números ou com pontuação).
   Usado pra preencher Bens e Direitos na declaração IRPF.';

-- investments: CNPJ do emissor/corretora + override opcional do código Receita
-- (a inferência automática cobre os tipos comuns; campo serve pra casos atípicos).
alter table public.investments
  add column cnpj text,
  add column receita_code text;

comment on column public.investments.cnpj is
  'CNPJ do emissor do título (CDB → banco; ações → empresa). Pode ficar vazio.';
comment on column public.investments.receita_code is
  'Código do bem na Receita (31/41/47/73 etc). Se NULL, inferido pelo asset_type.';

-- physical_assets: discriminação extra pra imóveis (matrícula) e veículos (placa).
alter table public.physical_assets
  add column receita_code text,
  add column registration_number text, -- matrícula do imóvel, RENAVAM/placa do veículo
  add column address text;             -- endereço (imóveis)

-- investment_movements: marcar operações de day trade (alíquota e cálculo diferentes)
alter table public.investment_movements
  add column is_day_trade boolean not null default false;

comment on column public.investment_movements.is_day_trade is
  'Marca a operação como day trade (compra e venda no MESMO dia).
   Day trade tem alíquota 20% (vs 15% swing), apuração separada e SEM isenção
   dos R$ 20k/mês.';


-- ============================================================================
-- 2) ir_settings — uma linha por household. Preferências do IR.
-- ============================================================================
create table public.ir_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  -- Modelo de tributação preferido pra IR (compara automático)
  preferred_model text not null default 'auto'
    check (preferred_model in ('simples', 'completo', 'auto')),
  -- Quem é o titular pra fins de IR (caso casal declare separado)
  titular_user_id uuid references public.users(id),
  cpf_titular text,
  -- Último ano de exercício importado/preparado
  last_year_prepared integer,
  updated_at timestamptz not null default now()
);

alter table public.ir_settings enable row level security;

create policy "ir_settings: full access within household"
  on public.ir_settings for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- 3) ir_dependents — dependentes pra dedução (R$ 2.275,08 por dependente em 2025)
-- ============================================================================
create table public.ir_dependents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  cpf text,
  birth_date date,
  -- Códigos Receita 21/22/23/...
  relationship text not null check (relationship in (
    'conjuge', 'companheiro', 'filho', 'filha', 'enteado',
    'pais', 'avos', 'irmaos', 'menor_guarda', 'outros'
  )),
  -- Se o dependente é incluído na declaração (gera dedução E exige renda agregada)
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ir_dependents_household_idx on public.ir_dependents(household_id);

alter table public.ir_dependents enable row level security;

create policy "ir_dependents: full access within household"
  on public.ir_dependents for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- 4) ir_deductible_payments — Pagamentos efetuados (Saúde, Educação, INSS, PGBL)
-- ============================================================================
create table public.ir_deductible_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null,
  -- Códigos da seção "Pagamentos Efetuados" do IRPF
  -- 10=plano_saude  11=hospital  12=medico  13=dentista  17=psicologo  21=educacao
  -- 50=PGBL  43=previdencia_privada  41=INSS_titular  44=INSS_empregado
  -- 99=outros_deducao  60=advocaticios_pensao
  kind text not null check (kind in (
    'plano_saude', 'hospital', 'medico', 'dentista', 'psicologo', 'outros_saude',
    'educacao_titular', 'educacao_dependente',
    'inss_titular', 'inss_domestico', 'pgbl', 'previdencia_privada',
    'pensao_alimenticia', 'doacao_eca', 'doacao_cultural', 'outros'
  )),
  description text not null,
  recipient_name text not null,
  recipient_cnpj_cpf text,
  beneficiary text, -- nome do dependente atendido (saúde, educação)
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'BRL' check (currency in ('BRL', 'EUR', 'USD')),
  payment_date date,
  -- Se o gasto cai como dedução do "Carnê-leão" do ano OU como dedução da declaração
  is_dependent_payment boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ir_deductible_payments_household_year_idx
  on public.ir_deductible_payments(household_id, year);

alter table public.ir_deductible_payments enable row level security;

create policy "ir_deductible_payments: full access within household"
  on public.ir_deductible_payments for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- 5) ir_other_incomes — rendimentos NÃO derivados de movimentos no app
-- (ex.: salário CLT que cai em conta fora do app, freelance esporádico,
--  PGBL/VGBL resgatado, etc.). Permite o usuário inserir manualmente o que
--  está no informe da fonte pagadora.
-- ============================================================================
create table public.ir_other_incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null,
  -- Onde entra na declaração
  category text not null check (category in (
    'tributavel_pj',      -- salário, pró-labore, aposentadoria PJ
    'tributavel_pf',      -- aluguel recebido, pensão recebida — carnê-leão
    'isento',             -- LCI/LCA externos, dividendos, ganhos isentos
    'exclusivo_fonte',    -- 13o, PLR, JCP, aplicações RF (já tributado)
    'rendimento_acumulado' -- RRA (rendimentos recebidos acumuladamente)
  )),
  description text not null,
  source_name text not null,
  source_cnpj_cpf text,
  gross_amount numeric(14, 2) not null check (gross_amount > 0),
  irrf_amount numeric(14, 2) not null default 0,
  inss_amount numeric(14, 2) not null default 0,
  thirteenth_amount numeric(14, 2) not null default 0,
  currency text not null default 'BRL' check (currency in ('BRL', 'EUR', 'USD')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ir_other_incomes_household_year_idx
  on public.ir_other_incomes(household_id, year);

alter table public.ir_other_incomes enable row level security;

create policy "ir_other_incomes: full access within household"
  on public.ir_other_incomes for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- 6) ir_darfs — DARFs gerados mensalmente pra renda variável
-- ============================================================================
create table public.ir_darfs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  kind text not null check (kind in ('swing', 'day_trade', 'fii')),
  -- Vendas totais do mês (pra checar isenção 20k swing)
  gross_sales numeric(14, 2) not null default 0,
  -- Lucro bruto do mês (antes de compensação)
  gross_profit numeric(14, 2) not null default 0,
  -- Prejuízo do mês (se houver)
  monthly_loss numeric(14, 2) not null default 0,
  -- Prejuízo de meses anteriores usado pra compensar este mês
  loss_carryforward_used numeric(14, 2) not null default 0,
  -- Base de cálculo (lucro - compensação)
  taxable_base numeric(14, 2) not null default 0,
  -- IRRF já retido na fonte (0.005% swing, 1% day trade)
  irrf_retained numeric(14, 2) not null default 0,
  -- Imposto devido (15% swing, 20% day, 20% FII) - IRRF
  tax_due numeric(14, 2) not null default 0,
  is_exempt boolean not null default false, -- swing vendas mensais < R$ 20k = isento
  -- Status do pagamento
  paid_at timestamptz,
  payment_reference text, -- número de comprovante / pix
  generated_at timestamptz not null default now(),
  unique (household_id, year, month, kind)
);

create index ir_darfs_household_year_idx
  on public.ir_darfs(household_id, year);

alter table public.ir_darfs enable row level security;

create policy "ir_darfs: full access within household"
  on public.ir_darfs for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- 7) ir_loss_carryforward — saldo de prejuízo acumulado por tipo
-- (pode compensar lucros futuros indefinidamente)
-- ============================================================================
create table public.ir_loss_carryforward (
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('swing', 'day_trade', 'fii')),
  balance numeric(14, 2) not null default 0,
  last_updated_year integer,
  last_updated_month integer,
  updated_at timestamptz not null default now(),
  primary key (household_id, kind)
);

alter table public.ir_loss_carryforward enable row level security;

create policy "ir_loss_carryforward: full access within household"
  on public.ir_loss_carryforward for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- 8) ir_year_snapshots — fotografia da declaração de um ano-base
-- Permite carryover automático ("situação em 31/12 do ano N-1").
-- Gerado quando o usuário "fecha" a declaração de um ano.
-- ============================================================================
create table public.ir_year_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null,
  -- Snapshot completo dos bens declarados (formato Receita)
  bens jsonb not null default '[]'::jsonb,
  -- Snapshot dos totais
  totals jsonb not null default '{}'::jsonb,
  closed_at timestamptz not null default now(),
  unique (household_id, year)
);

alter table public.ir_year_snapshots enable row level security;

create policy "ir_year_snapshots: full access within household"
  on public.ir_year_snapshots for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- TRIGGERS pra updated_at automático
-- ============================================================================
create trigger ir_settings_set_updated_at
  before update on public.ir_settings
  for each row execute function public.tg_set_updated_at();
create trigger ir_dependents_set_updated_at
  before update on public.ir_dependents
  for each row execute function public.tg_set_updated_at();
create trigger ir_deductible_payments_set_updated_at
  before update on public.ir_deductible_payments
  for each row execute function public.tg_set_updated_at();
create trigger ir_other_incomes_set_updated_at
  before update on public.ir_other_incomes
  for each row execute function public.tg_set_updated_at();
create trigger ir_loss_carryforward_set_updated_at
  before update on public.ir_loss_carryforward
  for each row execute function public.tg_set_updated_at();
