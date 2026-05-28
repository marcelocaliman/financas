-- ============================================================================
-- system_alerts: severity + user_facing + tradução
--
-- Suporta a separação entre:
--   - Visão do superadmin (vê tudo, técnico, JSON cru)
--   - Visão do user comum (vê só os user_facing, com mensagem amigável)
--
-- Severity: info | warning | error (controla cor/destaque na UI)
-- User_facing: true só pros alerts que o user comum precisa saber e tem
--   ação acionável. Default false (defensivo — alerts novos não vazam
--   sem revisar).
-- ============================================================================

set search_path = public;

alter table public.system_alerts
  add column if not exists severity text not null default 'warning'
    check (severity in ('info', 'warning', 'error')),
  add column if not exists user_facing boolean not null default false,
  -- Mensagem traduzida pra exibição ao user comum. Quando null, usa
  -- `message` cru (admin-only). Pra user_facing=true deve estar preenchida.
  add column if not exists user_message text;

-- Índice extra: query padrão do sino é (household_id, user_facing=true,
-- acknowledged_at is null, created_at desc).
create index if not exists system_alerts_user_facing_idx
  on public.system_alerts (household_id, created_at desc)
  where user_facing = true and acknowledged_at is null;
