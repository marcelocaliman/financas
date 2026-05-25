-- ============================================================================
-- Finanças — CNPJ em physical_assets
--
-- Bens cadastrados como physical_asset com código Receita 32 (Quotas de
-- capital), 31 (Ações de cias fechadas), 39 (outras participações) precisam
-- de CNPJ da empresa. Antes só investments tinha campo cnpj — agora também
-- physical_assets, pra suportar participação societária da PJ do usuário.
-- ============================================================================

set search_path = public;

alter table public.physical_assets
  add column if not exists cnpj text;

comment on column public.physical_assets.cnpj is
  'CNPJ da empresa quando o bem é participação societária (códigos Receita '
  '31, 32, 39, 49). Formato livre (com ou sem pontuação) — normalização '
  'acontece no display.';
