-- ============================================================================
-- Finanças — IR completo (5 sprints consolidados)
-- ============================================================================
-- Sprint 1: fontes pagadoras (CLT/PJ realista)
-- Sprint 2: pagamentos dedutíveis automáticos + catálogo CNPJ
-- Sprint 3: opções + calculadora de venda + day trade auto-detect
-- Sprint 4: investimentos exterior + cripto separados + carnê-leão mensal
-- Sprint 5: email notifications log + anotações do contador + uploads
-- ============================================================================

set search_path = public;

-- ============================================================================
-- SPRINT 1: fontes_pagadoras
-- ============================================================================
create table public.fontes_pagadoras (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  /** CLT / pj_propria / pj_outros / aluguel / pensao / aposentadoria / outra */
  type text not null check (type in (
    'clt', 'pj_propria', 'pj_outros', 'aluguel', 'pensao',
    'aposentadoria', 'bolsa', 'outra'
  )),
  name text not null,
  cnpj text,
  cpf text, -- pra fontes PF (locador, etc.)
  /** Apenas pra pj_propria do usuário */
  regime_tributario text check (regime_tributario in (
    'mei', 'simples_nacional', 'lucro_presumido', 'lucro_real'
  )),
  /** IRRF default (%) — quando aplicável (CLT calcula automatico tabela progressiva) */
  default_irrf_rate numeric(6, 4),
  /** INSS default (%) — opcional */
  default_inss_rate numeric(6, 4),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fontes_pagadoras_household_idx on public.fontes_pagadoras(household_id);

alter table public.fontes_pagadoras enable row level security;

create policy "fontes_pagadoras: household members"
  on public.fontes_pagadoras for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "fontes_pagadoras: accountant read"
  on public.fontes_pagadoras for select to authenticated
  using (public.is_accountant_with_access(household_id));

create trigger fontes_pagadoras_set_updated_at
  before update on public.fontes_pagadoras
  for each row execute function public.tg_set_updated_at();

-- Liga income transactions e ir_other_incomes em fontes pagadoras
alter table public.transactions
  add column fonte_pagadora_id uuid references public.fontes_pagadoras(id) on delete set null,
  add column irrf_amount numeric(14, 2),
  add column inss_amount numeric(14, 2);

create index transactions_fonte_idx on public.transactions(fonte_pagadora_id)
  where fonte_pagadora_id is not null;

alter table public.ir_other_incomes
  add column fonte_pagadora_id uuid references public.fontes_pagadoras(id) on delete set null;


-- ============================================================================
-- SPRINT 2: dedutíveis automáticos
-- ============================================================================
-- Categorias podem ser marcadas como dedutíveis padrão
alter table public.categories
  add column ir_deductible_kind text;

comment on column public.categories.ir_deductible_kind is
  'Quando o user lança uma despesa nesta categoria, ela é candidata a virar
   pagamento dedutível IR. Valores: plano_saude, medico, dentista, educacao_titular, etc.';

-- Subscriptions também
alter table public.subscriptions
  add column ir_deductible_kind text,
  add column is_tax_deductible boolean not null default false;

-- Liga transactions a pagamentos dedutíveis (referência cruzada)
alter table public.ir_deductible_payments
  add column transaction_id uuid references public.transactions(id) on delete set null,
  add column subscription_id uuid references public.subscriptions(id) on delete set null,
  add column auto_imported boolean not null default false;

create index ir_deductible_payments_transaction_idx
  on public.ir_deductible_payments(transaction_id)
  where transaction_id is not null;

-- Catálogo de instituições conhecidas (CNPJ → tipo dedutível)
create table public.known_institutions (
  id serial primary key,
  cnpj text not null,
  name text not null,
  name_patterns text[] not null default '{}'::text[],
  /** Tipo dedutível default ao reconhecer essa instituição */
  ir_deductible_kind text,
  /** Tipo da instituição: insurance, hospital, school, broker, bank, etc */
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index known_institutions_cnpj_idx on public.known_institutions(cnpj);
create index known_institutions_kind_idx on public.known_institutions(ir_deductible_kind)
  where ir_deductible_kind is not null;

-- Catálogo pode ser lido por qualquer authenticated user (tabela pública)
alter table public.known_institutions enable row level security;

create policy "known_institutions: anyone reads"
  on public.known_institutions for select to authenticated
  using (true);

-- Seed inicial — instituições mais comuns
insert into public.known_institutions (cnpj, name, name_patterns, ir_deductible_kind, category) values
  -- Planos de saúde
  ('92.693.118/0001-60', 'Unimed', ARRAY['unimed'], 'plano_saude', 'insurance'),
  ('60.872.504/0001-23', 'Bradesco Saúde', ARRAY['bradesco saude', 'bradesco saúde'], 'plano_saude', 'insurance'),
  ('29.470.166/0001-21', 'SulAmérica Saúde', ARRAY['sulamerica saude', 'sulamérica', 'sul america saude'], 'plano_saude', 'insurance'),
  ('29.309.127/0001-79', 'Amil Saúde', ARRAY['amil'], 'plano_saude', 'insurance'),
  ('05.197.443/0001-38', 'Hapvida', ARRAY['hapvida', 'notredame'], 'plano_saude', 'insurance'),
  ('33.555.665/0001-09', 'Notredame Intermédica', ARRAY['notredame intermedica', 'notredame'], 'plano_saude', 'insurance'),
  ('02.778.350/0001-72', 'Porto Seguro Saúde', ARRAY['porto saude', 'porto seguro saude'], 'plano_saude', 'insurance'),
  ('92.693.118/0001-60', 'Cassi', ARRAY['cassi'], 'plano_saude', 'insurance'),
  -- Hospitais
  ('60.726.847/0001-08', 'Hospital Israelita Albert Einstein', ARRAY['einstein', 'albert einstein'], 'hospital', 'hospital'),
  ('61.444.236/0001-50', 'Hospital Sírio-Libanês', ARRAY['sirio-libanes', 'sírio libanês', 'sirio libanes'], 'hospital', 'hospital'),
  ('60.884.855/0001-90', 'HCor', ARRAY['hcor', 'hospital do coracao'], 'hospital', 'hospital'),
  ('60.922.168/0001-09', 'Hospital Oswaldo Cruz', ARRAY['oswaldo cruz'], 'hospital', 'hospital'),
  ('33.892.501/0001-66', 'Rede D''Or São Luiz', ARRAY['rede d''or', 'sao luiz', 'rede dor'], 'hospital', 'hospital'),
  ('29.435.005/0001-22', 'Hospital 9 de Julho', ARRAY['9 de julho', 'nove de julho'], 'hospital', 'hospital'),
  -- Laboratórios
  ('17.220.997/0001-93', 'Fleury', ARRAY['fleury', 'lavoisier'], 'hospital', 'hospital'),
  ('61.486.650/0001-83', 'Dasa (Delboni, Alta, Salomão)', ARRAY['dasa', 'delboni', 'alta diagnosticos', 'salomao zoppi'], 'hospital', 'hospital'),
  ('60.872.504/0001-23', 'Sabin', ARRAY['sabin'], 'hospital', 'hospital'),
  -- INSS
  ('29.979.036/0001-40', 'INSS', ARRAY['inss', 'previdencia social'], 'inss_titular', 'government'),
  -- PGBL/Previdência
  ('33.485.541/0001-06', 'Brasilprev', ARRAY['brasilprev'], 'pgbl', 'pension'),
  ('60.872.504/0001-23', 'Bradesco Previdência', ARRAY['bradesco previdencia', 'bradesco prev'], 'pgbl', 'pension'),
  ('60.701.190/0001-04', 'Itaú Previdência', ARRAY['itau previdencia', 'itaú previdência'], 'pgbl', 'pension'),
  ('43.751.060/0001-25', 'Icatu Seguros', ARRAY['icatu'], 'pgbl', 'pension'),
  ('60.460.564/0001-78', 'Sulamérica Investimentos', ARRAY['sulamerica investimentos', 'sulamerica previdencia'], 'pgbl', 'pension'),
  ('60.872.504/0001-23', 'XP Previdência', ARRAY['xp previdencia', 'xp prev'], 'pgbl', 'pension');


-- ============================================================================
-- SPRINT 3: opções + calculadora de venda
-- ============================================================================
-- Permite asset_type='option' em investments
alter table public.investments
  drop constraint investments_asset_type_check;

alter table public.investments
  add constraint investments_asset_type_check check (asset_type in (
    'fii', 'fixed_income_public', 'fixed_income_private',
    'stock', 'etf', 'crypto', 'option'
  ));

-- Campos específicos pra opções
alter table public.investments
  add column option_type text check (option_type is null or option_type in ('call', 'put')),
  add column strike_price numeric(14, 4),
  add column expiry_date date,
  add column underlying_ticker text,
  add column series_code text,
  /** 'covered' (lançamento coberto) | 'naked' (descoberto) | 'long' (comprado) */
  add column option_position text check (option_position is null or option_position in ('covered', 'naked', 'long'));

-- Movement types: incluir exercise/assignment/expiration
alter table public.investment_movements
  drop constraint investment_movements_kind_check;

alter table public.investment_movements
  add constraint investment_movements_kind_check check (kind in (
    'buy', 'sell', 'dividend', 'split',
    'exercise', 'assignment', 'expiration'
  ));

-- Adiciona índice pra busca de movimentos no mesmo dia (day trade auto-detect)
create index if not exists investment_movements_same_day_idx
  on public.investment_movements(investment_id, date, kind);


-- ============================================================================
-- SPRINT 4: exterior + cripto + carnê-leão
-- ============================================================================
-- Marca ativo como sendo no exterior (Lei 14.754/2023)
alter table public.investments
  add column is_exterior boolean not null default false;

comment on column public.investments.is_exterior is
  'True quando custodiado em corretora estrangeira (Avenue, IBKR, etc.).
   Tributação anual única 15% pela Lei 14.754/2023 — separado do swing/day BR.';

-- Carnê-leão: DARFs mensais pra aluguel recebido, freelance PF, etc.
create table public.carne_leao_mensal (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  /** Tipo do rendimento: aluguel, freelance_pf, pensao_recebida, outros */
  kind text not null check (kind in (
    'aluguel', 'freelance_pf', 'pensao_recebida', 'exterior_trabalho', 'outros'
  )),
  description text not null,
  source_name text,
  source_cpf_cnpj text,
  gross_amount numeric(14, 2) not null check (gross_amount > 0),
  /** Despesas dedutíveis aceitas: condomínio, IPTU (pra aluguel) */
  deductible_expenses numeric(14, 2) not null default 0,
  taxable_base numeric(14, 2) not null default 0,
  tax_due numeric(14, 2) not null default 0,
  /** Vencimento DARF código 0190: último dia útil do mês seguinte */
  due_date date,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index carne_leao_household_year_idx
  on public.carne_leao_mensal(household_id, year, month);

alter table public.carne_leao_mensal enable row level security;

create policy "carne_leao: household members"
  on public.carne_leao_mensal for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "carne_leao: accountant read"
  on public.carne_leao_mensal for select to authenticated
  using (public.is_accountant_with_access(household_id, year));

create trigger carne_leao_set_updated_at
  before update on public.carne_leao_mensal
  for each row execute function public.tg_set_updated_at();

-- Expande DARF kinds pra incluir exterior/cripto
alter table public.ir_darfs
  drop constraint ir_darfs_kind_check;

alter table public.ir_darfs
  add constraint ir_darfs_kind_check check (kind in (
    'swing', 'day_trade', 'fii', 'exterior', 'crypto', 'options'
  ));

alter table public.ir_loss_carryforward
  drop constraint ir_loss_carryforward_kind_check;

alter table public.ir_loss_carryforward
  add constraint ir_loss_carryforward_kind_check check (kind in (
    'swing', 'day_trade', 'fii', 'exterior', 'crypto', 'options'
  ));


-- ============================================================================
-- SPRINT 5: email notifications log + anotações + uploads do contador
-- ============================================================================
-- Log de notificações enviadas (evita duplicação + audit)
create table public.email_notifications_log (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_user_id uuid,
  /** Tipo: accountant_invite | accountant_access | darf_due | onboarding | ... */
  notification_type text not null,
  subject text,
  status text not null check (status in ('queued', 'sent', 'failed')) default 'queued',
  related_household_id uuid references public.households(id) on delete set null,
  related_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_log_recipient_idx on public.email_notifications_log(recipient_email);
create index email_log_household_idx on public.email_notifications_log(related_household_id)
  where related_household_id is not null;
create index email_log_status_idx on public.email_notifications_log(status, created_at desc);

alter table public.email_notifications_log enable row level security;

-- Apenas leitura pelo destinatário/admin da plataforma — sem policies pra
-- inserção: insere via service role no API.
create policy "email_log: own household reads"
  on public.email_notifications_log for select to authenticated
  using (related_household_id = public.current_household_id());

-- Anotações do contador no IR do cliente
create table public.accountant_notes (
  id uuid primary key default gen_random_uuid(),
  accountant_id uuid not null references public.accountant_profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null,
  /** Onde a anotação se aplica: bens | rendimentos | renda_variavel | imposto | geral */
  section text not null check (section in (
    'bens', 'rendimentos', 'renda_variavel', 'imposto', 'pagamentos', 'geral'
  )),
  /** Estado: open | resolved */
  status text not null default 'open' check (status in ('open', 'resolved')),
  content text not null,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accountant_notes_household_idx
  on public.accountant_notes(household_id, year);
create index accountant_notes_status_idx
  on public.accountant_notes(household_id, status);

alter table public.accountant_notes enable row level security;

-- Contador cria/edita as suas anotações
create policy "notes: accountant self manage"
  on public.accountant_notes for all to authenticated
  using (accountant_id = auth.uid())
  with check (accountant_id = auth.uid());

-- Titular vê + pode marcar como resolved
create policy "notes: titular reads"
  on public.accountant_notes for select to authenticated
  using (household_id = public.current_household_id());

create policy "notes: titular resolves"
  on public.accountant_notes for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create trigger accountant_notes_set_updated_at
  before update on public.accountant_notes
  for each row execute function public.tg_set_updated_at();

-- Documentos enviados pelo contador pro cliente (TODO: usar Supabase Storage)
create table public.accountant_documents (
  id uuid primary key default gen_random_uuid(),
  accountant_id uuid not null references public.accountant_profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null,
  name text not null,
  /** Caminho no Supabase Storage. Vazio se ainda não upload concluído */
  storage_path text,
  mime_type text,
  size_bytes integer,
  notes text,
  uploaded_at timestamptz not null default now()
);

create index accountant_documents_household_idx
  on public.accountant_documents(household_id, year);

alter table public.accountant_documents enable row level security;

create policy "documents: accountant manages"
  on public.accountant_documents for all to authenticated
  using (accountant_id = auth.uid())
  with check (accountant_id = auth.uid());

create policy "documents: titular reads"
  on public.accountant_documents for select to authenticated
  using (household_id = public.current_household_id());


-- ============================================================================
-- HELPER: detecta day trade automaticamente
-- ============================================================================
-- Marca como day_trade=true quando há buy E sell do mesmo investment_id no mesmo date
create or replace function public.refresh_day_trade_flags(p_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  -- Acha pares (investment, date) com buy + sell no mesmo dia
  with day_trades as (
    select investment_id, date
      from public.investment_movements
      where household_id = p_household_id
        and kind in ('buy', 'sell')
      group by investment_id, date
      having count(distinct kind) = 2
  )
  update public.investment_movements im
    set is_day_trade = true
    where (im.investment_id, im.date) in (select investment_id, date from day_trades)
      and im.kind = 'sell'
      and im.is_day_trade = false;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.refresh_day_trade_flags(uuid) from public;
grant execute on function public.refresh_day_trade_flags(uuid) to authenticated;
