-- ============================================================================
-- Finanças — Throttle do auto-materialize
--
-- ensureMaterialized() é chamada em todo carregamento de página autenticada.
-- Embora idempotente, é desperdício rodar 50× na mesma sessão. Adicionamos
-- households.last_auto_materialize_at e a função respeita uma janela mínima
-- (default 6 horas) — se rodou recentemente, skip.
--
-- O cron diário continua como rede de segurança (roda às 06:45 BRT).
-- ============================================================================

set search_path = public;

alter table public.households
  add column if not exists last_auto_materialize_at timestamptz;

comment on column public.households.last_auto_materialize_at is
  'Última vez que ensureMaterialized() rodou pra este household. Usado pra '
  'throttling — evita rodar materialize_all em todo page load.';
