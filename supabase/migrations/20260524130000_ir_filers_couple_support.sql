-- ============================================================================
-- Finanças — Suporte a declaração de IRPF em casal (separada ou conjunta)
--
-- Modelo:
--   - 1 household pode ter N "ir_filers" (declarantes)
--   - Filer com user_id NOT NULL = titular com login (você)
--   - Filer com user_id NULL    = perfil sombra (esposa, sem login)
--   - Regime de bens em ir_settings define o split automático
--
-- Tudo retrocompatível: se há só 1 filer, comporta-se como antes (visão única).
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1) ir_filers — declarantes do household
-- ============================================================================
create table public.ir_filers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- NULL = perfil sombra (sem login próprio)
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  cpf text not null,
  birth_date date,
  occupation text,
  occupation_code text,
  nature_of_occupation text,
  voter_id text,
  -- Titular principal — geralmente quem tem o login
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- CPF só dígitos, 11 caracteres
  constraint ir_filers_cpf_format check (length(regexp_replace(cpf, '\D', '', 'g')) = 11)
);

-- 1 CPF único por household (não pode ter 2 filers com mesmo CPF)
create unique index ir_filers_household_cpf_uniq on public.ir_filers(household_id, cpf);
create index ir_filers_household_idx on public.ir_filers(household_id) where is_active;
-- Garante 1 primário ativo por household
create unique index ir_filers_household_primary_uniq
  on public.ir_filers(household_id)
  where is_primary and is_active;

create trigger ir_filers_set_updated_at
  before update on public.ir_filers
  for each row execute function public.tg_set_updated_at();

alter table public.ir_filers enable row level security;

create policy "ir_filers: full access within household"
  on public.ir_filers for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

comment on table public.ir_filers is
  'Declarantes do IRPF por household. Suporta perfil sombra (user_id NULL) '
  'pra casais onde só um lado tem login.';


-- ============================================================================
-- 2) ir_settings — regime de bens + estratégia de declaração
-- ============================================================================
alter table public.ir_settings
  add column if not exists marriage_regime text
    check (marriage_regime in (
      'solteiro',
      'comunhao_parcial',
      'comunhao_universal',
      'separacao_total',
      'separacao_obrigatoria',
      'participacao_final_aquestos'
    )) default 'solteiro',
  add column if not exists marriage_date date,
  -- Estratégia preferida para a declaração: separada / conjunta / decide automático (comparador)
  add column if not exists declaration_strategy text
    check (declaration_strategy in ('separada', 'conjunta', 'auto')) default 'auto',
  -- Como dividir bens comuns entre declarações separadas
  add column if not exists common_assets_strategy text
    check (common_assets_strategy in ('split_50_50', 'all_in_primary', 'all_in_secondary')) default 'split_50_50';

comment on column public.ir_settings.marriage_regime is
  'Regime de bens do titular. Define split automático em bens comuns.';
comment on column public.ir_settings.marriage_date is
  'Data do casamento. Importante na comunhão parcial: bens pré-casamento são individuais.';


-- ============================================================================
-- 3) Atribuição em accounts / investments / physical_assets
--    Bens podem ser comuns (split por regime) ou particulares (100% do dono).
-- ============================================================================
alter table public.accounts
  add column if not exists owner_filer_id uuid references public.ir_filers(id) on delete set null,
  add column if not exists is_particular boolean not null default false,
  add column if not exists particular_reason text
    check (particular_reason in ('pre_casamento', 'heranca', 'doacao', 'sub_rogacao', 'outros')),
  add column if not exists ownership_percent numeric(5, 2);

alter table public.investments
  add column if not exists owner_filer_id uuid references public.ir_filers(id) on delete set null,
  add column if not exists is_particular boolean not null default false,
  add column if not exists particular_reason text
    check (particular_reason in ('pre_casamento', 'heranca', 'doacao', 'sub_rogacao', 'outros')),
  add column if not exists ownership_percent numeric(5, 2);

alter table public.physical_assets
  add column if not exists owner_filer_id uuid references public.ir_filers(id) on delete set null,
  add column if not exists is_particular boolean not null default false,
  add column if not exists particular_reason text
    check (particular_reason in ('pre_casamento', 'heranca', 'doacao', 'sub_rogacao', 'outros'));
-- physical_assets.ownership_percent já existia na migration anterior


-- ============================================================================
-- 4) Atribuição em tabelas individuais (rendimentos, deduções, dependentes)
--    Aqui não tem regime de bens — sempre vinculado a 1 filer só.
-- ============================================================================
alter table public.ir_other_incomes
  add column if not exists owner_filer_id uuid references public.ir_filers(id) on delete set null;

alter table public.ir_deductible_payments
  add column if not exists owner_filer_id uuid references public.ir_filers(id) on delete set null;

alter table public.ir_dependents
  add column if not exists belongs_to_filer_id uuid references public.ir_filers(id) on delete set null;

-- Carnê-Leão e DARFs são por CPF
alter table public.ir_darfs
  add column if not exists filer_id uuid references public.ir_filers(id) on delete set null;

alter table public.ir_loss_carryforward
  add column if not exists filer_id uuid references public.ir_filers(id) on delete set null;

alter table public.carne_leao_mensal
  add column if not exists filer_id uuid references public.ir_filers(id) on delete set null;


-- ============================================================================
-- 5) Backfill — cria filer primário pra cada household e atribui tudo a ele
-- ============================================================================

-- 5.1 Cria 1 filer primário pra cada household que ainda não tenha nenhum
insert into public.ir_filers (household_id, user_id, full_name, cpf, is_primary)
select
  h.id as household_id,
  -- titular_user_id se existir; senão pega o primeiro user do household
  coalesce(s.titular_user_id, (select id from public.users where household_id = h.id order by created_at limit 1)) as user_id,
  -- nome: display_name do user
  coalesce(
    (select display_name from public.users where id = coalesce(s.titular_user_id, (select id from public.users where household_id = h.id order by created_at limit 1))),
    'Titular'
  ) as full_name,
  -- CPF do settings ou placeholder (vai precisar editar) — 11 zeros é inválido então usamos um placeholder que passa a regex
  coalesce(nullif(regexp_replace(coalesce(s.cpf_titular, ''), '\D', '', 'g'), ''), '00000000000') as cpf,
  true as is_primary
from public.households h
left join public.ir_settings s on s.household_id = h.id
where not exists (
  select 1 from public.ir_filers f where f.household_id = h.id
);

-- 5.2 Atribui todos os bens existentes ao filer primário do household
update public.accounts a
   set owner_filer_id = (select id from public.ir_filers where household_id = a.household_id and is_primary)
 where a.owner_filer_id is null;

update public.investments i
   set owner_filer_id = (select id from public.ir_filers where household_id = i.household_id and is_primary)
 where i.owner_filer_id is null;

update public.physical_assets p
   set owner_filer_id = (select id from public.ir_filers where household_id = p.household_id and is_primary)
 where p.owner_filer_id is null;

update public.ir_other_incomes x
   set owner_filer_id = (select id from public.ir_filers where household_id = x.household_id and is_primary)
 where x.owner_filer_id is null;

update public.ir_deductible_payments x
   set owner_filer_id = (select id from public.ir_filers where household_id = x.household_id and is_primary)
 where x.owner_filer_id is null;

update public.ir_dependents x
   set belongs_to_filer_id = (select id from public.ir_filers where household_id = x.household_id and is_primary)
 where x.belongs_to_filer_id is null;

update public.ir_darfs x
   set filer_id = (select id from public.ir_filers where household_id = x.household_id and is_primary)
 where x.filer_id is null;

update public.ir_loss_carryforward x
   set filer_id = (select id from public.ir_filers where household_id = x.household_id and is_primary)
 where x.filer_id is null;

update public.carne_leao_mensal x
   set filer_id = (select id from public.ir_filers where household_id = x.household_id and is_primary)
 where x.filer_id is null;


-- ============================================================================
-- 6) Comments — documentação inline pra clarear semântica
-- ============================================================================
comment on column public.accounts.owner_filer_id is
  'Filer titular da conta. Bens comuns são divididos via regime + ownership_percent.';
comment on column public.accounts.is_particular is
  'TRUE = bem 100% do owner mesmo em regime de comunhão (herança, doação, prévio).';
comment on column public.accounts.ownership_percent is
  'Override do split automático. Ex.: 50 em conta conjunta. NULL = usa regra do regime.';
