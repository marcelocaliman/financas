-- ============================================================================
-- Finanças — Onboarding wizard tracking
-- ============================================================================
-- households.onboarding_completed_at marca quando o usuário finalizou (ou pulou)
-- o wizard de primeiro acesso. Null = nunca apareceu. Não-null = já visto.
-- Banner do wizard só aparece quando esse campo é null E há 0 transações no
-- household — proteção contra empurrar wizard pra quem já está populando manual.
-- ============================================================================

set search_path = public;

alter table public.households
  add column onboarding_completed_at timestamptz;

comment on column public.households.onboarding_completed_at is
  'Quando o usuário finalizou ou pulou o wizard de onboarding. Null = elegível pra ver o banner.';
