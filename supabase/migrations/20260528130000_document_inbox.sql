-- ============================================================================
-- Document Inbox — upload + extração via IA + confirmação manual
--
-- Modelo de uso:
--   1. User dropa arquivo (PDF/imagem/CSV) em /inbox
--   2. Sistema salva em storage + cria row em document_uploads (status=pending)
--   3. Pipeline server chama OpenAI, extrai dados estruturados conforme o tipo
--      detectado, salva em extracted_data, marca status=review
--   4. User abre a review, edita se necessário, confirma
--   5. Sistema aplica os dados nas tabelas reais (transactions, ir_other_incomes,
--      investment_movements, ir_deductible_payments conforme o tipo) e marca
--      status=confirmed
--
-- Hard limits:
--   - Tamanho de arquivo: 15 MB
--   - Documentos por household por mês: 100 (enforced em camada de aplicação)
-- ============================================================================

set search_path = public;

-- ============================================================================
-- Bucket: inbox-documents
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inbox-documents',
  'inbox-documents',
  false,
  15 * 1024 * 1024,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'text/csv', 'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Path convention: <household_id>/<year>/<month>/<uuid>-<filename>
create policy "inbox-documents: read own household"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inbox-documents'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy "inbox-documents: upload own household"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inbox-documents'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy "inbox-documents: delete own household"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inbox-documents'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

-- ============================================================================
-- Tabela: document_uploads
-- ============================================================================
create table public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete set null,

  -- Arquivo
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  file_hash text, -- SHA-256 do conteúdo, pra detectar dup-upload

  -- Tipo detectado pela IA (null enquanto não processou)
  detected_type text check (detected_type in (
    'fatura_cartao', 'holerite', 'nota_corretagem',
    'recibo_medico', 'boleto', 'extrato_bancario', 'outros', null
  )),

  -- Status do fluxo
  status text not null default 'pending' check (status in (
    'pending',     -- recém-uploaded, esperando processamento
    'extracting',  -- chamada pra OpenAI em andamento
    'review',      -- extração ok, esperando confirmação humana
    'confirmed',   -- user confirmou e dados foram aplicados nas tabelas
    'discarded',   -- user descartou
    'error'        -- falha na extração
  )),

  -- Dados extraídos pela IA (forma depende de detected_type)
  extracted_data jsonb,
  -- Edições manuais do user antes de confirmar (mesma forma do extracted_data)
  reviewed_data jsonb,

  -- Tracking de custo OpenAI
  openai_model text,
  openai_input_tokens integer,
  openai_output_tokens integer,
  openai_cost_cents integer,
  openai_request_id text,

  -- Resultado da aplicação (qual records foram criados?)
  applied_record_ids jsonb, -- ex: {"transactions": ["uuid1", "uuid2"], "ir_other_incomes": ["uuid3"]}

  -- Erros
  error_message text,

  -- Lifecycle
  confirmed_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_uploads_household_status_idx
  on public.document_uploads (household_id, status, created_at desc);

create index document_uploads_household_month_idx
  on public.document_uploads (household_id, created_at desc);

-- File hash pra detectar duplicatas (unique by household)
create unique index document_uploads_file_hash_uniq
  on public.document_uploads (household_id, file_hash)
  where file_hash is not null and status != 'discarded';

alter table public.document_uploads enable row level security;

create policy "document_uploads: full access within household"
  on public.document_uploads for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Trigger updated_at
create trigger document_uploads_set_updated_at
  before update on public.document_uploads
  for each row execute function public.tg_set_updated_at();

grant select, insert, update, delete on public.document_uploads to authenticated;

-- ============================================================================
-- View: contagem de uploads no mês corrente por household (pra enforcing cap)
-- ============================================================================
create or replace view public.document_uploads_current_month_count as
select
  household_id,
  count(*) as count_this_month
from public.document_uploads
where created_at >= date_trunc('month', now())
  and status != 'discarded'
group by household_id;

grant select on public.document_uploads_current_month_count to authenticated;
