-- ============================================================================
-- Finanças — Cobertura dos gaps restantes do IRPF
--
-- 1) Dívidas e Ônus Reais (financiamento, empréstimo > R$ 5k)
-- 2) Isenção R$ 35k/mês pra venda de bens móveis
-- 3) Honorários advocatícios de pensão alimentícia recebida (dedutível)
-- 4) RRA — Rendimentos Recebidos Acumuladamente
-- 5) Carnê-Leão — cálculo automático aplicando tabela progressiva mensal
-- ============================================================================

set search_path = public;


-- ============================================================================
-- 1) DÍVIDAS E ÔNUS REAIS
-- Obrigatório declarar dívidas > R$ 5.000 em 31/12. Vai na ficha
-- "Dívidas e Ônus Reais" do programa IRPF (separada de Bens).
-- ============================================================================
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- Tipos comuns (códigos Receita são livres aqui — programa não tem código fixo)
  kind text not null check (kind in (
    'financiamento_imovel',     -- financiamento de imóvel residencial/comercial
    'financiamento_veiculo',    -- carro, moto
    'emprestimo_pessoal',       -- consignado, crédito pessoal, agiota
    'emprestimo_cheque_especial',
    'emprestimo_cartao_credito', -- saldo rotativo de cartão (raramente declarado)
    'emprestimo_pj',            -- pra/de PJ próprio
    'emprestimo_pessoa_fisica', -- emprestou ou pegou de outro PF
    'outros'
  )),
  description text not null,
  creditor_name text not null,
  creditor_cnpj_cpf text,
  original_amount numeric(14, 2) not null default 0,
  current_balance numeric(14, 2) not null default 0,
  currency text not null default 'BRL' check (currency in ('BRL', 'EUR', 'USD')),
  contract_date date,
  end_date date,
  interest_rate numeric(8, 4),  -- juros % a.a. (informativo)
  -- Vinculação opcional: dívida pode estar atrelada a um bem específico
  -- (ex.: financiamento ligado ao apartamento)
  physical_asset_id uuid references public.physical_assets(id) on delete set null,
  -- Couple support
  owner_filer_id uuid references public.ir_filers(id) on delete set null,
  is_particular boolean not null default false,
  particular_reason text check (particular_reason in (
    'pre_casamento', 'heranca', 'doacao', 'sub_rogacao', 'outros'
  )),
  ownership_percent numeric(5, 2),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index debts_household_idx on public.debts(household_id) where is_active;
create index debts_asset_idx on public.debts(physical_asset_id) where physical_asset_id is not null;
create index debts_owner_filer_idx on public.debts(owner_filer_id) where owner_filer_id is not null;

create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.tg_set_updated_at();

alter table public.debts enable row level security;

create policy "debts: full access within household"
  on public.debts for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

comment on table public.debts is
  'Dívidas e ônus reais — obrigatório declarar saldo em 31/12 quando > R$ 5k. '
  'Vai na ficha "Dívidas e Ônus Reais" do programa IRPF.';


-- ============================================================================
-- 2) Bens móveis — adicionar exemption_kind 'bem_movel_35k' (Lei 9.250/95 art. 22)
-- Vendas isoladas de bens móveis até R$ 35.000/mês são isentas de GCAP.
-- ============================================================================
alter table public.physical_asset_sales
  drop constraint if exists physical_asset_sales_exemption_kind_check;

alter table public.physical_asset_sales
  add constraint physical_asset_sales_exemption_kind_check check (exemption_kind in (
    'unico_imovel_440k',
    'reaplicacao_residencial',
    'desapropriacao',
    'permuta_sem_torna',
    'bem_movel_35k',        -- NOVO
    'isencao_acoes_20k',    -- bônus: extensão pra ações em pequeno volume (na vdd vai pra renda variável)
    'none'
  ));

comment on column public.physical_asset_sales.exemption_kind is
  'Isenção aplicável. bem_movel_35k = Lei 9.250/95 art. 22 (vendas ≤ R$ 35k/mês).';


-- ============================================================================
-- 3) Honorários advocatícios de pensão alimentícia
-- IN RFB 1.500/14 art. 18 — honorários pagos pra obter/manter pensão
-- alimentícia recebida são dedutíveis.
-- ============================================================================
alter table public.ir_deductible_payments
  drop constraint if exists ir_deductible_payments_kind_check;

alter table public.ir_deductible_payments
  add constraint ir_deductible_payments_kind_check check (kind in (
    'plano_saude', 'hospital', 'medico', 'dentista', 'psicologo', 'outros_saude',
    'educacao_titular', 'educacao_dependente',
    'inss_titular', 'inss_domestico', 'pgbl', 'previdencia_privada',
    'pensao_alimenticia',
    'honorarios_advocaticios_pensao',  -- NOVO
    'doacao_eca', 'doacao_cultural',
    'outros'
  ));


-- ============================================================================
-- 4) RRA — Rendimentos Recebidos Acumuladamente
-- Quando o user recebe atrasados (judicial, FGTS, etc.) referente a vários
-- meses, ele PODE escolher tributar pelo método mensal (aplicar tabela ao
-- valor médio mensal) ou anual (regra padrão).
-- ============================================================================
alter table public.ir_other_incomes
  add column if not exists rra_taxable_method text
    check (rra_taxable_method is null or rra_taxable_method in ('mensal', 'anual')),
  add column if not exists rra_competence_months integer
    check (rra_competence_months is null or rra_competence_months between 1 and 240),
  add column if not exists rra_juros numeric(14, 2),  -- juros recebidos (isento se acessório)
  add column if not exists rra_honorarios numeric(14, 2); -- honorários advocatícios dedutíveis

comment on column public.ir_other_incomes.rra_taxable_method is
  'Método de tributação RRA. mensal = aplica tabela ao valor/mês (geralmente melhor). '
  'anual = tributa tudo no ano. Só relevante se category = rendimento_acumulado.';
comment on column public.ir_other_incomes.rra_competence_months is
  'Quantidade de meses retroativos cobertos pelo pagamento (denominador no método mensal).';


-- ============================================================================
-- 5) Carnê-Leão — já existe schema; aqui só garantimos coluna
-- pra distinguir "imposto calculado pelo app" vs "imposto declarado pelo user".
-- ============================================================================
alter table public.carne_leao_mensal
  add column if not exists tax_computed_by_app boolean not null default false,
  add column if not exists computation_breakdown jsonb;

comment on column public.carne_leao_mensal.computation_breakdown is
  'JSON com detalhamento do cálculo (renda bruta, deduções aplicadas, faixa de imposto).';
