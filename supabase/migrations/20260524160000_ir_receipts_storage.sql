-- ============================================================================
-- Finanças — Storage bucket pra recibos de pagamentos dedutíveis IR
--
-- Path convention: <household_id>/<year>/<deductible_id>/<filename>
-- RLS: usuário só vê arquivos do próprio household_id (path validation).
-- ============================================================================

set search_path = public;

-- Cria bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ir-receipts',
  'ir-receipts',
  false,
  10 * 1024 * 1024, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- RLS policies — extrai household_id do primeiro segmento do path
create policy "ir-receipts: user can read own household files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ir-receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy "ir-receipts: user can upload to own household"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ir-receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy "ir-receipts: user can delete own household files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ir-receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

-- Contador (read-only) também pode baixar recibos do household ao qual tem acesso
-- accountant_profiles.id = auth.users.id direto (FK)
create policy "ir-receipts: accountant can read granted households"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ir-receipts'
    and exists (
      select 1 from public.accountant_household_access aha
      where aha.accountant_id = auth.uid()
        and aha.household_id::text = (storage.foldername(name))[1]
        and aha.revoked_at is null
        and aha.expires_at > now()
    )
  );
